"""Reporting routes: cross-entity reports with optional AI analysis."""

from fastapi import APIRouter, Depends, HTTPException, Query
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


# ── PDF Report: Evaluacion de Cosecha (Javiera-style) ─────────────────────

def _build_bar_chart(
    data: list[tuple[str, float]],
    width: float = 400,
    height: float = 160,
    bar_color: str = "#8B1A1A",
    title: str = "",
):
    """Build a simple bar chart using reportlab Drawing primitives.

    Args:
        data: list of (label, value) tuples.
        width/height: drawing dimensions in points.
        bar_color: hex color for bars.
        title: optional title displayed above chart.

    Returns:
        A reportlab Drawing object.
    """
    from reportlab.graphics.shapes import Drawing, Rect, String, Line
    from reportlab.lib import colors as rl_colors

    if not data:
        d = Drawing(width, 30)
        d.add(String(10, 10, "Sin datos", fontSize=9, fillColor=rl_colors.gray))
        return d

    max_val = max((v for _, v in data), default=1) or 1
    n = len(data)
    margin_left = 60
    margin_bottom = 40
    margin_top = 25 if title else 10
    margin_right = 20
    chart_w = width - margin_left - margin_right
    chart_h = height - margin_bottom - margin_top
    bar_w = max(chart_w / n * 0.65, 8)
    gap = chart_w / n
    fill = rl_colors.HexColor(bar_color)

    d = Drawing(width, height)

    # Title
    if title:
        d.add(String(
            width / 2, height - 12, title,
            fontSize=9, fontName="Helvetica-Bold",
            fillColor=rl_colors.HexColor("#333333"), textAnchor="middle",
        ))

    # Y-axis line
    d.add(Line(
        margin_left, margin_bottom, margin_left, height - margin_top,
        strokeColor=rl_colors.HexColor("#CCCCCC"), strokeWidth=0.5,
    ))
    # X-axis line
    d.add(Line(
        margin_left, margin_bottom, width - margin_right, margin_bottom,
        strokeColor=rl_colors.HexColor("#CCCCCC"), strokeWidth=0.5,
    ))

    # Y-axis ticks (5 levels)
    for i in range(6):
        y_val = max_val * i / 5
        y_pos = margin_bottom + chart_h * i / 5
        d.add(String(
            margin_left - 5, y_pos - 3, f"{y_val:.0f}",
            fontSize=7, fillColor=rl_colors.gray, textAnchor="end",
        ))
        if i > 0:
            d.add(Line(
                margin_left, y_pos, width - margin_right, y_pos,
                strokeColor=rl_colors.HexColor("#EEEEEE"), strokeWidth=0.3,
            ))

    # Bars + labels
    for idx, (label, val) in enumerate(data):
        x = margin_left + idx * gap + (gap - bar_w) / 2
        bar_h = (val / max_val) * chart_h if max_val > 0 else 0
        d.add(Rect(
            x, margin_bottom, bar_w, bar_h,
            fillColor=fill, strokeColor=None,
        ))
        # Value on top of bar
        d.add(String(
            x + bar_w / 2, margin_bottom + bar_h + 3, f"{val:.1f}",
            fontSize=6, fillColor=rl_colors.HexColor("#333333"), textAnchor="middle",
        ))
        # Label below
        truncated = label[:8] + ".." if len(label) > 10 else label
        d.add(String(
            x + bar_w / 2, margin_bottom - 12, truncated,
            fontSize=6, fillColor=rl_colors.HexColor("#333333"), textAnchor="middle",
        ))

    return d


def _build_stacked_bar_chart(
    categories: list[str],
    segments: list[tuple[str, str, list[float]]],
    width: float = 420,
    height: float = 160,
    title: str = "",
):
    """Build a horizontal stacked bar chart.

    Args:
        categories: labels for each bar (e.g. variety names).
        segments: list of (segment_name, hex_color, values_per_category).
        width/height: drawing dimensions.
        title: optional title.

    Returns:
        A reportlab Drawing object.
    """
    from reportlab.graphics.shapes import Drawing, Rect, String, Line
    from reportlab.lib import colors as rl_colors

    if not categories:
        d = Drawing(width, 30)
        d.add(String(10, 10, "Sin datos", fontSize=9, fillColor=rl_colors.gray))
        return d

    n = len(categories)
    margin_left = 80
    margin_bottom = 30
    margin_top = 30 if title else 12
    margin_right = 20
    chart_w = width - margin_left - margin_right
    row_h = min((height - margin_bottom - margin_top) / n, 24)
    bar_h = row_h * 0.7

    actual_height = margin_bottom + margin_top + n * row_h + 20
    d = Drawing(width, actual_height)

    if title:
        d.add(String(
            width / 2, actual_height - 12, title,
            fontSize=9, fontName="Helvetica-Bold",
            fillColor=rl_colors.HexColor("#333333"), textAnchor="middle",
        ))

    # Compute totals per category for scaling
    totals = []
    for cat_idx in range(n):
        t = sum(seg_vals[cat_idx] for _, _, seg_vals in segments if cat_idx < len(seg_vals))
        totals.append(t)
    max_total = max(totals) if totals else 1
    if max_total == 0:
        max_total = 1

    for cat_idx, cat_label in enumerate(categories):
        y_base = margin_bottom + (n - 1 - cat_idx) * row_h
        # Category label
        truncated = cat_label[:12] + ".." if len(cat_label) > 14 else cat_label
        d.add(String(
            margin_left - 5, y_base + bar_h / 2 - 3, truncated,
            fontSize=7, fillColor=rl_colors.HexColor("#333333"), textAnchor="end",
        ))
        x_offset = margin_left
        for seg_name, seg_color, seg_vals in segments:
            val = seg_vals[cat_idx] if cat_idx < len(seg_vals) else 0
            seg_w = (val / max_total) * chart_w if max_total > 0 else 0
            if seg_w > 0.5:
                d.add(Rect(
                    x_offset, y_base, seg_w, bar_h,
                    fillColor=rl_colors.HexColor(seg_color), strokeColor=None,
                ))
                if seg_w > 18:
                    d.add(String(
                        x_offset + seg_w / 2, y_base + bar_h / 2 - 3,
                        f"{val:.0f}%",
                        fontSize=5, fillColor=rl_colors.white, textAnchor="middle",
                    ))
            x_offset += seg_w

    # Legend at bottom
    legend_x = margin_left
    for seg_name, seg_color, _ in segments:
        d.add(Rect(
            legend_x, 4, 8, 8,
            fillColor=rl_colors.HexColor(seg_color), strokeColor=None,
        ))
        d.add(String(
            legend_x + 11, 4, seg_name,
            fontSize=6, fillColor=rl_colors.HexColor("#555555"),
        ))
        legend_x += len(seg_name) * 4.5 + 22

    return d


