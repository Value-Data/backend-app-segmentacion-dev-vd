"""Reporting routes: cross-entity reports with optional AI analysis."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.sistema import Usuario
from app.models.variedades import Variedad
from app.models.maestras import Especie, Portainjerto, Pmg, Campo, Vivero
from app.models.inventario import InventarioVivero, MovimientoInventario, InventarioTestBlock
from app.models.testblock import TestBlock, PosicionTestBlock, Planta
from app.models.laboratorio import MedicionLaboratorio, ClasificacionCluster, EjecucionLabor
from app.models.analisis import PaqueteTecnologico
from app.models.bitacora import BitacoraVariedad
from app.services.ai_service import get_ai_analysis

router = APIRouter(prefix="/reportes", tags=["Reportes"])


# ── helpers ─────────────────────────────────────────────────────────────────

def _resolve_name(db: Session, model, pk_field, pk_value, name_field="nombre"):
    """Resolve a single FK to its display name."""
    if pk_value is None:
        return None
    row = db.query(getattr(model, name_field)).filter(pk_field == pk_value).first()
    return row[0] if row else None


def _serialize_rows(rows) -> list[dict]:
    """Convert a list of SQLModel rows to plain dicts."""
    result = []
    for r in rows:
        d = {}
        for col in r.__table__.columns:
            val = getattr(r, col.name)
            d[col.name] = val
        result.append(d)
    return result


def _serialize_row(row) -> dict | None:
    """Convert a single SQLModel row to a plain dict."""
    if row is None:
        return None
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        # Skip binary fields (images)
        if isinstance(val, (bytes, bytearray)):
            d[col.name] = None
        else:
            d[col.name] = val
    return d


# ── Report: Variedad ────────────────────────────────────────────────────────

@router.get("/variedad/{id_variedad}")
def report_variedad(
    id_variedad: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Full cross-entity report for a variety."""
    variedad = db.query(Variedad).filter(Variedad.id_variedad == id_variedad).first()
    if not variedad:
        raise HTTPException(status_code=404, detail="Variedad no encontrada")

    var_dict = _serialize_row(variedad)
    var_dict["especie_nombre"] = _resolve_name(
        db, Especie, Especie.id_especie, variedad.id_especie
    )
    var_dict["pmg_nombre"] = _resolve_name(
        db, Pmg, Pmg.id_pmg, variedad.id_pmg
    )

    # Inventario: all lotes of this variety
    lotes = db.query(InventarioVivero).filter(
        InventarioVivero.id_variedad == id_variedad
    ).all()
    inventario = _serialize_rows(lotes)

    # Plantaciones: positions where this variety is planted, grouped by testblock
    posiciones = db.query(PosicionTestBlock).filter(
        PosicionTestBlock.id_variedad == id_variedad
    ).all()
    plantaciones = []
    tb_ids = set()
    for p in posiciones:
        pd = _serialize_row(p)
        if p.id_testblock:
            tb_ids.add(p.id_testblock)
            pd["testblock_nombre"] = _resolve_name(
                db, TestBlock, TestBlock.id_testblock, p.id_testblock
            )
        plantaciones.append(pd)

    # Lab results: mediciones from plants of this variety
    planta_ids = [
        pl.id_planta for pl in
        db.query(Planta.id_planta).filter(Planta.id_variedad == id_variedad).all()
    ]
    mediciones = []
    if planta_ids:
        med_rows = db.query(MedicionLaboratorio).filter(
            MedicionLaboratorio.id_planta.in_(planta_ids)
        ).order_by(MedicionLaboratorio.fecha_medicion.desc()).all()
        mediciones = _serialize_rows(med_rows)

    # Bitacora
    bitacora_rows = db.query(BitacoraVariedad).filter(
        BitacoraVariedad.id_variedad == id_variedad
    ).order_by(BitacoraVariedad.fecha.desc()).all()
    bitacora = _serialize_rows(bitacora_rows)

    # Labores count: labores on positions with this variety
    pos_ids = [p.id_posicion for p in posiciones]
    labores_count = 0
    if pos_ids:
        labores_count = db.query(EjecucionLabor).filter(
            EjecucionLabor.id_posicion.in_(pos_ids)
        ).count()

    return {
        "variedad": var_dict,
        "inventario": inventario,
        "plantaciones": plantaciones,
        "mediciones": mediciones,
        "bitacora": bitacora,
        "labores_count": labores_count,
    }


# ── Report: Lote ────────────────────────────────────────────────────────────

