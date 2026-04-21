"""Alerta service: resolve alerts, evaluate rules."""

from app.core.utils import utcnow

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.analisis import Alerta, ReglaAlerta
from app.schemas.analisis import AlertaResolverRequest


def resolver_alerta(db: Session, id_alerta: int, data: AlertaResolverRequest) -> Alerta:
    alerta = db.query(Alerta).filter(Alerta.id_alerta == id_alerta).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    if alerta.estado == "resuelta":
        raise HTTPException(status_code=400, detail="Alerta ya fue resuelta")

    alerta.estado = "resuelta"
    alerta.notas_resolucion = data.notas
    alerta.usuario_resolucion = data.usuario
    alerta.fecha_resolucion = utcnow()
    db.commit()
    db.refresh(alerta)
    return alerta


# ─────────────────────────────────────────────────────────────────────────────
# Motor de evaluación de reglas de alerta (AL-1, AL-2, AL-5)
# ─────────────────────────────────────────────────────────────────────────────

# Cada regla se identifica por `codigo` y tiene una evaluación fija. Esto evita
# exponer SQL libre al usuario final (AL-4). Los umbrales salen de `condicion`
# (JSON o string "metrica op valor") cuando aplica.


def _parse_umbral(condicion: str | None, default: float = 0.0) -> float:
    """Extrae el valor numérico de una condición tipo 'brix < 14'."""
    if not condicion:
        return default
    parts = condicion.replace("<", " ").replace(">", " ").replace("=", " ").split()
    for p in reversed(parts):
        try:
            return float(p)
        except ValueError:
            continue
    return default


def _upsert_alerta(
    db: Session,
    *,
    id_posicion: int | None,
    tipo_alerta: str,
    prioridad: str,
    titulo: str,
    descripcion: str,
    valor_detectado: str,
    umbral_violado: str,
) -> bool:
    """Crea alerta solo si no existe una activa con el mismo (tipo + posición + título)."""
    existing = (
        db.query(Alerta)
        .filter(
            Alerta.tipo_alerta == tipo_alerta,
            Alerta.id_posicion == id_posicion,
            Alerta.titulo == titulo,
            Alerta.estado == "activa",
        )
        .first()
    )
    if existing:
        return False
    db.add(
        Alerta(
            id_posicion=id_posicion,
            tipo_alerta=tipo_alerta,
            prioridad=prioridad,
            titulo=titulo,
            descripcion=descripcion,
            valor_detectado=valor_detectado,
            umbral_violado=umbral_violado,
            estado="activa",
        )
    )
    return True


def evaluar_reglas(db: Session) -> dict:
    """Evalúa todas las reglas activas y genera alertas. Retorna contador."""
    reglas = db.query(ReglaAlerta).filter(ReglaAlerta.activo == True).all()

    created_by_code: dict[str, int] = {}

    for regla in reglas:
        code = (regla.codigo or "").upper()
        prioridad = regla.prioridad_resultado or "media"
        n = 0

        # -- Regla: brix bajo umbral (UMBRAL) ------------------------------
        if code.startswith("ALRT-001") or ("brix" in (regla.condicion or "").lower() and "<" in (regla.condicion or "")):
            umbral = _parse_umbral(regla.condicion, 14.0)
            rows = db.execute(
                text(
                    "SELECT m.id_medicion, m.id_posicion, m.brix "
                    "FROM mediciones_laboratorio m "
                    "WHERE m.brix IS NOT NULL AND m.brix < :u"
                ),
                {"u": umbral},
            ).all()
            for r in rows:
                if _upsert_alerta(
                    db,
                    id_posicion=r[1],
                    tipo_alerta="umbral_brix",
                    prioridad=prioridad,
                    titulo=f"Brix bajo ({float(r[2]):.1f})",
                    descripcion=f"Medición {r[0]} tiene brix={r[2]} (umbral={umbral}).",
                    valor_detectado=f"{float(r[2]):.1f}",
                    umbral_violado=f"<{umbral}",
                ):
                    n += 1

        # -- Regla: lotes con stock bajo mínimo (UMBRAL) -------------------
        elif code.startswith("ALRT-005") or ("cantidad_actual" in (regla.condicion or "").lower()):
            rows = db.execute(
                text(
                    "SELECT id_inventario, codigo_lote, cantidad_actual, cantidad_minima "
                    "FROM inventario_vivero "
                    "WHERE cantidad_minima IS NOT NULL AND cantidad_actual < cantidad_minima "
                    "AND estado NOT IN ('agotado', 'baja')"
                )
            ).all()
            for r in rows:
                if _upsert_alerta(
                    db,
                    id_posicion=None,
                    tipo_alerta="stock_bajo",
                    prioridad=prioridad,
                    titulo=f"Lote {r[1]} bajo mínimo",
                    descripcion=f"Lote id={r[0]} con stock={r[2]} (mínimo={r[3]}).",
                    valor_detectado=str(r[2]),
                    umbral_violado=f"<{r[3]}",
                ):
                    n += 1

        # -- Regla: posiciones sin registro fenológico reciente (TIEMPO) ----
        elif code.startswith("ALRT-003") or ("dias_sin_registro" in (regla.condicion or "").lower()):
            dias = int(_parse_umbral(regla.condicion, 7.0))
            rows = db.execute(
                text(
                    "SELECT p.id_posicion, p.hilera, p.posicion "
                    "FROM posiciones_testblock p "
                    "WHERE p.estado = 'alta' "
                    "AND NOT EXISTS (SELECT 1 FROM registros_fenologicos r "
                    "  WHERE r.id_posicion = p.id_posicion "
                    "  AND r.fecha_registro > DATEADD(day, -:d, GETDATE()))"
                ),
                {"d": dias},
            ).all()
            for r in rows[:500]:  # cap: 500 por ejecución para evitar flood
                if _upsert_alerta(
                    db,
                    id_posicion=r[0],
                    tipo_alerta="sin_registro",
                    prioridad=prioridad,
                    titulo=f"Posición H{r[1]}P{r[2]} sin registro >{dias}d",
                    descripcion=f"Sin registro fenológico en los últimos {dias} días.",
                    valor_detectado=f">{dias}d",
                    umbral_violado=f"{dias}d",
                ):
                    n += 1

        # -- Regla desconocida: no ejecutamos SQL libre por seguridad (AL-4)
        # Log to return dict so UI sabe que regla no se procesó.

        created_by_code[regla.codigo] = n

    db.commit()
    return {
        "reglas_evaluadas": len(reglas),
        "alertas_creadas": sum(created_by_code.values()),
        "por_regla": created_by_code,
    }