def _fetch_mediciones_for_variedad(
    db: Session,
    id_variedad: int,
    temporada: str | None = None,
    id_campo: int | None = None,
) -> list:
    """Fetch lab mediciones for a variedad, optionally filtered by temporada/campo.

    Returns a list of MedicionLaboratorio ORM objects.
    """
    from sqlalchemy import or_

    # Get plant IDs for this variety
    planta_ids = [
        r[0] for r in
        db.query(Planta.id_planta).filter(Planta.id_variedad == id_variedad).all()
    ]

    filters = []
    if planta_ids:
        filters.append(MedicionLaboratorio.id_planta.in_(planta_ids))
    filters.append(MedicionLaboratorio.id_variedad == id_variedad)

    q = db.query(MedicionLaboratorio).filter(or_(*filters))

    if temporada:
        q = q.filter(MedicionLaboratorio.temporada == temporada)
    if id_campo:
        q = q.filter(MedicionLaboratorio.id_campo == id_campo)

    return q.order_by(MedicionLaboratorio.fecha_cosecha.desc()).all()


def _compute_variety_stats(mediciones: list) -> dict:
    """Compute aggregate statistics for a set of mediciones.

    Returns a dict with averages, distributions, and sub-metrics for
    firmeza by position, color coverage, and color background.
    """

    def _avg(vals):
        return sum(vals) / len(vals) if vals else None

    def _safe(v):
        if v is None:
            return None
        try:
            return float(v)
        except (ValueError, TypeError):
            return None

    n = len(mediciones)

    # Basic metrics
    peso_vals = [_safe(m.peso) for m in mediciones if _safe(m.peso) is not None]
    brix_vals = [_safe(m.brix) for m in mediciones if _safe(m.brix) is not None]
    acidez_vals = [_safe(m.acidez) for m in mediciones if _safe(m.acidez) is not None]
    calibre_vals = [_safe(m.calibre) for m in mediciones if _safe(m.calibre) is not None]
    firmeza_vals = [_safe(m.firmeza) for m in mediciones if _safe(m.firmeza) is not None]

    # Firmeza detallada
    f_punta = [_safe(m.firmeza_punta) for m in mediciones if _safe(m.firmeza_punta) is not None]
    f_quilla = [_safe(m.firmeza_quilla) for m in mediciones if _safe(m.firmeza_quilla) is not None]
    f_hombro = [_safe(m.firmeza_hombro) for m in mediciones if _safe(m.firmeza_hombro) is not None]
    f_mejilla1 = [_safe(m.firmeza_mejilla_1) for m in mediciones if _safe(m.firmeza_mejilla_1) is not None]
    f_mejilla2 = [_safe(m.firmeza_mejilla_2) for m in mediciones if _safe(m.firmeza_mejilla_2) is not None]

    # Color cubrimiento distribution (sum across mediciones, then compute %)
    c_0_30 = [_safe(m.color_0_30) for m in mediciones if _safe(m.color_0_30) is not None]
    c_30_50 = [_safe(m.color_30_50) for m in mediciones if _safe(m.color_30_50) is not None]
    c_50_75 = [_safe(m.color_50_75) for m in mediciones if _safe(m.color_50_75) is not None]
    c_75_100 = [_safe(m.color_75_100) for m in mediciones if _safe(m.color_75_100) is not None]

    # Color de fondo distribution
    c_verde = [_safe(m.color_verde) for m in mediciones if _safe(m.color_verde) is not None]
    c_crema = [_safe(m.color_crema) for m in mediciones if _safe(m.color_crema) is not None]
    c_amarillo = [_safe(m.color_amarillo) for m in mediciones if _safe(m.color_amarillo) is not None]
    c_full = [_safe(m.color_full) for m in mediciones if _safe(m.color_full) is not None]

    # Calibre distribution for bar chart (group by bins)
    calibre_bins = {"<24": 0, "24-26": 0, "26-28": 0, "28-30": 0, "30-32": 0, ">32": 0}
    for c in calibre_vals:
        if c < 24:
            calibre_bins["<24"] += 1
        elif c < 26:
            calibre_bins["24-26"] += 1
        elif c < 28:
            calibre_bins["26-28"] += 1
        elif c < 30:
            calibre_bins["28-30"] += 1
        elif c < 32:
            calibre_bins["30-32"] += 1
        else:
            calibre_bins[">32"] += 1

    # Collect harvest dates
    fechas = set()
    for m in mediciones:
        if m.fecha_cosecha:
            fechas.add(str(m.fecha_cosecha))

    return {
        "n": n,
        "peso_avg": _avg(peso_vals),
        "brix_avg": _avg(brix_vals),
        "acidez_avg": _avg(acidez_vals),
        "calibre_avg": _avg(calibre_vals),
        "firmeza_avg": _avg(firmeza_vals),
        "firmeza_punta_avg": _avg(f_punta),
        "firmeza_quilla_avg": _avg(f_quilla),
        "firmeza_hombro_avg": _avg(f_hombro),
        "firmeza_mejilla1_avg": _avg(f_mejilla1),
        "firmeza_mejilla2_avg": _avg(f_mejilla2),
        "color_0_30_avg": _avg(c_0_30),
        "color_30_50_avg": _avg(c_30_50),
        "color_50_75_avg": _avg(c_50_75),
        "color_75_100_avg": _avg(c_75_100),
        "color_verde_avg": _avg(c_verde),
        "color_crema_avg": _avg(c_crema),
        "color_amarillo_avg": _avg(c_amarillo),
        "color_full_avg": _avg(c_full),
        "calibre_bins": calibre_bins,
        "fechas_cosecha": sorted(fechas),
    }