@router.get("/lote/{id_inventario}")
def report_lote(
    id_inventario: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Full lifecycle report for a lote (inventario_vivero)."""
    lote = db.query(InventarioVivero).filter(
        InventarioVivero.id_inventario == id_inventario
    ).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    lote_dict = _serialize_row(lote)
    lote_dict["variedad_nombre"] = _resolve_name(
        db, Variedad, Variedad.id_variedad, lote.id_variedad, "nombre"
    )
    lote_dict["portainjerto_nombre"] = _resolve_name(
        db, Portainjerto, Portainjerto.id_portainjerto, lote.id_portainjerto
    )

    # Movimientos (kardex)
    movimientos = db.query(MovimientoInventario).filter(
        MovimientoInventario.id_inventario == id_inventario
    ).order_by(MovimientoInventario.fecha_movimiento.desc()).all()

    # Destinos: where plants went via inventario_testblock
    inv_tb = db.query(InventarioTestBlock).filter(
        InventarioTestBlock.id_inventario == id_inventario
    ).all()
    destinos = []
    for itb in inv_tb:
        d = _serialize_row(itb)
        # Resolve testblock name via cuartel -> testblock
        # inventario_testblock links via id_cuartel, resolve testblock from posiciones
        d["testblock_nombre"] = None
        destinos.append(d)

    # Plantas created from this lote
    plantas = db.query(Planta).filter(
        Planta.id_lote_origen == id_inventario
    ).all()

    return {
        "lote": lote_dict,
        "movimientos": _serialize_rows(movimientos),
        "destinos": destinos,
        "plantas": _serialize_rows(plantas),
    }


# ── Report: TestBlock ───────────────────────────────────────────────────────

@router.get("/testblock/{id_testblock}")
def report_testblock(
    id_testblock: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Complete cross-entity report for a testblock."""
    tb = db.query(TestBlock).filter(TestBlock.id_testblock == id_testblock).first()
    if not tb:
        raise HTTPException(status_code=404, detail="TestBlock no encontrado")

    tb_dict = _serialize_row(tb)
    tb_dict["campo_nombre"] = _resolve_name(
        db, Campo, Campo.id_campo, tb.id_campo
    )

    # All positions
    posiciones = db.query(PosicionTestBlock).filter(
        PosicionTestBlock.id_testblock == id_testblock
    ).all()

    # Position summary by estado
    posiciones_resumen = {}
    for p in posiciones:
        est = p.estado or "vacia"
        posiciones_resumen[est] = posiciones_resumen.get(est, 0) + 1

    # Varieties present: use active plants (preferred) with position fallback
    # This fixes the bug where posiciones_testblock.id_variedad is NULL for most rows
    pos_ids_with_plant = [p.id_posicion for p in posiciones if p.estado in ("alta", "replante")]
    plant_map: dict[int, Planta] = {}
    if pos_ids_with_plant:
        plantas_activas = (
            db.query(Planta)
            .filter(Planta.id_posicion.in_(pos_ids_with_plant), Planta.activa == True)
            .all()
        )
        for pl in plantas_activas:
            plant_map[pl.id_posicion] = pl

    var_counts: dict[int, int] = {}
    for p in posiciones:
        planta = plant_map.get(p.id_posicion)
        vid = (planta.id_variedad if planta and planta.id_variedad else None) or p.id_variedad
        if vid:
            var_counts[vid] = var_counts.get(vid, 0) + 1
    total_con_variedad = sum(var_counts.values()) or 1
    variedades = []
    for vid, cnt in sorted(var_counts.items(), key=lambda x: -x[1]):
        nombre = _resolve_name(db, Variedad, Variedad.id_variedad, vid)
        variedades.append({
            "id_variedad": vid,
            "nombre": nombre or f"#{vid}",
            "variedad": nombre or f"#{vid}",
            "cantidad": cnt,
            "pct": round(cnt / total_con_variedad * 100, 1),
        })

    # Lab results from plants in this testblock
    pos_ids = [p.id_posicion for p in posiciones]
    mediciones = []
    if pos_ids:
        med_rows = db.query(MedicionLaboratorio).filter(
            MedicionLaboratorio.id_posicion.in_(pos_ids)
        ).order_by(MedicionLaboratorio.fecha_medicion.desc()).all()
        mediciones = _serialize_rows(med_rows)

    # Labores for this testblock
    labores = []
    if pos_ids:
        lab_rows = db.query(EjecucionLabor).filter(
            EjecucionLabor.id_posicion.in_(pos_ids)
        ).order_by(EjecucionLabor.fecha_ejecucion.desc()).all()
        labores = _serialize_rows(lab_rows)

    # Inventory assigned
    inv_tb = db.query(InventarioTestBlock).filter(
        InventarioTestBlock.id_cuartel == tb.id_cuartel
    ).all() if tb.id_cuartel else []

    return {
        "testblock": tb_dict,
        "posiciones_resumen": posiciones_resumen,
        "variedades": variedades,
        "mediciones": mediciones,
        "labores": labores,
        "inventario": _serialize_rows(inv_tb) if inv_tb else [],
    }


# ── AI Analysis ─────────────────────────────────────────────────────────────

class AIAnalysisRequest(BaseModel):
    tipo_reporte: str  # "variedad", "lote", "testblock"
    id_entidad: int
    pregunta: Optional[str] = None


def _safe_float(val) -> float | None:
    """Safely convert a value (Decimal, int, str) to float."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _build_variedad_summary(data: dict) -> str:
    """Build a rich text summary of variedad report for AI analysis."""
    v = data["variedad"]
    lines = [
        f"VARIEDAD: {v.get('nombre')} (codigo: {v.get('codigo')})",
        f"Especie: {v.get('especie_nombre')}, PMG: {v.get('pmg_nombre')}, Estado: {v.get('estado')}",
        f"Tipo: {v.get('tipo')}, Epoca cosecha: {v.get('epoca_cosecha')}, Vigor: {v.get('vigor')}",
        f"Calibre esperado: {v.get('calibre_esperado')}, Firmeza esperada: {v.get('firmeza_esperada')}",
        "",
        f"INVENTARIO: {len(data['inventario'])} lotes",
    ]
    total_stock = 0
    total_inicial = 0
    for lote in data["inventario"][:10]:
        stock = lote.get("cantidad_actual", 0) or 0
        inicial = lote.get("cantidad_inicial", 0) or 0
        total_stock += stock
        total_inicial += inicial
        lines.append(
            f"  - Lote {lote.get('codigo_lote')}: stock={stock}/{inicial}, "
            f"estado={lote.get('estado')}, ingreso={lote.get('fecha_ingreso')}"
        )
    lines.append(f"  Stock total actual: {total_stock} (inicial acumulado: {total_inicial})")

    # Plantaciones grouped by testblock
    plantaciones = data["plantaciones"]
    lines.append(f"\nPLANTACIONES: {len(plantaciones)} posiciones")
    tb_groups: dict[str, dict] = {}
    for p in plantaciones:
        tb = p.get("testblock_nombre") or "Sin testblock"
        if tb not in tb_groups:
            tb_groups[tb] = {"total": 0, "alta": 0, "baja": 0, "replante": 0, "vacia": 0}
        tb_groups[tb]["total"] += 1
        est = p.get("estado", "vacia")
        if est in tb_groups[tb]:
            tb_groups[tb][est] += 1
    for tb, stats in tb_groups.items():
        lines.append(f"  - {tb}: {stats['total']} posiciones (alta={stats['alta']}, baja={stats['baja']}, replante={stats['replante']})")

    # Lab results with individual values
    mediciones = data["mediciones"]
    lines.append(f"\nMEDICIONES LABORATORIO: {len(mediciones)}")
    if mediciones:
        brix_vals = [_safe_float(m["brix"]) for m in mediciones if _safe_float(m.get("brix")) is not None]
        firmeza_vals = [_safe_float(m["firmeza"]) for m in mediciones if _safe_float(m.get("firmeza")) is not None]
        calibre_vals = [_safe_float(m["calibre"]) for m in mediciones if _safe_float(m.get("calibre")) is not None]
        acidez_vals = [_safe_float(m["acidez"]) for m in mediciones if _safe_float(m.get("acidez")) is not None]
        peso_vals = [_safe_float(m["peso"]) for m in mediciones if _safe_float(m.get("peso")) is not None]

        if brix_vals:
            lines.append(f"  Brix: min={min(brix_vals):.1f}, max={max(brix_vals):.1f}, prom={sum(brix_vals)/len(brix_vals):.1f} (n={len(brix_vals)})")
        if firmeza_vals:
            lines.append(f"  Firmeza: min={min(firmeza_vals):.1f}, max={max(firmeza_vals):.1f}, prom={sum(firmeza_vals)/len(firmeza_vals):.1f} (n={len(firmeza_vals)})")
        if calibre_vals:
            lines.append(f"  Calibre: min={min(calibre_vals):.1f}, max={max(calibre_vals):.1f}, prom={sum(calibre_vals)/len(calibre_vals):.1f} (n={len(calibre_vals)})")
        if acidez_vals:
            lines.append(f"  Acidez: min={min(acidez_vals):.2f}, max={max(acidez_vals):.2f}, prom={sum(acidez_vals)/len(acidez_vals):.2f} (n={len(acidez_vals)})")
        if peso_vals:
            lines.append(f"  Peso: min={min(peso_vals):.1f}, max={max(peso_vals):.1f}, prom={sum(peso_vals)/len(peso_vals):.1f} (n={len(peso_vals)})")

        # Individual measurements (up to 15)
        lines.append("  Detalle mediciones recientes:")
        for m in mediciones[:15]:
            obs = str(m.get("observaciones", "") or "")[:100]
            lines.append(
                f"    Fecha: {m.get('fecha_medicion')} | Temporada: {m.get('temporada')} | "
                f"Brix={m.get('brix')} | Firmeza={m.get('firmeza')} | Calibre={m.get('calibre')} | "
                f"Acidez={m.get('acidez')} | Peso={m.get('peso')} | Color%={m.get('color_pct')} | "
                f"Cracking%={m.get('cracking_pct')}"
            )
            if obs:
                lines.append(f"      Obs: {obs}")

    # Bitacora with full content
    lines.append(f"\nBITACORA: {len(data['bitacora'])} entradas")
    for b in data["bitacora"]:
        lines.append(f"  [{b.get('tipo_entrada')}] {b.get('titulo')} ({b.get('fecha')})")
        contenido = str(b.get("contenido", "") or "")[:500]
        if contenido:
            lines.append(f"    {contenido}")
        resultado = b.get("resultado")
        if resultado:
            lines.append(f"    Resultado: {resultado}")

    lines.append(f"\nLABORES: {data.get('labores_count', 0)} labores registradas")

    return "\n".join(lines)


def _build_lote_summary(data: dict) -> str:
    """Build a rich text summary of lote report for AI analysis."""
    l = data["lote"]
    cantidad_inicial = l.get("cantidad_inicial", 0) or 0
    cantidad_actual = l.get("cantidad_actual", 0) or 0
    consumido = cantidad_inicial - cantidad_actual

    lines = [
        f"LOTE: {l.get('codigo_lote')}",
        f"Variedad: {l.get('variedad_nombre')}, Portainjerto: {l.get('portainjerto_nombre')}",
        f"Especie: {l.get('especie_nombre', '-')}, PMG: {l.get('pmg_nombre', '-')}",
        f"Stock inicial: {cantidad_inicial}, Stock actual: {cantidad_actual}, Consumido: {consumido}",
        f"Estado: {l.get('estado')}, Fecha ingreso: {l.get('fecha_ingreso')}",
        f"Origen: {l.get('origen', '-')}, Proveedor: {l.get('proveedor', '-')}",
    ]
    if cantidad_inicial > 0:
        pct_consumido = round(consumido / cantidad_inicial * 100, 1)
        lines.append(f"Porcentaje consumido: {pct_consumido}%")

    # Kardex narrative
    movs = data["movimientos"]
    lines.append(f"\nKARDEX DE MOVIMIENTOS: {len(movs)} registros")
    tipo_counts: dict[str, int] = {}
    tipo_cantidades: dict[str, int] = {}
    for m in movs:
        tipo = m.get("tipo", "?")
        cant = m.get("cantidad", 0) or 0
        tipo_counts[tipo] = tipo_counts.get(tipo, 0) + 1
        tipo_cantidades[tipo] = tipo_cantidades.get(tipo, 0) + cant
    for tipo, cnt in tipo_counts.items():
        lines.append(f"  {tipo}: {cnt} movimientos, total {tipo_cantidades[tipo]} unidades")

    lines.append("  Detalle movimientos recientes:")
    for m in movs[:15]:
        motivo = str(m.get("motivo", "") or "")[:80]
        lines.append(
            f"    {m.get('fecha_movimiento')} | {m.get('tipo')}: {m.get('cantidad')} uds | "
            f"Saldo: {m.get('saldo_anterior')} -> {m.get('saldo_nuevo')} | {motivo}"
        )
        ref = m.get("referencia_destino")
        if ref:
            lines.append(f"      Destino: {ref}")

    # Destinos
    destinos = data["destinos"]
    lines.append(f"\nDESTINOS (testblocks): {len(destinos)} despachos")
    for d in destinos:
        asignada = d.get("cantidad_asignada", 0) or 0
        plantada = d.get("cantidad_plantada", 0) or 0
        lines.append(
            f"  - TB: {d.get('testblock_nombre', '?')} | Asignado: {asignada}, "
            f"Plantado: {plantada}, Estado: {d.get('estado')}"
        )

    # Plantas
    plantas = data["plantas"]
    lines.append(f"\nPLANTAS CREADAS: {len(plantas)}")
    if plantas:
        activas = sum(1 for p in plantas if p.get("activa"))
        inactivas = len(plantas) - activas
        lines.append(f"  Activas: {activas}, Inactivas (baja): {inactivas}")
        condiciones: dict[str, int] = {}
        for p in plantas:
            cond = p.get("condicion", "?") or "?"
            condiciones[cond] = condiciones.get(cond, 0) + 1
        for cond, cnt in condiciones.items():
            lines.append(f"  Condicion '{cond}': {cnt}")

    return "\n".join(lines)


def _build_testblock_summary(data: dict) -> str:
    """Build a rich text summary of testblock report for AI analysis."""
    tb = data["testblock"]
    lines = [
        f"TESTBLOCK: {tb.get('nombre')} (codigo: {tb.get('codigo')})",
        f"Campo: {tb.get('campo_nombre')}, Estado: {tb.get('estado')}",
        f"Hileras: {tb.get('num_hileras')}, Total posiciones: {tb.get('total_posiciones')}",
        f"Posiciones por hilera: {tb.get('posiciones_por_hilera')}",
        f"Temporada: {tb.get('temporada', '-')}, Fecha creacion: {tb.get('fecha_creacion')}",
    ]

    # Position summary
    resumen = data["posiciones_resumen"]
    total_pos = sum(resumen.values())
    lines.append(f"\nRESUMEN POSICIONES: {total_pos} total")
    for est, cnt in resumen.items():
        pct = round(cnt / total_pos * 100, 1) if total_pos else 0
        lines.append(f"  {est}: {cnt} ({pct}%)")

    # Varieties with distribution
    variedades = data["variedades"]
    lines.append(f"\nVARIEDADES PRESENTES: {len(variedades)}")
    for v in variedades[:20]:
        pct = v.get("pct", 0)
        lines.append(f"  - {v.get('nombre', v.get('variedad', '?'))}: {v['cantidad']} posiciones ({pct}%)")

    # Lab results with statistics per variety
    mediciones = data["mediciones"]
    lines.append(f"\nMEDICIONES LABORATORIO: {len(mediciones)}")
    if mediciones:
        brix_vals = [_safe_float(m["brix"]) for m in mediciones if _safe_float(m.get("brix")) is not None]
        firmeza_vals = [_safe_float(m["firmeza"]) for m in mediciones if _safe_float(m.get("firmeza")) is not None]
        calibre_vals = [_safe_float(m["calibre"]) for m in mediciones if _safe_float(m.get("calibre")) is not None]
        acidez_vals = [_safe_float(m["acidez"]) for m in mediciones if _safe_float(m.get("acidez")) is not None]
        peso_vals = [_safe_float(m["peso"]) for m in mediciones if _safe_float(m.get("peso")) is not None]

        if brix_vals:
            lines.append(f"  Brix: min={min(brix_vals):.1f}, max={max(brix_vals):.1f}, prom={sum(brix_vals)/len(brix_vals):.1f} (n={len(brix_vals)})")
        if firmeza_vals:
            lines.append(f"  Firmeza: min={min(firmeza_vals):.1f}, max={max(firmeza_vals):.1f}, prom={sum(firmeza_vals)/len(firmeza_vals):.1f} (n={len(firmeza_vals)})")
        if calibre_vals:
            lines.append(f"  Calibre: min={min(calibre_vals):.1f}, max={max(calibre_vals):.1f}, prom={sum(calibre_vals)/len(calibre_vals):.1f} (n={len(calibre_vals)})")
        if acidez_vals:
            lines.append(f"  Acidez: min={min(acidez_vals):.2f}, max={max(acidez_vals):.2f}, prom={sum(acidez_vals)/len(acidez_vals):.2f} (n={len(acidez_vals)})")
        if peso_vals:
            lines.append(f"  Peso: min={min(peso_vals):.1f}, max={max(peso_vals):.1f}, prom={sum(peso_vals)/len(peso_vals):.1f} (n={len(peso_vals)})")

        # Temporal breakdown by temporada
        temporadas: dict[str, list] = {}
        for m in mediciones:
            temp = m.get("temporada") or "Sin temporada"
            if temp not in temporadas:
                temporadas[temp] = []
            temporadas[temp].append(m)
        if len(temporadas) > 1:
            lines.append("  Desglose por temporada:")
            for temp, meds in temporadas.items():
                brix_t = [_safe_float(m["brix"]) for m in meds if _safe_float(m.get("brix")) is not None]
                prom_brix = f"{sum(brix_t)/len(brix_t):.1f}" if brix_t else "-"
                lines.append(f"    {temp}: {len(meds)} mediciones, Brix prom={prom_brix}")

        # Individual recent measurements
        lines.append("  Detalle mediciones recientes:")
        for m in mediciones[:15]:
            obs = str(m.get("observaciones", "") or "")[:100]
            lines.append(
                f"    Fecha: {m.get('fecha_medicion')} | Temporada: {m.get('temporada')} | "
                f"Brix={m.get('brix')} | Firmeza={m.get('firmeza')} | Calibre={m.get('calibre')} | "
                f"Acidez={m.get('acidez')} | Peso={m.get('peso')}"
            )
            if obs:
                lines.append(f"      Obs: {obs}")

    # Labores with detail
    labores = data["labores"]
    lines.append(f"\nLABORES EJECUTADAS: {len(labores)}")
    if labores:
        labor_tipos: dict[str, int] = {}
        for lab in labores:
            estado = lab.get("estado", "?")
            labor_tipos[estado] = labor_tipos.get(estado, 0) + 1
        for estado, cnt in labor_tipos.items():
            lines.append(f"  Estado '{estado}': {cnt}")
        lines.append("  Labores recientes:")
        for lab in labores[:10]:
            lines.append(
                f"    {lab.get('fecha_ejecucion')} | Ejecutor: {lab.get('ejecutor', '-')} | "
                f"Duracion: {lab.get('duracion_min', '-')} min | {str(lab.get('observaciones', '') or '')[:80]}"
            )

    # Inventory assigned
    inventario = data.get("inventario", [])
    if inventario:
        lines.append(f"\nINVENTARIO ASIGNADO: {len(inventario)} lotes")
        for inv in inventario:
            lines.append(
                f"  - Lote {inv.get('id_inventario')}: asignado={inv.get('cantidad_asignada', 0)}, "
                f"plantado={inv.get('cantidad_plantada', 0)}, estado={inv.get('estado')}"
            )

    return "\n".join(lines)


@router.post("/ai-analisis")
def ai_analysis(
    req: AIAnalysisRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Send report data to Azure OpenAI for agronomic analysis."""
    # Fetch report data depending on type
    if req.tipo_reporte == "variedad":
        data = report_variedad(req.id_entidad, db, user)
        context = _build_variedad_summary(data)
    elif req.tipo_reporte == "lote":
        data = report_lote(req.id_entidad, db, user)
        context = _build_lote_summary(data)
    elif req.tipo_reporte == "testblock":
        data = report_testblock(req.id_entidad, db, user)
        context = _build_testblock_summary(data)
    else:
        raise HTTPException(status_code=400, detail="tipo_reporte debe ser: variedad, lote, testblock")

    question = req.pregunta or "Analiza estos datos y da recomendaciones agronomicas concretas."
    analisis = get_ai_analysis(context, question)

    return {"analisis": analisis}


# ── PDF Report ─────────────────────────────────────────────────────────────

@router.get("/pdf/{tipo}/{id_entidad}")
def report_pdf(
    tipo: str,
    id_entidad: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Generate a professional PDF report for variedad/lote/testblock."""
    from io import BytesIO
    from datetime import datetime
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER

    # Fetch data
    if tipo == "variedad":
        data = report_variedad(id_entidad, db, user)
        title = f"Reporte de Variedad: {data['variedad']['nombre']}"
    elif tipo == "lote":
        data = report_lote(id_entidad, db, user)
        title = f"Reporte de Lote: {data['lote']['codigo_lote']}"
    elif tipo == "testblock":
        data = report_testblock(id_entidad, db, user)
        title = f"Reporte de TestBlock: {data['testblock']['nombre']}"
    else:
        raise HTTPException(status_code=400, detail="tipo debe ser: variedad, lote, testblock")

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    styles = getSampleStyleSheet()

    # Custom styles
    cherry = colors.HexColor("#8B1A1A")
    dark_green = colors.HexColor("#2D5F2D")
    title_style = ParagraphStyle(
        "TitleCherry", parent=styles["Title"], textColor=cherry, fontSize=18, spaceAfter=6,
    )
    h2_style = ParagraphStyle(
        "H2Cherry", parent=styles["Heading2"], textColor=cherry, fontSize=13, spaceBefore=14, spaceAfter=6,
    )
    h3_style = ParagraphStyle(
        "H3Green", parent=styles["Heading3"], textColor=dark_green, fontSize=11, spaceBefore=10, spaceAfter=4,
    )
    normal = styles["Normal"]
    body_style = ParagraphStyle(
        "Body", parent=normal, fontSize=9, leading=13, alignment=TA_JUSTIFY, spaceAfter=6,
    )
    small = ParagraphStyle("Small", parent=normal, fontSize=8, textColor=colors.gray)
    note_style = ParagraphStyle(
        "Note", parent=normal, fontSize=8, textColor=colors.HexColor("#555555"),
        leading=11, leftIndent=12, spaceAfter=4,
    )

    story = []

    # Header
    story.append(Paragraph("Garces Fruit — Sistema de Segmentacion de Nuevas Especies", small))
    story.append(Paragraph(title, title_style))
    story.append(Paragraph(
        f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')} | Usuario: {user.username}",
        small,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=cherry, spaceAfter=10))

    table_style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), cherry),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FFF5F5")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ])

    info_table_style = TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F5F0F0")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F5F0F0")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])

    def add_table(headers, rows, col_widths=None):
        if not rows:
            story.append(Paragraph("<i>Sin datos disponibles.</i>", note_style))
            return
        t_data = [headers] + rows
        t = Table(t_data, colWidths=col_widths, repeatRows=1)
        t.setStyle(table_style)
        story.append(t)

    def add_info_table(rows, col_widths=None):
        t = Table(rows, colWidths=col_widths)
        t.setStyle(info_table_style)
        story.append(t)

    # ── VARIEDAD PDF ──────────────────────────────────────────────────────
    if tipo == "variedad":
        v = data["variedad"]
        n_lotes = len(data["inventario"])
        n_plantaciones = len(data["plantaciones"])
        n_mediciones = len(data["mediciones"])
        n_bitacora = len(data["bitacora"])

        # Count unique testblocks
        tb_names = set()
        for p in data["plantaciones"]:
            tn = p.get("testblock_nombre")
            if tn:
                tb_names.add(tn)
        n_testblocks = len(tb_names)

        # Executive summary
        story.append(Paragraph("1. Resumen Ejecutivo", h2_style))
        estado_txt = str(v.get("estado", "sin definir")).lower()
        especie_txt = v.get("especie_nombre", "especie no definida")
        pmg_txt = v.get("pmg_nombre", "sin PMG")
        total_stock = sum((l.get("cantidad_actual", 0) or 0) for l in data["inventario"])

        exec_summary = (
            f"La variedad <b>{v.get('nombre')}</b> (codigo: {v.get('codigo')}) de la especie "
            f"<b>{especie_txt}</b>, perteneciente al programa de mejoramiento genetico "
            f"<b>{pmg_txt}</b>, se encuentra actualmente en estado <b>{estado_txt}</b>. "
        )
        if n_lotes > 0:
            exec_summary += (
                f"Cuenta con <b>{n_lotes}</b> lote(s) en inventario con un stock total de "
                f"<b>{total_stock}</b> unidades disponibles. "
            )
        if n_plantaciones > 0:
            exec_summary += (
                f"Se han establecido <b>{n_plantaciones}</b> posiciones plantadas distribuidas "
                f"en <b>{n_testblocks}</b> testblock(s). "
            )
        if n_mediciones > 0:
            exec_summary += f"Se dispone de <b>{n_mediciones}</b> mediciones de laboratorio. "
        if n_bitacora > 0:
            exec_summary += f"La bitacora registra <b>{n_bitacora}</b> entradas de seguimiento."
        story.append(Paragraph(exec_summary, body_style))
        story.append(Spacer(1, 6))

        # General info table
        story.append(Paragraph("2. Informacion General", h2_style))
        info = [
            ["Codigo", str(v.get("codigo", "")), "Especie", str(v.get("especie_nombre", "-"))],
            ["Estado", str(v.get("estado", "")), "PMG", str(v.get("pmg_nombre", "-"))],
            ["Tipo", str(v.get("tipo", "")), "Epoca cosecha", str(v.get("epoca_cosecha", "-"))],
            ["Vigor", str(v.get("vigor", "-")), "Calibre esperado", str(v.get("calibre_esperado", "-"))],
        ]
        add_info_table(info, col_widths=[1.2 * inch, 1.8 * inch, 1.2 * inch, 1.8 * inch])
        story.append(Spacer(1, 8))

        # Inventario
        story.append(Paragraph(f"3. Inventario ({n_lotes} lotes)", h2_style))
        if n_lotes > 0:
            total_inicial = sum((l.get("cantidad_inicial", 0) or 0) for l in data["inventario"])
            consumido = total_inicial - total_stock
            pct = round(consumido / total_inicial * 100, 1) if total_inicial else 0
            story.append(Paragraph(
                f"El inventario total comprende <b>{total_inicial}</b> unidades ingresadas, "
                f"de las cuales se han consumido <b>{consumido}</b> ({pct}%), "
                f"quedando <b>{total_stock}</b> unidades disponibles.",
                body_style,
            ))
        inv_rows = [
            [
                str(l.get("codigo_lote", "")),
                str(l.get("cantidad_actual", 0)),
                str(l.get("cantidad_inicial", 0)),
                str(l.get("estado", "")),
                str(l.get("fecha_ingreso", "")),
            ]
            for l in data["inventario"][:20]
        ]
        add_table(["Lote", "Stock actual", "Stock inicial", "Estado", "Fecha ingreso"], inv_rows)

        # Plantaciones
        story.append(Paragraph(f"4. Plantaciones ({n_plantaciones} posiciones)", h2_style))
        if n_plantaciones > 0:
            # Group by testblock
            tb_summary: dict[str, dict] = {}
            for p in data["plantaciones"]:
                tb = p.get("testblock_nombre") or "Sin testblock"
                if tb not in tb_summary:
                    tb_summary[tb] = {"total": 0, "alta": 0, "baja": 0, "replante": 0}
                tb_summary[tb]["total"] += 1
                est = p.get("estado", "")
                if est in tb_summary[tb]:
                    tb_summary[tb][est] += 1

            parts = []
            for tb, s in tb_summary.items():
                parts.append(f"{tb} ({s['total']} posiciones: {s['alta']} en alta, {s['baja']} en baja, {s['replante']} replantes)")
            story.append(Paragraph(
                f"Las posiciones se distribuyen en los siguientes testblocks: {'; '.join(parts)}.",
                body_style,
            ))
            tb_rows = [[tb, str(s["total"]), str(s["alta"]), str(s["baja"]), str(s["replante"])] for tb, s in tb_summary.items()]
            add_table(["TestBlock", "Total", "Alta", "Baja", "Replante"], tb_rows)

        # Mediciones
        story.append(Paragraph(f"5. Mediciones de Laboratorio ({n_mediciones})", h2_style))
        if n_mediciones > 0:
            brix_vals = [_safe_float(m["brix"]) for m in data["mediciones"] if _safe_float(m.get("brix")) is not None]
            firmeza_vals = [_safe_float(m["firmeza"]) for m in data["mediciones"] if _safe_float(m.get("firmeza")) is not None]
            calibre_vals = [_safe_float(m["calibre"]) for m in data["mediciones"] if _safe_float(m.get("calibre")) is not None]
            acidez_vals = [_safe_float(m["acidez"]) for m in data["mediciones"] if _safe_float(m.get("acidez")) is not None]

            interp_parts = []
            if brix_vals:
                prom_brix = sum(brix_vals) / len(brix_vals)
                interp_parts.append(
                    f"un <b>Brix</b> promedio de <b>{prom_brix:.1f}</b> "
                    f"(rango {min(brix_vals):.1f} - {max(brix_vals):.1f})"
                )
            if firmeza_vals:
                prom_firmeza = sum(firmeza_vals) / len(firmeza_vals)
                interp_parts.append(
                    f"una <b>Firmeza</b> promedio de <b>{prom_firmeza:.1f}</b> "
                    f"(rango {min(firmeza_vals):.1f} - {max(firmeza_vals):.1f})"
                )
            if calibre_vals:
                prom_calibre = sum(calibre_vals) / len(calibre_vals)
                interp_parts.append(
                    f"un <b>Calibre</b> promedio de <b>{prom_calibre:.1f}</b> mm "
                    f"(rango {min(calibre_vals):.1f} - {max(calibre_vals):.1f})"
                )
            if acidez_vals:
                prom_acidez = sum(acidez_vals) / len(acidez_vals)
                interp_parts.append(
                    f"una <b>Acidez</b> promedio de <b>{prom_acidez:.2f}</b> "
                    f"(rango {min(acidez_vals):.2f} - {max(acidez_vals):.2f})"
                )

            if interp_parts:
                story.append(Paragraph(
                    f"Las mediciones de laboratorio ({n_mediciones} registros) muestran "
                    + ", ".join(interp_parts) + ".",
                    body_style,
                ))

            med_rows = [
                [
                    str(m.get("fecha_medicion", "")),
                    str(m.get("temporada", "-")),
                    str(m.get("brix", "-")),
                    str(m.get("firmeza", "-")),
                    str(m.get("calibre", "-")),
                    str(m.get("acidez", "-")),
                    str(m.get("peso", "-")),
                ]
                for m in data["mediciones"][:25]
            ]
            add_table(["Fecha", "Temporada", "Brix", "Firmeza", "Calibre", "Acidez", "Peso"], med_rows)

        # Bitacora with full content
        story.append(Paragraph(f"6. Bitacora de Seguimiento ({n_bitacora} entradas)", h2_style))
        if n_bitacora > 0:
            story.append(Paragraph(
                "A continuacion se presenta el registro cronologico de observaciones, "
                "visitas de campo y evaluaciones realizadas sobre la variedad.",
                body_style,
            ))
            for b in data["bitacora"][:15]:
                tipo_e = b.get("tipo_entrada", "")
                titulo = b.get("titulo", "Sin titulo")
                fecha = b.get("fecha", "")
                story.append(Paragraph(
                    f"<b>[{tipo_e}] {titulo}</b> — {fecha}",
                    ParagraphStyle("BitacoraTitle", parent=normal, fontSize=9, spaceBefore=6, textColor=dark_green),
                ))
                contenido = str(b.get("contenido", "") or "")[:600]
                if contenido:
                    story.append(Paragraph(contenido, note_style))
                resultado = b.get("resultado")
                if resultado:
                    story.append(Paragraph(f"<i>Resultado: {resultado}</i>", note_style))

        # Labores
        story.append(Paragraph("7. Labores", h2_style))
        story.append(Paragraph(
            f"Se han registrado <b>{data['labores_count']}</b> labores asociadas a las posiciones "
            f"de esta variedad.",
            body_style,
        ))

    # ── LOTE PDF ──────────────────────────────────────────────────────────
    elif tipo == "lote":
        l = data["lote"]
        cantidad_inicial = l.get("cantidad_inicial", 0) or 0
        cantidad_actual = l.get("cantidad_actual", 0) or 0
        consumido = cantidad_inicial - cantidad_actual
        pct_consumido = round(consumido / cantidad_inicial * 100, 1) if cantidad_inicial > 0 else 0

        # Executive summary
        story.append(Paragraph("1. Resumen Ejecutivo", h2_style))
        exec_summary = (
            f"El lote <b>{l.get('codigo_lote')}</b> de la variedad <b>{l.get('variedad_nombre', '-')}</b> "
            f"con portainjerto <b>{l.get('portainjerto_nombre', '-')}</b> fue ingresado al sistema "
            f"con <b>{cantidad_inicial}</b> unidades. "
        )
        if consumido > 0:
            exec_summary += (
                f"Se han consumido <b>{consumido}</b> unidades ({pct_consumido}%), "
                f"quedando <b>{cantidad_actual}</b> unidades en stock. "
            )
        n_destinos = len(data["destinos"])
        n_plantas = len(data["plantas"])
        if n_destinos > 0:
            exec_summary += f"Se han realizado despachos a <b>{n_destinos}</b> testblock(s). "
        if n_plantas > 0:
            activas = sum(1 for p in data["plantas"] if p.get("activa"))
            exec_summary += f"Se crearon <b>{n_plantas}</b> plantas individuales (<b>{activas}</b> activas actualmente). "
        exec_summary += f"Estado actual del lote: <b>{l.get('estado', '-')}</b>."
        story.append(Paragraph(exec_summary, body_style))
        story.append(Spacer(1, 6))

        # Info table
        story.append(Paragraph("2. Informacion del Lote", h2_style))
        info = [
            ["Codigo", str(l.get("codigo_lote", "")), "Variedad", str(l.get("variedad_nombre", "-"))],
            ["Stock actual", str(cantidad_actual), "Stock inicial", str(cantidad_inicial)],
            ["Portainjerto", str(l.get("portainjerto_nombre", "-")), "Estado", str(l.get("estado", ""))],
            ["Fecha ingreso", str(l.get("fecha_ingreso", "-")), "Consumido", f"{consumido} ({pct_consumido}%)"],
        ]
        add_info_table(info, col_widths=[1.2 * inch, 1.8 * inch, 1.2 * inch, 1.8 * inch])

        # Kardex narrative
        movs = data["movimientos"]
        story.append(Paragraph(f"3. Kardex de Movimientos ({len(movs)} registros)", h2_style))
        if movs:
            # Type summary
            tipo_counts: dict[str, int] = {}
            tipo_cant: dict[str, int] = {}
            for m in movs:
                t = m.get("tipo", "?")
                c = m.get("cantidad", 0) or 0
                tipo_counts[t] = tipo_counts.get(t, 0) + 1
                tipo_cant[t] = tipo_cant.get(t, 0) + c

            parts = []
            for t, cnt in tipo_counts.items():
                parts.append(f"{cnt} de tipo <b>{t}</b> ({tipo_cant[t]} unidades)")
            story.append(Paragraph(
                f"El lote registra {len(movs)} movimientos: " + ", ".join(parts) + ".",
                body_style,
            ))

            mov_rows = [
                [
                    str(m.get("fecha_movimiento", "")),
                    str(m.get("tipo", "")),
                    str(m.get("cantidad", 0)),
                    str(m.get("saldo_anterior", "-")),
                    str(m.get("saldo_nuevo", "-")),
                    str(m.get("motivo", "") or "")[:50],
                ]
                for m in movs[:25]
            ]
            add_table(["Fecha", "Tipo", "Cantidad", "Saldo ant.", "Saldo nuevo", "Motivo"], mov_rows)

        # Destinos
        destinos = data["destinos"]
        story.append(Paragraph(f"4. Destinos — Despachos a TestBlocks ({len(destinos)})", h2_style))
        if destinos:
            dest_rows = [
                [
                    str(d.get("testblock_nombre", d.get("id_cuartel", "?"))),
                    str(d.get("cantidad_asignada", 0)),
                    str(d.get("cantidad_plantada", 0)),
                    str(d.get("estado", "")),
                ]
                for d in destinos
            ]
            add_table(["Destino", "Asignado", "Plantado", "Estado"], dest_rows)

        # Plantas
        plantas = data["plantas"]
        story.append(Paragraph(f"5. Plantas Individuales ({len(plantas)})", h2_style))
        if plantas:
            activas = sum(1 for p in plantas if p.get("activa"))
            inactivas = len(plantas) - activas
            story.append(Paragraph(
                f"De las {len(plantas)} plantas creadas desde este lote, "
                f"<b>{activas}</b> se encuentran activas y <b>{inactivas}</b> fueron dadas de baja.",
                body_style,
            ))
            plt_rows = [
                [
                    str(p.get("codigo", "")),
                    "Activa" if p.get("activa") else "Baja",
                    str(p.get("condicion", "")),
                    str(p.get("fecha_alta", "")),
                ]
                for p in plantas[:30]
            ]
            add_table(["Codigo", "Estado", "Condicion", "Fecha alta"], plt_rows)

    # ── TESTBLOCK PDF ─────────────────────────────────────────────────────
    elif tipo == "testblock":
        tb = data["testblock"]
        resumen = data.get("posiciones_resumen", {})
        total_pos = sum(resumen.values())
        variedades = data["variedades"]
        n_med = len(data["mediciones"])
        n_lab = len(data["labores"])

        # Executive summary
        story.append(Paragraph("1. Resumen Ejecutivo", h2_style))
        exec_summary = (
            f"El testblock <b>{tb.get('nombre')}</b> (codigo: {tb.get('codigo')}) ubicado en el campo "
            f"<b>{tb.get('campo_nombre', '-')}</b> cuenta con <b>{tb.get('num_hileras', '-')}</b> hileras "
            f"y un total de <b>{total_pos}</b> posiciones. "
        )
        n_alta = resumen.get("alta", 0)
        n_vacia = resumen.get("vacia", 0)
        n_baja = resumen.get("baja", 0)
        n_replante = resumen.get("replante", 0)
        exec_summary += (
            f"Actualmente <b>{n_alta}</b> posiciones estan en alta, <b>{n_vacia}</b> vacias, "
            f"<b>{n_baja}</b> en baja y <b>{n_replante}</b> en replante. "
        )
        if variedades:
            exec_summary += (
                f"Se encuentran plantadas <b>{len(variedades)}</b> variedades distintas. "
            )
        if n_med > 0:
            exec_summary += f"Se dispone de <b>{n_med}</b> mediciones de laboratorio. "
        if n_lab > 0:
            exec_summary += f"Se han ejecutado <b>{n_lab}</b> labores."
        story.append(Paragraph(exec_summary, body_style))
        story.append(Spacer(1, 6))

        # Info table
        story.append(Paragraph("2. Informacion del TestBlock", h2_style))
        info = [
            ["Codigo", str(tb.get("codigo", "")), "Campo", str(tb.get("campo_nombre", "-"))],
            ["Hileras", str(tb.get("num_hileras", "-")), "Posiciones totales", str(total_pos)],
            ["Estado", str(tb.get("estado", "-")), "Temporada", str(tb.get("temporada", "-"))],
        ]
        add_info_table(info, col_widths=[1.2 * inch, 1.8 * inch, 1.4 * inch, 1.6 * inch])

        # Position summary
        story.append(Paragraph("3. Estado de Posiciones", h2_style))
        pos_pcts = []
        for est, cnt in resumen.items():
            pct = round(cnt / total_pos * 100, 1) if total_pos else 0
            pos_pcts.append(f"{est}: {cnt} ({pct}%)")
        story.append(Paragraph(
            "Distribucion de posiciones por estado: " + ", ".join(pos_pcts) + ".",
            body_style,
        ))
        pos_rows = [[k, str(v), f"{round(v / total_pos * 100, 1) if total_pos else 0}%"] for k, v in resumen.items()]
        add_table(["Estado", "Cantidad", "%"], pos_rows)

        # Varieties (using plant data - fixed)
        story.append(Paragraph(f"4. Variedades Presentes ({len(variedades)})", h2_style))
        if variedades:
            top_3 = variedades[:3]
            top_desc = ", ".join([
                f"<b>{v.get('nombre', v.get('variedad', '?'))}</b> ({v['cantidad']} posiciones, {v.get('pct', 0)}%)"
                for v in top_3
            ])
            story.append(Paragraph(
                f"Las variedades predominantes son: {top_desc}. "
                f"En total se evaluan {len(variedades)} variedades en este testblock.",
                body_style,
            ))
            var_rows = [
                [
                    str(v.get("nombre", v.get("variedad", ""))),
                    str(v.get("cantidad", 0)),
                    f"{v.get('pct', 0):.1f}%",
                ]
                for v in variedades[:25]
            ]
            add_table(["Variedad", "Cantidad", "%"], var_rows)

        # Lab results
        story.append(Paragraph(f"5. Mediciones de Laboratorio ({n_med})", h2_style))
        if n_med > 0:
            brix_vals = [_safe_float(m["brix"]) for m in data["mediciones"] if _safe_float(m.get("brix")) is not None]
            firmeza_vals = [_safe_float(m["firmeza"]) for m in data["mediciones"] if _safe_float(m.get("firmeza")) is not None]
            calibre_vals = [_safe_float(m["calibre"]) for m in data["mediciones"] if _safe_float(m.get("calibre")) is not None]

            interp_parts = []
            if brix_vals:
                interp_parts.append(f"Brix promedio <b>{sum(brix_vals)/len(brix_vals):.1f}</b> ({min(brix_vals):.1f}-{max(brix_vals):.1f})")
            if firmeza_vals:
                interp_parts.append(f"Firmeza promedio <b>{sum(firmeza_vals)/len(firmeza_vals):.1f}</b> ({min(firmeza_vals):.1f}-{max(firmeza_vals):.1f})")
            if calibre_vals:
                interp_parts.append(f"Calibre promedio <b>{sum(calibre_vals)/len(calibre_vals):.1f}</b> mm ({min(calibre_vals):.1f}-{max(calibre_vals):.1f})")
            if interp_parts:
                story.append(Paragraph(
                    f"Las {n_med} mediciones registradas muestran: " + ", ".join(interp_parts) + ".",
                    body_style,
                ))

            med_rows = [
                [
                    str(m.get("fecha_medicion", "")),
                    str(m.get("temporada", "-")),
                    str(m.get("brix", "-")),
                    str(m.get("firmeza", "-")),
                    str(m.get("calibre", "-")),
                    str(m.get("acidez", "-")),
                ]
                for m in data["mediciones"][:25]
            ]
            add_table(["Fecha", "Temporada", "Brix", "Firmeza", "Calibre", "Acidez"], med_rows)

        # Labores
        story.append(Paragraph(f"6. Labores Ejecutadas ({n_lab})", h2_style))
        if n_lab > 0:
            story.append(Paragraph(
                f"Se han registrado <b>{n_lab}</b> labores en este testblock.",
                body_style,
            ))
            lab_rows = [
                [
                    str(lab.get("fecha_ejecucion", "")),
                    str(lab.get("ejecutor", "-")),
                    str(lab.get("duracion_min", "-")),
                    str(lab.get("estado", "")),
                    str(lab.get("observaciones", "") or "")[:50],
                ]
                for lab in data["labores"][:20]
            ]
            add_table(["Fecha", "Ejecutor", "Duracion (min)", "Estado", "Observaciones"], lab_rows)

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey, spaceAfter=6))
    story.append(Paragraph(
        "Reporte generado automaticamente por <b>Garces Fruit — Sistema de Segmentacion de Nuevas Especies</b>. "
        "Los datos reflejan el estado de la base de datos al momento de la generacion.",
        ParagraphStyle("Footer", parent=small, alignment=TA_CENTER),
    ))

    doc.build(story)
    buf.seek(0)

    filename = f"reporte_{tipo}_{id_entidad}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── PDF Report: Variedad Analysis (lab-focused) ──────────────────────────

@router.get("/variedad/{id_variedad}/pdf")
def report_variedad_pdf(
    id_variedad: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Generate a lab-analysis-focused PDF report for a variety.

    Sections:
    1. Variedad info (nombre, especie, PMG, origen, epoca, vigor)
    2. Summary metrics table (total mediciones, brix avg/min/max, firmeza, acidez, peso)
    3. Cluster distribution (C1/C2/C3/C4 counts & percentages) as colored boxes
    4. Per-temporada table (temporada, n_meds, brix_avg, firmeza_avg, acidez_avg, clusters)
    """
    from io import BytesIO
    from datetime import datetime as dt
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER

    # ── Fetch variedad ────────────────────────────────────────────────────
    variedad = db.query(Variedad).filter(Variedad.id_variedad == id_variedad).first()
    if not variedad:
        raise HTTPException(status_code=404, detail="Variedad no encontrada")

    especie_nombre = _resolve_name(db, Especie, Especie.id_especie, variedad.id_especie) or "-"
    pmg_nombre = _resolve_name(db, Pmg, Pmg.id_pmg, variedad.id_pmg) or "-"

    # ── Fetch all mediciones for this variedad via plants or direct FK ────
    from sqlalchemy import or_

    planta_ids = [
        r[0] for r in
        db.query(Planta.id_planta).filter(Planta.id_variedad == id_variedad).all()
    ]

    filters = []
    if planta_ids:
        filters.append(MedicionLaboratorio.id_planta.in_(planta_ids))
    filters.append(MedicionLaboratorio.id_variedad == id_variedad)

    mediciones = (
        db.query(MedicionLaboratorio)
        .filter(or_(*filters))
        .order_by(MedicionLaboratorio.fecha_medicion.desc())
        .all()
    )

    # ── Fetch cluster classifications ─────────────────────────────────────
    med_ids = [m.id_medicion for m in mediciones]
    cluster_map: dict[int, int | None] = {}
    if med_ids:
        clusters = (
            db.query(ClasificacionCluster.id_medicion, ClasificacionCluster.cluster)
            .filter(ClasificacionCluster.id_medicion.in_(med_ids))
            .all()
        )
        for cid, cl in clusters:
            cluster_map[cid] = cl

    # ── Compute summary metrics ───────────────────────────────────────────
    brix_vals = [float(m.brix) for m in mediciones if m.brix is not None]
    firmeza_vals = [float(m.firmeza) for m in mediciones if m.firmeza is not None]
    acidez_vals = [float(m.acidez) for m in mediciones if m.acidez is not None]
    peso_vals = [float(m.peso) for m in mediciones if m.peso is not None]

    def _avg(vals: list[float]) -> str:
        return f"{sum(vals) / len(vals):.1f}" if vals else "-"

    def _min(vals: list[float]) -> str:
        return f"{min(vals):.1f}" if vals else "-"

    def _max(vals: list[float]) -> str:
        return f"{max(vals):.1f}" if vals else "-"

    # Cluster distribution
    c_counts = {1: 0, 2: 0, 3: 0, 4: 0}
    for mid in med_ids:
        cl = cluster_map.get(mid)
        if cl and cl in c_counts:
            c_counts[cl] += 1
    total_classified = sum(c_counts.values())

    def _cpct(n: int) -> str:
        if total_classified == 0:
            return "0%"
        return f"{n / total_classified * 100:.1f}%"

    # ── Per-temporada breakdown ───────────────────────────────────────────
    temp_data: dict[str, list] = {}
    for m in mediciones:
        t = m.temporada or "Sin temporada"
        temp_data.setdefault(t, []).append(m)

    temporadas_sorted = sorted(temp_data.keys())

    # ── Build PDF ─────────────────────────────────────────────────────────
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.5 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    cherry = colors.HexColor("#8B1A1A")
    dark_green = colors.HexColor("#2D5F2D")

    title_style = ParagraphStyle(
        "TitleCherry", parent=styles["Title"], textColor=cherry, fontSize=18, spaceAfter=6,
    )
    h2_style = ParagraphStyle(
        "H2Cherry", parent=styles["Heading2"], textColor=cherry, fontSize=13,
        spaceBefore=14, spaceAfter=6,
    )
    normal = styles["Normal"]
    body_style = ParagraphStyle(
        "Body", parent=normal, fontSize=9, leading=13, spaceAfter=6,
    )
    small = ParagraphStyle("Small", parent=normal, fontSize=8, textColor=colors.gray)

    table_hdr_style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), cherry),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FFF5F5")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ])

    info_tbl_style = TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F5F0F0")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F5F0F0")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])

    story: list = []

    # Header
    story.append(Paragraph("Garces Fruit — Sistema de Segmentacion de Nuevas Especies", small))
    story.append(Paragraph(f"Reporte de Variedad — {variedad.nombre}", title_style))
    story.append(Paragraph(
        f"Generado: {dt.now().strftime('%d/%m/%Y %H:%M')} | Usuario: {user.username}",
        small,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=cherry, spaceAfter=10))

    # Section 1: Variedad info
    story.append(Paragraph("1. Informacion de la Variedad", h2_style))
    info_rows = [
        ["Nombre", str(variedad.nombre), "Codigo", str(variedad.codigo)],
        ["Especie", especie_nombre, "PMG", pmg_nombre],
        ["Epoca cosecha", str(variedad.epoca_cosecha or variedad.epoca or "-"), "Vigor", str(variedad.vigor or "-")],
        ["Origen", str(variedad.origen or "-"), "Estado", str(variedad.estado or "-")],
    ]
    t = Table(info_rows, colWidths=[1.2 * inch, 1.8 * inch, 1.2 * inch, 1.8 * inch])
    t.setStyle(info_tbl_style)
    story.append(t)
    story.append(Spacer(1, 8))

    # Section 2: Summary metrics
    story.append(Paragraph("2. Resumen de Metricas", h2_style))
    story.append(Paragraph(
        f"Total mediciones: <b>{len(mediciones)}</b>",
        body_style,
    ))
    metrics_data = [
        ["Metrica", "Promedio", "Minimo", "Maximo", "N"],
        ["Brix", _avg(brix_vals), _min(brix_vals), _max(brix_vals), str(len(brix_vals))],
        ["Firmeza", _avg(firmeza_vals), _min(firmeza_vals), _max(firmeza_vals), str(len(firmeza_vals))],
        ["Acidez", _avg(acidez_vals), _min(acidez_vals), _max(acidez_vals), str(len(acidez_vals))],
        ["Peso (g)", _avg(peso_vals), _min(peso_vals), _max(peso_vals), str(len(peso_vals))],
    ]
    mt = Table(metrics_data, colWidths=[1.2 * inch, 1.2 * inch, 1.0 * inch, 1.0 * inch, 0.8 * inch])
    mt.setStyle(table_hdr_style)
    story.append(mt)
    story.append(Spacer(1, 8))

    # Section 3: Cluster distribution
    story.append(Paragraph("3. Distribucion de Clusters", h2_style))
    if total_classified > 0:
        story.append(Paragraph(
            f"De las <b>{total_classified}</b> mediciones clasificadas, "
            f"<b>{c_counts[1] + c_counts[2]}</b> ({_cpct(c_counts[1] + c_counts[2])}) "
            f"pertenecen a C1+C2 (calidad superior) y "
            f"<b>{c_counts[3] + c_counts[4]}</b> ({_cpct(c_counts[3] + c_counts[4])}) "
            f"a C3+C4.",
            body_style,
        ))
    else:
        story.append(Paragraph("<i>Sin clasificaciones de cluster disponibles.</i>", body_style))

    # Cluster colored boxes as a table
    cl_colors = {
        1: colors.HexColor("#10b981"),
        2: colors.HexColor("#0ea5e9"),
        3: colors.HexColor("#f59e0b"),
        4: colors.HexColor("#ef4444"),
    }
    cl_names = {1: "C1 Premium", 2: "C2 Buena", 3: "C3 Regular", 4: "C4 Deficiente"}
    cl_header = [cl_names[i] for i in range(1, 5)]
    cl_counts_row = [f"{c_counts[i]}  ({_cpct(c_counts[i])})" for i in range(1, 5)]
    cl_table = Table([cl_header, cl_counts_row], colWidths=[1.5 * inch] * 4)
    cl_style = TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])
    # Color each column header cell
    for col_idx in range(4):
        cl_style.add("BACKGROUND", (col_idx, 0), (col_idx, 0), cl_colors[col_idx + 1])
        cl_style.add("TEXTCOLOR", (col_idx, 0), (col_idx, 0), colors.white)
    cl_table.setStyle(cl_style)
    story.append(cl_table)
    story.append(Spacer(1, 8))

    # Section 4: Per-temporada table
    story.append(Paragraph("4. Detalle por Temporada", h2_style))
    if temporadas_sorted:
        temp_header = ["Temporada", "N meds", "Brix avg", "Firmeza avg", "Acidez avg", "C1", "C2", "C3", "C4"]
        temp_rows = []
        for t_name in temporadas_sorted:
            t_meds = temp_data[t_name]
            t_brix = [float(m.brix) for m in t_meds if m.brix is not None]
            t_firmeza = [float(m.firmeza) for m in t_meds if m.firmeza is not None]
            t_acidez = [float(m.acidez) for m in t_meds if m.acidez is not None]
            # Cluster counts for this temporada
            t_cl = {1: 0, 2: 0, 3: 0, 4: 0}
            for m in t_meds:
                cl = cluster_map.get(m.id_medicion)
                if cl and cl in t_cl:
                    t_cl[cl] += 1
            temp_rows.append([
                t_name,
                str(len(t_meds)),
                _avg(t_brix),
                _avg(t_firmeza),
                _avg(t_acidez),
                str(t_cl[1]),
                str(t_cl[2]),
                str(t_cl[3]),
                str(t_cl[4]),
            ])
        temp_table_data = [temp_header] + temp_rows
        tt = Table(
            temp_table_data,
            colWidths=[1.1 * inch, 0.6 * inch, 0.7 * inch, 0.7 * inch, 0.7 * inch,
                        0.5 * inch, 0.5 * inch, 0.5 * inch, 0.5 * inch],
            repeatRows=1,
        )
        tt.setStyle(table_hdr_style)
        story.append(tt)
    else:
        story.append(Paragraph("<i>Sin datos por temporada.</i>", body_style))

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey, spaceAfter=6))
    footer_style = ParagraphStyle("Footer", parent=small, alignment=TA_CENTER)
    story.append(Paragraph(
        "Garces Fruit — Sistema de Segmentacion de Nuevas Especies",
        footer_style,
    ))

    doc.build(story)
    buf.seek(0)

    filename = f"variedad_{id_variedad}_{variedad.codigo}_{dt.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── PDF Report: Planta (lab history + cluster timeline) ───────────────────