def _fmt(val, decimals=1) -> str:
    """Format a float value or return '-' if None."""
    if val is None:
        return "-"
    return f"{val:.{decimals}f}"


@router.get("/evaluacion-cosecha/pdf")
def report_evaluacion_cosecha_pdf(
    variedad_ids: str = Query(..., description="Comma-separated variedad IDs"),
    temporada: str = Query(None, description="Filtrar por temporada"),
    campo: int = Query(None, description="Filtrar por id_campo"),
    incluir_ia: bool = Query(True, description="Incluir analisis AI"),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Generate a professional PDF report styled after the Javiera reference.

    Produces a harvest evaluation report with per-variety sections including:
    context table, parameters table, color coverage, color background,
    calibre distribution chart, color distribution chart, and optional
    AI-generated interpretive analysis.
    """
    from io import BytesIO
    from datetime import datetime as dt
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, PageBreak,
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY

    # Parse variedad_ids
    try:
        var_id_list = [int(x.strip()) for x in variedad_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="variedad_ids debe ser IDs separados por comas")

    if not var_id_list:
        raise HTTPException(status_code=400, detail="Debe indicar al menos un id de variedad")

    if len(var_id_list) > 30:
        raise HTTPException(status_code=400, detail="Maximo 30 variedades por reporte")

    # Fetch variedad records
    variedades_db = db.query(Variedad).filter(Variedad.id_variedad.in_(var_id_list)).all()
    if not variedades_db:
        raise HTTPException(status_code=404, detail="No se encontraron variedades con los IDs proporcionados")

    # Build variedad map {id -> Variedad}
    var_map = {v.id_variedad: v for v in variedades_db}

    # Fetch mediciones and stats per variedad
    var_data: list[dict] = []
    for vid in var_id_list:
        v = var_map.get(vid)
        if not v:
            continue
        meds = _fetch_mediciones_for_variedad(db, vid, temporada, campo)
        stats = _compute_variety_stats(meds)
        especie_nombre = _resolve_name(db, Especie, Especie.id_especie, v.id_especie) or "-"
        pmg_nombre = _resolve_name(db, Pmg, Pmg.id_pmg, v.id_pmg) or "-"

        # Resolve campo name if available from mediciones
        campo_nombres = set()
        for m in meds:
            if m.id_campo:
                cn = _resolve_name(db, Campo, Campo.id_campo, m.id_campo)
                if cn:
                    campo_nombres.add(cn)

        # Resolve portainjerto from plants
        portainjerto_nombres = set()
        planta_rows = db.query(Planta).filter(Planta.id_variedad == vid).all()
        for p in planta_rows:
            if p.id_portainjerto:
                pn = _resolve_name(db, Portainjerto, Portainjerto.id_portainjerto, p.id_portainjerto)
                if pn:
                    portainjerto_nombres.add(pn)

        var_data.append({
            "id": vid,
            "variedad": v,
            "nombre": v.nombre,
            "especie": especie_nombre,
            "pmg": pmg_nombre,
            "campos": ", ".join(sorted(campo_nombres)) or "-",
            "portainjertos": ", ".join(sorted(portainjerto_nombres)) or "-",
            "mediciones": meds,
            "stats": stats,
        })

    if not var_data:
        raise HTTPException(status_code=404, detail="No se encontraron datos para las variedades indicadas")

    # Determine especie from first variedad for the title
    especie_title = var_data[0]["especie"]

    # ── Build PDF ─────────────────────────────────────────────────────────
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        topMargin=0.5 * inch, bottomMargin=0.7 * inch,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
    )
    styles = getSampleStyleSheet()

    # Colors
    cherry = colors.HexColor("#8B1A1A")
    cherry_light = colors.HexColor("#C45050")
    dark_green = colors.HexColor("#2D5F2D")
    bg_cream = colors.HexColor("#FFF8F0")
    bg_light_red = colors.HexColor("#FFF5F5")

    # Styles
    title_style = ParagraphStyle(
        "ECTitle", parent=styles["Title"], textColor=cherry,
        fontSize=20, spaceAfter=4, fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "ECSubtitle", parent=styles["Normal"], textColor=colors.HexColor("#555555"),
        fontSize=11, spaceAfter=2,
    )
    h2_style = ParagraphStyle(
        "ECH2", parent=styles["Heading2"], textColor=cherry,
        fontSize=13, spaceBefore=14, spaceAfter=6,
    )
    h3_style = ParagraphStyle(
        "ECH3", parent=styles["Heading3"], textColor=dark_green,
        fontSize=11, spaceBefore=10, spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "ECBody", parent=styles["Normal"], fontSize=9,
        leading=13, alignment=TA_JUSTIFY, spaceAfter=6,
    )
    small = ParagraphStyle(
        "ECSmall", parent=styles["Normal"], fontSize=8, textColor=colors.gray,
    )
    footer_style = ParagraphStyle(
        "ECFooter", parent=styles["Normal"], fontSize=8,
        textColor=colors.HexColor("#666666"), alignment=TA_CENTER,
    )
    ai_style = ParagraphStyle(
        "ECAI", parent=styles["Normal"], fontSize=9,
        leading=13, alignment=TA_JUSTIFY, spaceAfter=4,
        leftIndent=8, rightIndent=8,
    )

    # Table styles
    context_table_style = TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F5F0F0")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ])

    params_header_style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), cherry),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, bg_light_red]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ])

    story: list = []

    # ── Page 1: Title / Header ────────────────────────────────────────────
    story.append(Paragraph(
        "Garces Fruit — Departamento Desarrollo Varietal y Genetico",
        small,
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Evaluacion de {especie_title}", title_style))
    temporada_label = f"Temporada {temporada}" if temporada else "Todas las temporadas"
    campo_nombre_label = ""
    if campo:
        campo_nombre_label = _resolve_name(db, Campo, Campo.id_campo, campo) or f"Campo #{campo}"
    story.append(Paragraph(
        f"{temporada_label}"
        + (f" | {campo_nombre_label}" if campo_nombre_label else "")
        + f" | {len(var_data)} variedad(es)",
        subtitle_style,
    ))
    story.append(Paragraph(
        f"Generado: {dt.now().strftime('%d/%m/%Y %H:%M')} | Usuario: {user.username}",
        small,
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=cherry, spaceAfter=12))

    # ── Per-variety sections ──────────────────────────────────────────────
    for var_idx, vd in enumerate(var_data):
        if var_idx > 0:
            story.append(PageBreak())

        stats = vd["stats"]
        v = vd["variedad"]

        # Variety section header
        story.append(Paragraph(
            f"Variedad: {vd['nombre']}",
            h2_style,
        ))

        # Context table
        story.append(Paragraph("Informacion de contexto", h3_style))
        fechas_str = ", ".join(stats["fechas_cosecha"][:5]) if stats["fechas_cosecha"] else "-"
        context_rows = [
            ["Variedad", str(vd["nombre"])],
            ["Especie", str(vd["especie"])],
            ["PMG", str(vd["pmg"])],
            ["Campo / Localidad", str(vd["campos"])],
            ["Portainjerto", str(vd["portainjertos"])],
            ["Fecha(s) de cosecha", fechas_str],
            ["N mediciones", str(stats["n"])],
        ]
        ctx_t = Table(context_rows, colWidths=[1.6 * inch, 4.5 * inch])
        ctx_t.setStyle(context_table_style)
        story.append(ctx_t)
        story.append(Spacer(1, 8))

        # Parameters table
        story.append(Paragraph("Parametros de calidad", h3_style))
        params_data = [
            ["Parametro", "Promedio", "Unidad"],
            ["Peso", _fmt(stats["peso_avg"]), "g"],
            ["Calibre", _fmt(stats["calibre_avg"]), "mm"],
            ["Firmeza (general)", _fmt(stats["firmeza_avg"]), "lb"],
            ["Firmeza Punta", _fmt(stats["firmeza_punta_avg"]), "lb"],
            ["Firmeza Quilla", _fmt(stats["firmeza_quilla_avg"]), "lb"],
            ["Firmeza Hombro", _fmt(stats["firmeza_hombro_avg"]), "lb"],
            ["Firmeza Mejilla 1", _fmt(stats["firmeza_mejilla1_avg"]), "lb"],
            ["Firmeza Mejilla 2", _fmt(stats["firmeza_mejilla2_avg"]), "lb"],
            ["Solidos solubles (Brix)", _fmt(stats["brix_avg"]), "%"],
            ["Acidez", _fmt(stats["acidez_avg"], 2), "%"],
        ]
        p_t = Table(params_data, colWidths=[2.2 * inch, 1.5 * inch, 1.0 * inch])
        p_t.setStyle(params_header_style)
        story.append(p_t)
        story.append(Spacer(1, 8))

        # Color de cubrimiento table
        story.append(Paragraph("Color de cubrimiento (%)", h3_style))
        color_cub_data = [
            ["Rango", "0 - 30%", "30 - 50%", "50 - 75%", "75 - 100%"],
            [
                "Promedio (%)",
                _fmt(stats["color_0_30_avg"]),
                _fmt(stats["color_30_50_avg"]),
                _fmt(stats["color_50_75_avg"]),
                _fmt(stats["color_75_100_avg"]),
            ],
        ]
        cc_t = Table(color_cub_data, colWidths=[1.2 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch])
        cc_style = TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), cherry),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("BACKGROUND", (0, 1), (0, 1), colors.HexColor("#F5F0F0")),
            ("FONTNAME", (0, 1), (0, 1), "Helvetica-Bold"),
        ])
        cc_t.setStyle(cc_style)
        story.append(cc_t)
        story.append(Spacer(1, 8))

        # Color de fondo table
        story.append(Paragraph("Color de fondo (%)", h3_style))
        color_fondo_data = [
            ["Categoria", "Verde", "Verde-amarillo", "Amarillo", "Full"],
            [
                "Promedio (%)",
                _fmt(stats["color_verde_avg"]),
                _fmt(stats["color_crema_avg"]),
                _fmt(stats["color_amarillo_avg"]),
                _fmt(stats["color_full_avg"]),
            ],
        ]
        cf_t = Table(color_fondo_data, colWidths=[1.2 * inch, 1.2 * inch, 1.4 * inch, 1.2 * inch, 1.0 * inch])
        cf_style = TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), dark_green),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("BACKGROUND", (0, 1), (0, 1), colors.HexColor("#F0F5F0")),
            ("FONTNAME", (0, 1), (0, 1), "Helvetica-Bold"),
        ])
        cf_t.setStyle(cf_style)
        story.append(cf_t)
        story.append(Spacer(1, 10))

        # Calibre distribution chart
        story.append(Paragraph("Distribucion de calibre", h3_style))
        calibre_chart_data = [
            (label, float(count))
            for label, count in stats["calibre_bins"].items()
        ]
        chart = _build_bar_chart(
            calibre_chart_data, width=420, height=150,
            bar_color="#8B1A1A",
            title=f"Calibre (mm) — {vd['nombre']}",
        )
        story.append(chart)
        story.append(Spacer(1, 10))

        # Color distribution chart (stacked horizontal)
        story.append(Paragraph("Distribucion de color", h3_style))
        cub_vals = [
            stats["color_0_30_avg"] or 0,
            stats["color_30_50_avg"] or 0,
            stats["color_50_75_avg"] or 0,
            stats["color_75_100_avg"] or 0,
        ]
        fondo_vals = [
            stats["color_verde_avg"] or 0,
            stats["color_crema_avg"] or 0,
            stats["color_amarillo_avg"] or 0,
            stats["color_full_avg"] or 0,
        ]

        # Simple bar chart for color coverage ranges
        color_chart_data = [
            ("0-30%", cub_vals[0]),
            ("30-50%", cub_vals[1]),
            ("50-75%", cub_vals[2]),
            ("75-100%", cub_vals[3]),
        ]
        color_chart = _build_bar_chart(
            color_chart_data, width=420, height=140,
            bar_color="#2D5F2D",
            title=f"Color cubrimiento — {vd['nombre']}",
        )
        story.append(color_chart)
        story.append(Spacer(1, 6))

        # Color de fondo bar chart
        fondo_chart_data = [
            ("Verde", fondo_vals[0]),
            ("Verd-Am", fondo_vals[1]),
            ("Amarillo", fondo_vals[2]),
            ("Full", fondo_vals[3]),
        ]
        fondo_chart = _build_bar_chart(
            fondo_chart_data, width=420, height=140,
            bar_color="#8B6914",
            title=f"Color de fondo — {vd['nombre']}",
        )
        story.append(fondo_chart)
        story.append(Spacer(1, 10))

    # ── AI Analysis section ───────────────────────────────────────────────
    if incluir_ia:
        story.append(PageBreak())
        story.append(Paragraph("Analisis Profesional (AI)", h2_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=cherry, spaceAfter=8))

        # Build context string for AI
        ai_context_parts = [
            f"EVALUACION DE COSECHA — {especie_title}",
            f"Temporada: {temporada_label}",
            f"Variedades evaluadas: {len(var_data)}",
            "",
        ]
        for vd in var_data:
            stats = vd["stats"]
            ai_context_parts.append(f"VARIEDAD: {vd['nombre']}")
            ai_context_parts.append(f"  Especie: {vd['especie']}, PMG: {vd['pmg']}")
            ai_context_parts.append(f"  Campo: {vd['campos']}, Portainjerto: {vd['portainjertos']}")
            ai_context_parts.append(f"  N mediciones: {stats['n']}")
            ai_context_parts.append(f"  Peso: {_fmt(stats['peso_avg'])} g")
            ai_context_parts.append(f"  Calibre: {_fmt(stats['calibre_avg'])} mm")
            ai_context_parts.append(f"  Firmeza general: {_fmt(stats['firmeza_avg'])} lb")
            ai_context_parts.append(
                f"  Firmeza detallada: Punta={_fmt(stats['firmeza_punta_avg'])}, "
                f"Quilla={_fmt(stats['firmeza_quilla_avg'])}, "
                f"Hombro={_fmt(stats['firmeza_hombro_avg'])}, "
                f"Mejilla1={_fmt(stats['firmeza_mejilla1_avg'])}, "
                f"Mejilla2={_fmt(stats['firmeza_mejilla2_avg'])}"
            )
            ai_context_parts.append(f"  Brix: {_fmt(stats['brix_avg'])} %")
            ai_context_parts.append(f"  Acidez: {_fmt(stats['acidez_avg'], 2)} %")
            ai_context_parts.append(
                f"  Color cubrimiento: 0-30%={_fmt(stats['color_0_30_avg'])}, "
                f"30-50%={_fmt(stats['color_30_50_avg'])}, "
                f"50-75%={_fmt(stats['color_50_75_avg'])}, "
                f"75-100%={_fmt(stats['color_75_100_avg'])}"
            )
            ai_context_parts.append(
                f"  Color fondo: Verde={_fmt(stats['color_verde_avg'])}, "
                f"Verde-am={_fmt(stats['color_crema_avg'])}, "
                f"Amarillo={_fmt(stats['color_amarillo_avg'])}, "
                f"Full={_fmt(stats['color_full_avg'])}"
            )
            ai_context_parts.append(
                f"  Calibre distrib: {stats['calibre_bins']}"
            )
            ai_context_parts.append("")

        ai_context = "\n".join(ai_context_parts)
        ai_question = (
            "Genera un analisis profesional de esta evaluacion de cosecha. "
            "Evalua la calidad de las variedades, compara entre ellas si hay mas de una, "
            "destaca fortalezas y debilidades, y da recomendaciones concretas."
        )

        try:
            ai_text = get_ai_analysis(ai_context, ai_question)
        except Exception as e:
            ai_text = f"Error al generar analisis AI: {str(e)[:200]}"

        # Render AI text as paragraphs (handle markdown-ish text)
        for line in ai_text.split("\n"):
            line = line.strip()
            if not line:
                story.append(Spacer(1, 4))
            elif line.startswith("## "):
                story.append(Paragraph(line[3:], h3_style))
            elif line.startswith("# "):
                story.append(Paragraph(line[2:], h2_style))
            elif line.startswith("**") and line.endswith("**"):
                story.append(Paragraph(f"<b>{line.strip('*')}</b>", ai_style))
            else:
                # Escape HTML-sensitive chars but keep <b>/<i> from markdown
                safe_line = (
                    line
                    .replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                )
                # Restore bold/italic markdown as HTML
                import re
                safe_line = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", safe_line)
                safe_line = re.sub(r"\*(.+?)\*", r"<i>\1</i>", safe_line)
                story.append(Paragraph(safe_line, ai_style))

    # ── Footer ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey, spaceAfter=6))
    story.append(Paragraph(
        "Departamento Desarrollo Varietal y Genetico — Garces Fruit",
        footer_style,
    ))

    doc.build(story)
    buf.seek(0)

    filename = f"evaluacion_cosecha_{especie_title}_{dt.now().strftime('%Y%m%d_%H%M')}.pdf"
    # Sanitize filename
    filename = filename.replace(" ", "_").replace("/", "-")
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── PDF Report: Resumen de Cosechas (summary table) ───────────────────────

@router.get("/resumen-cosechas/pdf")
def report_resumen_cosechas_pdf(
    variedad_ids: str = Query(..., description="Comma-separated variedad IDs"),
    temporada: str = Query(None, description="Filtrar por temporada"),
    campo: int = Query(None, description="Filtrar por id_campo"),
    incluir_ia: bool = Query(True, description="Incluir analisis AI"),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Generate a summary PDF with all varieties in one comparison table.

    Produces a single wide table grouped by Campo with columns for:
    harvest dates, color coverage ranges, color background categories,
    peso, firmeza by measurement point, brix, and acidez.
    Optionally includes AI-generated interpretive analysis.
    """
    from io import BytesIO
    from datetime import datetime as dt
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable,
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY

    # Parse variedad_ids
    try:
        var_id_list = [int(x.strip()) for x in variedad_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="variedad_ids debe ser IDs separados por comas")

    if not var_id_list:
        raise HTTPException(status_code=400, detail="Debe indicar al menos un id de variedad")

    if len(var_id_list) > 50:
        raise HTTPException(status_code=400, detail="Maximo 50 variedades por resumen")

    # Fetch variedad records
    variedades_db = db.query(Variedad).filter(Variedad.id_variedad.in_(var_id_list)).all()
    if not variedades_db:
        raise HTTPException(status_code=404, detail="No se encontraron variedades")

    var_map = {v.id_variedad: v for v in variedades_db}

    # Build data per variedad, grouped by campo
    campo_groups: dict[str, list[dict]] = {}  # campo_name -> list of variety data

    for vid in var_id_list:
        v = var_map.get(vid)
        if not v:
            continue
        meds = _fetch_mediciones_for_variedad(db, vid, temporada, campo)
        stats = _compute_variety_stats(meds)

        # Resolve campo names from mediciones
        campo_nombres = set()
        for m in meds:
            if m.id_campo:
                cn = _resolve_name(db, Campo, Campo.id_campo, m.id_campo)
                if cn:
                    campo_nombres.add(cn)
        campo_label = ", ".join(sorted(campo_nombres)) or "Sin campo"

        # Resolve portainjerto
        portainjerto_nombres = set()
        planta_rows = db.query(Planta).filter(Planta.id_variedad == vid).limit(20).all()
        for p in planta_rows:
            if p.id_portainjerto:
                pn = _resolve_name(db, Portainjerto, Portainjerto.id_portainjerto, p.id_portainjerto)
                if pn:
                    portainjerto_nombres.add(pn)

        row_data = {
            "nombre": v.nombre,
            "codigo": v.codigo,
            "portainjerto": ", ".join(sorted(portainjerto_nombres)) or "-",
            "stats": stats,
        }

        if campo_label not in campo_groups:
            campo_groups[campo_label] = []
        campo_groups[campo_label].append(row_data)

    if not campo_groups:
        raise HTTPException(status_code=404, detail="No se encontraron datos")

    # Determine especie from first variedad for the title
    first_var = var_map.get(var_id_list[0])
    especie_title = "-"
    if first_var:
        especie_title = _resolve_name(db, Especie, Especie.id_especie, first_var.id_especie) or "-"

    # ── Build PDF (landscape for wide table) ──────────────────────────────
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(letter),
        topMargin=0.4 * inch, bottomMargin=0.5 * inch,
        leftMargin=0.3 * inch, rightMargin=0.3 * inch,
    )
    styles = getSampleStyleSheet()

    cherry = colors.HexColor("#8B1A1A")
    dark_green = colors.HexColor("#2D5F2D")

    title_style = ParagraphStyle(
        "RSTitle", parent=styles["Title"], textColor=cherry,
        fontSize=16, spaceAfter=4, fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "RSSubtitle", parent=styles["Normal"], textColor=colors.HexColor("#555555"),
        fontSize=10, spaceAfter=2,
    )
    h2_style = ParagraphStyle(
        "RSH2", parent=styles["Heading2"], textColor=cherry,
        fontSize=12, spaceBefore=10, spaceAfter=4,
    )
    h3_style = ParagraphStyle(
        "RSH3", parent=styles["Heading3"], textColor=dark_green,
        fontSize=10, spaceBefore=8, spaceAfter=3,
    )
    body_style = ParagraphStyle(
        "RSBody", parent=styles["Normal"], fontSize=9,
        leading=12, alignment=TA_JUSTIFY, spaceAfter=4,
    )
    small = ParagraphStyle(
        "RSSmall", parent=styles["Normal"], fontSize=7, textColor=colors.gray,
    )
    footer_style = ParagraphStyle(
        "RSFooter", parent=styles["Normal"], fontSize=8,
        textColor=colors.HexColor("#666666"), alignment=TA_CENTER,
    )
    ai_style = ParagraphStyle(
        "RSAI", parent=styles["Normal"], fontSize=9,
        leading=13, alignment=TA_JUSTIFY, spaceAfter=4,
        leftIndent=8, rightIndent=8,
    )

    story: list = []

    # Header
    story.append(Paragraph(
        "Garces Fruit — Departamento Desarrollo Varietal y Genetico",
        small,
    ))
    story.append(Paragraph(f"Resumen de Cosechas — {especie_title}", title_style))
    temporada_label = f"Temporada {temporada}" if temporada else "Todas las temporadas"
    campo_nombre_label = ""
    if campo:
        campo_nombre_label = _resolve_name(db, Campo, Campo.id_campo, campo) or f"Campo #{campo}"
    story.append(Paragraph(
        f"{temporada_label}"
        + (f" | {campo_nombre_label}" if campo_nombre_label else "")
        + f" | {sum(len(v) for v in campo_groups.values())} variedad(es)",
        subtitle_style,
    ))
    story.append(Paragraph(
        f"Generado: {dt.now().strftime('%d/%m/%Y %H:%M')} | Usuario: {user.username}",
        small,
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=cherry, spaceAfter=10))

    # Build the wide summary table
    # Column headers (2 rows: group headers + sub-headers)
    header_row_1 = [
        "Campo", "Variedad", "Cosechas",
        "Color cubrimiento (%)", "", "", "",
        "Color fondo (%)", "", "", "",
        "Peso", "Firmeza (lb)", "", "", "", "",
        "Brix", "Acidez",
    ]
    header_row_2 = [
        "", "", "",
        "0-30", "30-50", "50-75", "75-100",
        "Verde", "Ver-Am", "Amar.", "Full",
        "(g)", "Punta", "Quilla", "Hombro", "Mej.1", "Mej.2",
        "(%)", "(%)",
    ]

    # Column widths for landscape letter (11 inches usable ~ 10.4 with margins)
    col_widths = [
        0.75 * inch,   # Campo
        0.8 * inch,    # Variedad
        0.65 * inch,   # Cosechas
        0.42 * inch,   # 0-30
        0.42 * inch,   # 30-50
        0.42 * inch,   # 50-75
        0.46 * inch,   # 75-100
        0.42 * inch,   # Verde
        0.42 * inch,   # Ver-Am
        0.42 * inch,   # Amar.
        0.42 * inch,   # Full
        0.42 * inch,   # Peso
        0.42 * inch,   # Punta
        0.42 * inch,   # Quilla
        0.46 * inch,   # Hombro
        0.42 * inch,   # Mej.1
        0.42 * inch,   # Mej.2
        0.42 * inch,   # Brix
        0.42 * inch,   # Acidez
    ]

    table_data = [header_row_1, header_row_2]

    for campo_name in sorted(campo_groups.keys()):
        varieties = campo_groups[campo_name]
        for row_idx, rd in enumerate(varieties):
            stats = rd["stats"]
            fechas_str = ", ".join(stats["fechas_cosecha"][:3]) if stats["fechas_cosecha"] else "-"

            row = [
                campo_name if row_idx == 0 else "",  # Only show campo on first row
                rd["nombre"],
                fechas_str,
                _fmt(stats["color_0_30_avg"]),
                _fmt(stats["color_30_50_avg"]),
                _fmt(stats["color_50_75_avg"]),
                _fmt(stats["color_75_100_avg"]),
                _fmt(stats["color_verde_avg"]),
                _fmt(stats["color_crema_avg"]),
                _fmt(stats["color_amarillo_avg"]),
                _fmt(stats["color_full_avg"]),
                _fmt(stats["peso_avg"]),
                _fmt(stats["firmeza_punta_avg"]),
                _fmt(stats["firmeza_quilla_avg"]),
                _fmt(stats["firmeza_hombro_avg"]),
                _fmt(stats["firmeza_mejilla1_avg"]),
                _fmt(stats["firmeza_mejilla2_avg"]),
                _fmt(stats["brix_avg"]),
                _fmt(stats["acidez_avg"], 2),
            ]
            table_data.append(row)

    summary_table = Table(table_data, colWidths=col_widths, repeatRows=2)

    # Spans for grouped header columns
    summary_style = TableStyle([
        # Header row 1 background
        ("BACKGROUND", (0, 0), (-1, 0), cherry),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        # Header row 2 background
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#C45050")),
        ("TEXTCOLOR", (0, 1), (-1, 1), colors.white),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 7),
        # Span grouped headers in row 1
        ("SPAN", (3, 0), (6, 0)),   # Color cubrimiento
        ("SPAN", (7, 0), (10, 0)),  # Color fondo
        ("SPAN", (12, 0), (16, 0)), # Firmeza
        # Span single-column headers across both rows
        ("SPAN", (0, 0), (0, 1)),   # Campo
        ("SPAN", (1, 0), (1, 1)),   # Variedad
        ("SPAN", (2, 0), (2, 1)),   # Cosechas
        ("SPAN", (11, 0), (11, 1)), # Peso
        ("SPAN", (17, 0), (17, 1)), # Brix
        ("SPAN", (18, 0), (18, 1)), # Acidez
        # Alignment
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        # Data rows
        ("FONTSIZE", (0, 2), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("ROWBACKGROUNDS", (0, 2), (-1, -1), [colors.white, colors.HexColor("#FFF5F5")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
    ])

    # Highlight campo name rows (bold the campo cell)
    row_offset = 2
    for campo_name in sorted(campo_groups.keys()):
        n_varieties = len(campo_groups[campo_name])
        if n_varieties > 1:
            summary_style.add("SPAN", (0, row_offset), (0, row_offset + n_varieties - 1))
        summary_style.add("FONTNAME", (0, row_offset), (0, row_offset + n_varieties - 1), "Helvetica-Bold")
        summary_style.add("BACKGROUND", (0, row_offset), (0, row_offset + n_varieties - 1), colors.HexColor("#F5F0F0"))
        row_offset += n_varieties

    summary_table.setStyle(summary_style)
    story.append(summary_table)
    story.append(Spacer(1, 10))

    # ── AI Analysis section ───────────────────────────────────────────────
    if incluir_ia:
        story.append(Spacer(1, 8))
        story.append(Paragraph("Analisis Comparativo (AI)", h2_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=cherry, spaceAfter=8))

        # Build context for AI
        ai_parts = [
            f"RESUMEN DE COSECHAS — {especie_title}",
            f"Temporada: {temporada_label}",
            "",
        ]
        for campo_name in sorted(campo_groups.keys()):
            ai_parts.append(f"CAMPO: {campo_name}")
            for rd in campo_groups[campo_name]:
                stats = rd["stats"]
                ai_parts.append(f"  Variedad: {rd['nombre']} ({rd['codigo']})")
                ai_parts.append(f"    N={stats['n']}, Peso={_fmt(stats['peso_avg'])}g, "
                                f"Calibre={_fmt(stats['calibre_avg'])}mm")
                ai_parts.append(
                    f"    Firmeza: Punta={_fmt(stats['firmeza_punta_avg'])}, "
                    f"Quilla={_fmt(stats['firmeza_quilla_avg'])}, "
                    f"Hombro={_fmt(stats['firmeza_hombro_avg'])}, "
                    f"Mej1={_fmt(stats['firmeza_mejilla1_avg'])}, "
                    f"Mej2={_fmt(stats['firmeza_mejilla2_avg'])}"
                )
                ai_parts.append(f"    Brix={_fmt(stats['brix_avg'])}%, "
                                f"Acidez={_fmt(stats['acidez_avg'], 2)}%")
                ai_parts.append(
                    f"    Color cub: 0-30={_fmt(stats['color_0_30_avg'])}, "
                    f"30-50={_fmt(stats['color_30_50_avg'])}, "
                    f"50-75={_fmt(stats['color_50_75_avg'])}, "
                    f"75-100={_fmt(stats['color_75_100_avg'])}"
                )
                ai_parts.append(
                    f"    Color fondo: Verde={_fmt(stats['color_verde_avg'])}, "
                    f"Ver-Am={_fmt(stats['color_crema_avg'])}, "
                    f"Amarillo={_fmt(stats['color_amarillo_avg'])}, "
                    f"Full={_fmt(stats['color_full_avg'])}"
                )
            ai_parts.append("")

        ai_context = "\n".join(ai_parts)
        ai_question = (
            "Genera un analisis comparativo profesional de este resumen de cosechas. "
            "Compara variedades entre si y entre campos. Identifica las mejores variedades, "
            "destaca tendencias, y da recomendaciones concretas para la proxima temporada."
        )

        try:
            ai_text = get_ai_analysis(ai_context, ai_question)
        except Exception as e:
            ai_text = f"Error al generar analisis AI: {str(e)[:200]}"

        import re as re_mod
        for line in ai_text.split("\n"):
            line = line.strip()
            if not line:
                story.append(Spacer(1, 4))
            elif line.startswith("## "):
                story.append(Paragraph(line[3:], h3_style))
            elif line.startswith("# "):
                story.append(Paragraph(line[2:], h2_style))
            elif line.startswith("**") and line.endswith("**"):
                story.append(Paragraph(f"<b>{line.strip('*')}</b>", ai_style))
            else:
                safe_line = (
                    line
                    .replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                )
                safe_line = re_mod.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", safe_line)
                safe_line = re_mod.sub(r"\*(.+?)\*", r"<i>\1</i>", safe_line)
                story.append(Paragraph(safe_line, ai_style))

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey, spaceAfter=6))
    story.append(Paragraph(
        "Departamento Desarrollo Varietal y Genetico — Garces Fruit",
        footer_style,
    ))

    doc.build(story)
    buf.seek(0)

    filename = f"resumen_cosechas_{especie_title}_{dt.now().strftime('%Y%m%d_%H%M')}.pdf"
    filename = filename.replace(" ", "_").replace("/", "-")
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