@router.get("/planta/{id_planta}/pdf")
def report_planta_pdf(
    id_planta: int,
    db: Session = Depends(get_db),
):
    """Generate a PDF report for a single plant.

    Sections:
    1. Plant info (codigo, variedad, portainjerto, especie, PMG, position, testblock, dates, condition)
    2. Measurements table (all lab mediciones)
    3. Cluster history timeline
    4. Summary metrics (avg/min/max brix, firmeza, acidez, peso)
    """
    from io import BytesIO
    from datetime import datetime as dt
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER

    # ── Fetch planta ──────────────────────────────────────────────────────
    planta = db.query(Planta).filter(Planta.id_planta == id_planta).first()
    if not planta:
        raise HTTPException(status_code=404, detail="Planta no encontrada")

    # Resolve FK names
    variedad_nombre = _resolve_name(db, Variedad, Variedad.id_variedad, planta.id_variedad) or "-"
    especie_nombre = _resolve_name(db, Especie, Especie.id_especie, planta.id_especie) or "-"
    portainjerto_nombre = _resolve_name(db, Portainjerto, Portainjerto.id_portainjerto, planta.id_portainjerto) or "-"
    pmg_nombre = _resolve_name(db, Pmg, Pmg.id_pmg, planta.id_pmg) or "-"

    # Position and testblock info
    posicion_codigo = "-"
    testblock_nombre = "-"
    hilera_pos = "-"
    if planta.id_posicion:
        pos = db.query(PosicionTestBlock).filter(
            PosicionTestBlock.id_posicion == planta.id_posicion
        ).first()
        if pos:
            posicion_codigo = pos.codigo_unico or "-"
            hilera_pos = f"H{pos.hilera}-P{pos.posicion}"
            if pos.id_testblock:
                testblock_nombre = _resolve_name(
                    db, TestBlock, TestBlock.id_testblock, pos.id_testblock
                ) or "-"

    # ── Fetch mediciones ──────────────────────────────────────────────────
    mediciones = (
        db.query(MedicionLaboratorio)
        .filter(MedicionLaboratorio.id_planta == id_planta)
        .order_by(MedicionLaboratorio.fecha_medicion.asc())
        .all()
    )

    # ── Fetch cluster classifications ─────────────────────────────────────
    med_ids = [m.id_medicion for m in mediciones]
    cluster_map: dict[int, dict] = {}
    if med_ids:
        clusters = (
            db.query(ClasificacionCluster)
            .filter(ClasificacionCluster.id_medicion.in_(med_ids))
            .all()
        )
        for c in clusters:
            cluster_map[c.id_medicion] = {
                "cluster": c.cluster,
                "score": float(c.score_total) if c.score_total is not None else None,
                "fecha": c.fecha_calculo,
            }

    # ── Compute summary metrics ───────────────────────────────────────────
    brix_vals = [float(m.brix) for m in mediciones if m.brix is not None]
    firmeza_vals = [float(m.firmeza) for m in mediciones if m.firmeza is not None]
    acidez_vals = [float(m.acidez) for m in mediciones if m.acidez is not None]
    peso_vals = [float(m.peso) for m in mediciones if m.peso is not None]
    calibre_vals = [float(m.calibre) for m in mediciones if m.calibre is not None]

    def _avg(vals: list[float]) -> str:
        return f"{sum(vals) / len(vals):.1f}" if vals else "-"

    def _mn(vals: list[float]) -> str:
        return f"{min(vals):.1f}" if vals else "-"

    def _mx(vals: list[float]) -> str:
        return f"{max(vals):.1f}" if vals else "-"

    # ── Build PDF ─────────────────────────────────────────────────────────
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.5 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    cherry = colors.HexColor("#8B1A1A")

    title_style = ParagraphStyle(
        "TitleCherry", parent=styles["Title"], textColor=cherry, fontSize=18, spaceAfter=6,
    )
    h2_style = ParagraphStyle(
        "H2Cherry", parent=styles["Heading2"], textColor=cherry, fontSize=13,
        spaceBefore=14, spaceAfter=6,
    )
    normal = styles["Normal"]
    body_style = ParagraphStyle(
        "Body", parent=normal, fontSize=9, leading=13, spaceAfter=6,
    )
    small = ParagraphStyle("Small", parent=normal, fontSize=8, textColor=colors.gray)

    table_hdr_style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), cherry),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FFF5F5")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ])

    info_tbl_style = TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F5F0F0")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F5F0F0")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])

    story: list = []

    # Header
    story.append(Paragraph("Garces Fruit — Sistema de Segmentacion de Nuevas Especies", small))
    story.append(Paragraph(f"Reporte de Planta — {planta.codigo or f'#{id_planta}'}", title_style))
    story.append(Paragraph(
        f"Generado: {dt.now().strftime('%d/%m/%Y %H:%M')}",
        small,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=cherry, spaceAfter=10))

    # Section 1: Plant info
    story.append(Paragraph("1. Informacion de la Planta", h2_style))
    info_rows = [
        ["Codigo", str(planta.codigo or f"#{id_planta}"), "Variedad", variedad_nombre],
        ["Especie", especie_nombre, "Portainjerto", portainjerto_nombre],
        ["PMG", pmg_nombre, "Condicion", str(planta.condicion or "-")],
        ["TestBlock", testblock_nombre, "Posicion", posicion_codigo],
        ["Hilera/Pos", hilera_pos, "Activa", "Si" if planta.activa else "No"],
        ["Fecha alta", str(planta.fecha_alta or "-"), "Fecha baja", str(planta.fecha_baja or "-")],
    ]
    t = Table(info_rows, colWidths=[1.2 * inch, 1.8 * inch, 1.2 * inch, 1.8 * inch])
    t.setStyle(info_tbl_style)
    story.append(t)
    story.append(Spacer(1, 8))

    # Section 2: Measurements table
    story.append(Paragraph(f"2. Mediciones de Laboratorio ({len(mediciones)})", h2_style))
    if mediciones:
        med_header = ["Fecha", "Temporada", "Brix", "Firmeza", "Acidez", "Calibre", "Peso", "Cluster"]
        med_rows = []
        for m in mediciones:
            cl_info = cluster_map.get(m.id_medicion)
            cl_label = f"C{cl_info['cluster']}" if cl_info and cl_info["cluster"] else "-"
            med_rows.append([
                str(m.fecha_medicion or ""),
                str(m.temporada or "-"),
                str(m.brix if m.brix is not None else "-"),
                str(m.firmeza if m.firmeza is not None else "-"),
                str(m.acidez if m.acidez is not None else "-"),
                str(m.calibre if m.calibre is not None else "-"),
                str(m.peso if m.peso is not None else "-"),
                cl_label,
            ])
        med_table_data = [med_header] + med_rows
        mt = Table(
            med_table_data,
            colWidths=[0.85 * inch, 0.75 * inch, 0.6 * inch, 0.65 * inch,
                       0.6 * inch, 0.6 * inch, 0.6 * inch, 0.55 * inch],
            repeatRows=1,
        )
        mt.setStyle(table_hdr_style)
        story.append(mt)
    else:
        story.append(Paragraph("<i>Sin mediciones registradas para esta planta.</i>", body_style))
    story.append(Spacer(1, 8))

    # Section 3: Cluster history
    story.append(Paragraph("3. Historial de Clusters", h2_style))
    cluster_timeline = []
    for m in mediciones:
        cl_info = cluster_map.get(m.id_medicion)
        if cl_info and cl_info["cluster"]:
            cluster_timeline.append({
                "fecha_medicion": str(m.fecha_medicion or ""),
                "temporada": str(m.temporada or "-"),
                "cluster": cl_info["cluster"],
                "score": cl_info["score"],
                "fecha_calculo": cl_info["fecha"],
            })

    if cluster_timeline:
        cl_names = {1: "C1 Premium", 2: "C2 Buena", 3: "C3 Regular", 4: "C4 Deficiente"}
        cl_header = ["Fecha Medicion", "Temporada", "Cluster", "Score", "Fecha Calculo"]
        cl_rows = []
        for ct in cluster_timeline:
            cl_rows.append([
                ct["fecha_medicion"],
                ct["temporada"],
                cl_names.get(ct["cluster"], f"C{ct['cluster']}"),
                f"{ct['score']:.1f}" if ct["score"] is not None else "-",
                str(ct["fecha_calculo"] or "-")[:16],
            ])
        cl_table_data = [cl_header] + cl_rows
        clt = Table(
            cl_table_data,
            colWidths=[1.0 * inch, 0.9 * inch, 1.1 * inch, 0.8 * inch, 1.2 * inch],
            repeatRows=1,
        )
        clt.setStyle(table_hdr_style)
        story.append(clt)

        # Cluster distribution summary
        c_counts = {1: 0, 2: 0, 3: 0, 4: 0}
        for ct in cluster_timeline:
            cl = ct["cluster"]
            if cl in c_counts:
                c_counts[cl] += 1
        total_cl = sum(c_counts.values())

        cl_colors_map = {
            1: colors.HexColor("#10b981"),
            2: colors.HexColor("#0ea5e9"),
            3: colors.HexColor("#f59e0b"),
            4: colors.HexColor("#ef4444"),
        }
        cl_box_header = [cl_names[i] for i in range(1, 5)]
        cl_box_row = [
            f"{c_counts[i]}  ({c_counts[i] / total_cl * 100:.0f}%)" if total_cl > 0 else "0"
            for i in range(1, 5)
        ]
        cl_box_table = Table([cl_box_header, cl_box_row], colWidths=[1.5 * inch] * 4)
        cl_box_style = TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ])
        for col_idx in range(4):
            cl_box_style.add("BACKGROUND", (col_idx, 0), (col_idx, 0), cl_colors_map[col_idx + 1])
            cl_box_style.add("TEXTCOLOR", (col_idx, 0), (col_idx, 0), colors.white)
        cl_box_table.setStyle(cl_box_style)
        story.append(Spacer(1, 6))
        story.append(cl_box_table)
    else:
        story.append(Paragraph("<i>Sin clasificaciones de cluster disponibles.</i>", body_style))
    story.append(Spacer(1, 8))

    # Section 4: Summary metrics
    story.append(Paragraph("4. Resumen de Metricas", h2_style))
    if mediciones:
        story.append(Paragraph(
            f"Total mediciones: <b>{len(mediciones)}</b>",
            body_style,
        ))
        metrics_data = [
            ["Metrica", "Promedio", "Minimo", "Maximo", "N"],
            ["Brix", _avg(brix_vals), _mn(brix_vals), _mx(brix_vals), str(len(brix_vals))],
            ["Firmeza", _avg(firmeza_vals), _mn(firmeza_vals), _mx(firmeza_vals), str(len(firmeza_vals))],
            ["Acidez", _avg(acidez_vals), _mn(acidez_vals), _mx(acidez_vals), str(len(acidez_vals))],
            ["Calibre", _avg(calibre_vals), _mn(calibre_vals), _mx(calibre_vals), str(len(calibre_vals))],
            ["Peso (g)", _avg(peso_vals), _mn(peso_vals), _mx(peso_vals), str(len(peso_vals))],
        ]
        mst = Table(metrics_data, colWidths=[1.2 * inch, 1.2 * inch, 1.0 * inch, 1.0 * inch, 0.8 * inch])
        mst.setStyle(table_hdr_style)
        story.append(mst)
    else:
        story.append(Paragraph("<i>Sin datos suficientes para calcular metricas.</i>", body_style))

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey, spaceAfter=6))
    footer_style = ParagraphStyle("FooterPlanta", parent=small, alignment=TA_CENTER)
    story.append(Paragraph(
        "Garces Fruit — Sistema de Segmentacion de Nuevas Especies",
        footer_style,
    ))

    doc.build(story)
    buf.seek(0)

    codigo_safe = (planta.codigo or str(id_planta)).replace("/", "-")
    filename = f"planta_{id_planta}_{codigo_safe}_{dt.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── PDF Report: Lote (inventory lifecycle + quality) ──────────────────────

@router.get("/lote/{id_inventario}/pdf")
def report_lote_pdf(
    id_inventario: int,
    db: Session = Depends(get_db),
):
    """Generate a PDF report for an inventory lot (lote de vivero).

    Sections:
    1. Lote info (codigo, variedad, portainjerto, especie, vivero, stock, estado)
    2. Plants table (all plants created from this lot)
    3. Quality summary (aggregate brix/firmeza/acidez + cluster distribution)
    4. Movements table (inventory kardex)
    """
    from io import BytesIO
    from datetime import datetime as dt
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER

    # ── Fetch lote ────────────────────────────────────────────────────────
    lote = db.query(InventarioVivero).filter(
        InventarioVivero.id_inventario == id_inventario
    ).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    # Resolve FK names
    variedad_nombre = _resolve_name(db, Variedad, Variedad.id_variedad, lote.id_variedad) or "-"
    especie_nombre = _resolve_name(db, Especie, Especie.id_especie, lote.id_especie) or "-"
    portainjerto_nombre = _resolve_name(db, Portainjerto, Portainjerto.id_portainjerto, lote.id_portainjerto) or "-"
    pmg_nombre = _resolve_name(db, Pmg, Pmg.id_pmg, lote.id_pmg) or "-"
    vivero_nombre = _resolve_name(db, Vivero, Vivero.id_vivero, lote.id_vivero) or "-"

    # ── Fetch plants from this lot ────────────────────────────────────────
    plantas = (
        db.query(Planta)
        .filter(Planta.id_lote_origen == id_inventario)
        .order_by(Planta.fecha_alta.asc())
        .all()
    )

    # Resolve testblock names for each plant's position
    plantas_info = []
    planta_ids = []
    for pl in plantas:
        planta_ids.append(pl.id_planta)
        pos_codigo = "-"
        tb_nombre = "-"
        if pl.id_posicion:
            pos = db.query(PosicionTestBlock).filter(
                PosicionTestBlock.id_posicion == pl.id_posicion
            ).first()
            if pos:
                pos_codigo = pos.codigo_unico or f"H{pos.hilera}-P{pos.posicion}"
                if pos.id_testblock:
                    tb_nombre = _resolve_name(
                        db, TestBlock, TestBlock.id_testblock, pos.id_testblock
                    ) or "-"
        plantas_info.append({
            "codigo": pl.codigo or f"#{pl.id_planta}",
            "posicion": pos_codigo,
            "testblock": tb_nombre,
            "estado": "Activa" if pl.activa else "Baja",
            "condicion": pl.condicion or "-",
            "fecha_alta": str(pl.fecha_alta or "-"),
        })

    # ── Fetch mediciones for quality summary ──────────────────────────────
    mediciones = []
    cluster_map: dict[int, int | None] = {}
    if planta_ids:
        mediciones = (
            db.query(MedicionLaboratorio)
            .filter(MedicionLaboratorio.id_planta.in_(planta_ids))
            .order_by(MedicionLaboratorio.fecha_medicion.desc())
            .all()
        )
        med_ids = [m.id_medicion for m in mediciones]
        if med_ids:
            clusters = (
                db.query(ClasificacionCluster.id_medicion, ClasificacionCluster.cluster)
                .filter(ClasificacionCluster.id_medicion.in_(med_ids))
                .all()
            )
            for cid, cl in clusters:
                cluster_map[cid] = cl

    # Summary metrics
    brix_vals = [float(m.brix) for m in mediciones if m.brix is not None]
    firmeza_vals = [float(m.firmeza) for m in mediciones if m.firmeza is not None]
    acidez_vals = [float(m.acidez) for m in mediciones if m.acidez is not None]
    peso_vals = [float(m.peso) for m in mediciones if m.peso is not None]

    def _avg(vals: list[float]) -> str:
        return f"{sum(vals) / len(vals):.1f}" if vals else "-"

    def _mn(vals: list[float]) -> str:
        return f"{min(vals):.1f}" if vals else "-"

    def _mx(vals: list[float]) -> str:
        return f"{max(vals):.1f}" if vals else "-"

    # Cluster counts
    c_counts = {1: 0, 2: 0, 3: 0, 4: 0}
    for mid in [m.id_medicion for m in mediciones]:
        cl = cluster_map.get(mid)
        if cl and cl in c_counts:
            c_counts[cl] += 1
    total_classified = sum(c_counts.values())

    def _cpct(n: int) -> str:
        if total_classified == 0:
            return "0%"
        return f"{n / total_classified * 100:.1f}%"

    # ── Fetch movements ───────────────────────────────────────────────────
    movimientos = (
        db.query(MovimientoInventario)
        .filter(MovimientoInventario.id_inventario == id_inventario)
        .order_by(MovimientoInventario.fecha_movimiento.desc())
        .all()
    )

    # ── Build PDF ─────────────────────────────────────────────────────────
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.5 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    cherry = colors.HexColor("#8B1A1A")

    title_style = ParagraphStyle(
        "TitleCherry", parent=styles["Title"], textColor=cherry, fontSize=18, spaceAfter=6,
    )
    h2_style = ParagraphStyle(
        "H2Cherry", parent=styles["Heading2"], textColor=cherry, fontSize=13,
        spaceBefore=14, spaceAfter=6,
    )
    normal = styles["Normal"]
    body_style = ParagraphStyle(
        "Body", parent=normal, fontSize=9, leading=13, spaceAfter=6,
    )
    small = ParagraphStyle("Small", parent=normal, fontSize=8, textColor=colors.gray)

    table_hdr_style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), cherry),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FFF5F5")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ])

    info_tbl_style = TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F5F0F0")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F5F0F0")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])

    story: list = []

    # Header
    story.append(Paragraph("Garces Fruit — Sistema de Segmentacion de Nuevas Especies", small))
    story.append(Paragraph(f"Reporte de Lote — {lote.codigo_lote}", title_style))
    story.append(Paragraph(
        f"Generado: {dt.now().strftime('%d/%m/%Y %H:%M')}",
        small,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=cherry, spaceAfter=10))

    # Section 1: Lote info
    story.append(Paragraph("1. Informacion del Lote", h2_style))
    utilization = "-"
    if lote.cantidad_inicial and lote.cantidad_inicial > 0:
        used = lote.cantidad_inicial - lote.cantidad_actual
        utilization = f"{used / lote.cantidad_inicial * 100:.0f}%"
    info_rows = [
        ["Codigo Lote", str(lote.codigo_lote), "Variedad", variedad_nombre],
        ["Especie", especie_nombre, "Portainjerto", portainjerto_nombre],
        ["PMG", pmg_nombre, "Vivero", vivero_nombre],
        ["Cant. Inicial", str(lote.cantidad_inicial), "Cant. Actual", str(lote.cantidad_actual)],
        ["Utilizacion", utilization, "Estado", str(lote.estado or "-")],
        ["Fecha Ingreso", str(lote.fecha_ingreso or "-"), "Origen", str(lote.origen or "-")],
    ]
    t = Table(info_rows, colWidths=[1.2 * inch, 1.8 * inch, 1.2 * inch, 1.8 * inch])
    t.setStyle(info_tbl_style)
    story.append(t)
    story.append(Spacer(1, 8))

    # Section 2: Plants table
    story.append(Paragraph(f"2. Plantas Originadas ({len(plantas_info)})", h2_style))
    if plantas_info:
        n_activas = sum(1 for p in plantas_info if p["estado"] == "Activa")
        n_baja = len(plantas_info) - n_activas
        story.append(Paragraph(
            f"De este lote se originaron <b>{len(plantas_info)}</b> plantas: "
            f"<b>{n_activas}</b> activas y <b>{n_baja}</b> de baja.",
            body_style,
        ))
        pl_header = ["Codigo", "Posicion", "TestBlock", "Estado", "Condicion", "Fecha Alta"]
        pl_rows = [
            [p["codigo"], p["posicion"], p["testblock"], p["estado"], p["condicion"], p["fecha_alta"]]
            for p in plantas_info[:50]
        ]
        pl_table_data = [pl_header] + pl_rows
        plt_tbl = Table(
            pl_table_data,
            colWidths=[0.9 * inch, 0.85 * inch, 1.0 * inch, 0.65 * inch, 0.9 * inch, 0.9 * inch],
            repeatRows=1,
        )
        plt_tbl.setStyle(table_hdr_style)
        story.append(plt_tbl)
        if len(plantas_info) > 50:
            story.append(Paragraph(
                f"<i>Mostrando 50 de {len(plantas_info)} plantas.</i>",
                small,
            ))
    else:
        story.append(Paragraph("<i>No se han creado plantas a partir de este lote.</i>", body_style))
    story.append(Spacer(1, 8))

    # Section 3: Quality summary
    story.append(Paragraph("3. Resumen de Calidad", h2_style))
    if mediciones:
        story.append(Paragraph(
            f"Total mediciones en plantas de este lote: <b>{len(mediciones)}</b>",
            body_style,
        ))

        # Metrics table
        metrics_data = [
            ["Metrica", "Promedio", "Minimo", "Maximo", "N"],
            ["Brix", _avg(brix_vals), _mn(brix_vals), _mx(brix_vals), str(len(brix_vals))],
            ["Firmeza", _avg(firmeza_vals), _mn(firmeza_vals), _mx(firmeza_vals), str(len(firmeza_vals))],
            ["Acidez", _avg(acidez_vals), _mn(acidez_vals), _mx(acidez_vals), str(len(acidez_vals))],
            ["Peso (g)", _avg(peso_vals), _mn(peso_vals), _mx(peso_vals), str(len(peso_vals))],
        ]
        mst = Table(metrics_data, colWidths=[1.2 * inch, 1.2 * inch, 1.0 * inch, 1.0 * inch, 0.8 * inch])
        mst.setStyle(table_hdr_style)
        story.append(mst)
        story.append(Spacer(1, 6))

        # Cluster distribution
        if total_classified > 0:
            story.append(Paragraph(
                f"<b>{total_classified}</b> mediciones clasificadas — "
                f"C1+C2 (calidad superior): <b>{c_counts[1] + c_counts[2]}</b> ({_cpct(c_counts[1] + c_counts[2])}), "
                f"C3+C4: <b>{c_counts[3] + c_counts[4]}</b> ({_cpct(c_counts[3] + c_counts[4])})",
                body_style,
            ))
            cl_colors_map = {
                1: colors.HexColor("#10b981"),
                2: colors.HexColor("#0ea5e9"),
                3: colors.HexColor("#f59e0b"),
                4: colors.HexColor("#ef4444"),
            }
            cl_names = {1: "C1 Premium", 2: "C2 Buena", 3: "C3 Regular", 4: "C4 Deficiente"}
            cl_box_header = [cl_names[i] for i in range(1, 5)]
            cl_box_row = [f"{c_counts[i]}  ({_cpct(c_counts[i])})" for i in range(1, 5)]
            cl_box_table = Table([cl_box_header, cl_box_row], colWidths=[1.5 * inch] * 4)
            cl_box_style = TableStyle([
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ])
            for col_idx in range(4):
                cl_box_style.add("BACKGROUND", (col_idx, 0), (col_idx, 0), cl_colors_map[col_idx + 1])
                cl_box_style.add("TEXTCOLOR", (col_idx, 0), (col_idx, 0), colors.white)
            cl_box_table.setStyle(cl_box_style)
            story.append(cl_box_table)
        else:
            story.append(Paragraph("<i>Sin clasificaciones de cluster disponibles.</i>", body_style))
    else:
        story.append(Paragraph(
            "<i>Las plantas de este lote aun no tienen mediciones de laboratorio.</i>",
            body_style,
        ))
    story.append(Spacer(1, 8))

    # Section 4: Movements table
    story.append(Paragraph(f"4. Movimientos de Inventario ({len(movimientos)})", h2_style))
    if movimientos:
        mov_header = ["Fecha", "Tipo", "Cantidad", "Saldo Ant.", "Saldo Nuevo", "Motivo"]
        mov_rows = []
        for mv in movimientos:
            mov_rows.append([
                str(mv.fecha_movimiento or "")[:16],
                str(mv.tipo or "-"),
                str(mv.cantidad),
                str(mv.saldo_anterior if mv.saldo_anterior is not None else "-"),
                str(mv.saldo_nuevo if mv.saldo_nuevo is not None else "-"),
                str(mv.motivo or "")[:40],
            ])
        mov_table_data = [mov_header] + mov_rows[:30]
        mvt = Table(
            mov_table_data,
            colWidths=[1.1 * inch, 0.8 * inch, 0.7 * inch, 0.7 * inch, 0.7 * inch, 1.2 * inch],
            repeatRows=1,
        )
        mvt.setStyle(table_hdr_style)
        story.append(mvt)
        if len(movimientos) > 30:
            story.append(Paragraph(
                f"<i>Mostrando 30 de {len(movimientos)} movimientos.</i>",
                small,
            ))
    else:
        story.append(Paragraph("<i>Sin movimientos registrados para este lote.</i>", body_style))

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey, spaceAfter=6))
    footer_style = ParagraphStyle("FooterLote", parent=small, alignment=TA_CENTER)
    story.append(Paragraph(
        "Garces Fruit — Sistema de Segmentacion de Nuevas Especies",
        footer_style,
    ))

    doc.build(story)
    buf.seek(0)

    codigo_safe = lote.codigo_lote.replace("/", "-")
    filename = f"lote_{id_inventario}_{codigo_safe}_{dt.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
