"""Inventario routes: CRUD, movimientos, despacho, stats, kardex, por-bodega, QR."""

import io
from typing import Optional

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.sistema import Usuario
from app.models.inventario import InventarioVivero, MovimientoInventario, GuiaDespacho
from app.models.maestras import Bodega
from app.schemas.inventario import InventarioCreate, InventarioUpdate, MovimientoCreate, DespachoCreate
from app.services import crud
from app.services.inventario_service import registrar_movimiento, crear_despacho, get_inventario_stats

router = APIRouter(prefix="/inventario", tags=["Inventario"])


@router.get("")
def list_inventario(
    skip: int = 0,
    limit: int = 1000,
    tipo_planta: Optional[str] = Query(None, description="Filtrar por tipo de planta"),
    tipo_injertacion: Optional[str] = Query(None, description="Filtrar por tipo de injertacion"),
    estado: Optional[str] = Query(None, description="Filtrar por estado (disponible, agotado, etc.)"),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    filters = {
        "tipo_planta": tipo_planta,
        "tipo_injertacion": tipo_injertacion,
        "estado": estado,
    }
    return crud.list_all(
        db, InventarioVivero, only_active=False, skip=skip, limit=limit, filters=filters
    )


@router.get("/disponible")
def list_disponible(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(InventarioVivero)
        .filter(InventarioVivero.estado == "disponible", InventarioVivero.cantidad_actual > 0)
        .all()
    )


@router.get("/stats")
def inventario_stats(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return get_inventario_stats(db)


@router.get("/por-bodega")
def stock_por_bodega(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Retorna resumen de stock agrupado por bodega (Kardex por bodega)."""
    bodegas = db.query(Bodega).filter(Bodega.activo == True).all()
    result = []
    for bod in bodegas:
        lotes = (
            db.query(InventarioVivero)
            .filter(InventarioVivero.id_bodega == bod.id_bodega)
            .all()
        )
        total_stock = sum(l.cantidad_actual for l in lotes)
        total_lotes = len(lotes)
        result.append({
            "id_bodega": bod.id_bodega,
            "nombre": bod.nombre,
            "ubicacion": bod.ubicacion,
            "total_lotes": total_lotes,
            "total_stock": total_stock,
            "lotes_disponibles": sum(
                1 for l in lotes if l.estado == "disponible" and l.cantidad_actual > 0
            ),
        })

    # Lotes sin bodega asignada
    sin_bodega = (
        db.query(InventarioVivero)
        .filter(
            (InventarioVivero.id_bodega == None) | (InventarioVivero.id_bodega == 0)
        )
        .all()
    )
    if sin_bodega:
        result.append({
            "id_bodega": 0,
            "nombre": "Sin Bodega",
            "ubicacion": "-",
            "total_lotes": len(sin_bodega),
            "total_stock": sum(l.cantidad_actual for l in sin_bodega),
            "lotes_disponibles": sum(
                1 for l in sin_bodega if l.estado == "disponible" and l.cantidad_actual > 0
            ),
        })

    return result


@router.post("/qr-batch", response_class=StreamingResponse)
def generate_qr_batch(
    ids: list[int],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Generate a PDF with QR labels for multiple lotes."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as pdf_canvas

    buf = io.BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4

    # Label layout: 3 columns x 8 rows, 60x30mm each
    label_w = 60 * mm
    label_h = 30 * mm
    margin_x = 15 * mm
    margin_y = 15 * mm
    cols = 3
    rows = 8
    qr_size = 22 * mm

    base_url = "https://appsegmentacion-ftawhyhcgthygwhu.brazilsouth-01.azurewebsites.net"
    idx = 0

    for inv_id in ids:
        row_obj = db.get(InventarioVivero, inv_id)
        if not row_obj:
            continue

        col = idx % cols
        row = (idx // cols) % rows
        if idx > 0 and idx % (cols * rows) == 0:
            c.showPage()

        x = margin_x + col * label_w
        y = page_h - margin_y - (row + 1) * label_h

        # Generate QR
        url = f"{base_url}/inventario/{inv_id}"
        qr_img = qrcode.make(url)
        qr_buf = io.BytesIO()
        qr_img.save(qr_buf, format="PNG")
        qr_buf.seek(0)

        from reportlab.lib.utils import ImageReader
        c.drawImage(ImageReader(qr_buf), x + 2 * mm, y + 3 * mm, qr_size, qr_size)

        # Text next to QR
        text_x = x + qr_size + 4 * mm
        c.setFont("Helvetica-Bold", 7)
        c.drawString(text_x, y + 22 * mm, row_obj.codigo_lote or f"#{inv_id}")
        c.setFont("Helvetica", 6)
        c.drawString(text_x, y + 17 * mm, f"ID: {inv_id}")
        if row_obj.tipo_planta:
            c.drawString(text_x, y + 12 * mm, row_obj.tipo_planta[:20])

        idx += 1

    c.save()
    buf.seek(0)

    filename = "qr-labels.pdf"

    return StreamingResponse(buf, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename={filename}"
    })


@router.get("/{id}/qr")
def generate_qr(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Genera codigo QR como imagen PNG para un lote de inventario."""
    row = db.get(InventarioVivero, id)
    if not row:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    base_url = "https://appsegmentacion-ftawhyhcgthygwhu.brazilsouth-01.azurewebsites.net"
    url = f"{base_url}/inventario/{id}"

    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename=qr-{row.codigo_lote}.png"},
    )


@router.get("/{id}/destinos")
def get_lote_destinos(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Retorna los testblocks destino de un lote (inventario_testblock)."""
    from app.models.inventario import InventarioTestBlock
    from app.models.testblock import TestBlock

    records = db.query(InventarioTestBlock).filter(InventarioTestBlock.id_inventario == id).all()
    result = []
    for rec in records:
        tb_nombre = None
        tb_codigo = None
        tb_id = None
        if rec.id_cuartel:
            tb = db.query(TestBlock).filter(TestBlock.id_cuartel == rec.id_cuartel).first()
            if tb:
                tb_nombre = tb.nombre
                tb_codigo = tb.codigo
                tb_id = tb.id_testblock
        result.append({
            "id_inventario_tb": rec.id_inventario_tb,
            "testblock_id": tb_id,
            "testblock_nombre": tb_nombre,
            "testblock_codigo": tb_codigo,
            "cantidad_asignada": rec.cantidad_asignada or 0,
            "cantidad_plantada": rec.cantidad_plantada or 0,
            "estado": rec.estado,
        })
    return result


@router.get("/{id}/kardex")
def get_kardex(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Retorna movimientos de un lote en orden cronologico (Kardex)."""
    movs = (
        db.query(MovimientoInventario)
        .filter(MovimientoInventario.id_inventario == id)
        .order_by(MovimientoInventario.fecha_movimiento.asc())
        .all()
    )
    return movs


# ── Plantas sin lote ──────────────────────────────────────────────────────
@router.get("/plantas-sin-lote")
def plantas_sin_lote(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Plants in testblocks where the position has no lote assigned."""
    from app.models.testblock import PosicionTestBlock, Planta, TestBlock
    from app.models.variedades import Variedad
    from app.models.maestras import Portainjerto

    # Use subquery to avoid SQL Server 2100-parameter limit
    pos_subq = (
        db.query(PosicionTestBlock.id_posicion)
        .filter(PosicionTestBlock.estado.in_(["alta", "replante"]), PosicionTestBlock.id_lote == None)
        .subquery()
    )

    plantas = (
        db.query(Planta)
        .filter(Planta.activa == True, Planta.id_posicion.in_(pos_subq))
        .order_by(Planta.id_planta.desc())
        .limit(2000)
        .all()
    )

    enrich_pos_ids = [p.id_posicion for p in plantas if p.id_posicion]
    pos_map = {}
    tb_map = {}
    if enrich_pos_ids:
        positions = db.query(PosicionTestBlock).filter(PosicionTestBlock.id_posicion.in_(enrich_pos_ids)).all()
        pos_map = {p.id_posicion: p for p in positions}
        tb_ids = list({p.id_testblock for p in positions if p.id_testblock})
        if tb_ids:
            tbs = db.query(TestBlock).filter(TestBlock.id_testblock.in_(tb_ids)).all()
            tb_map = {t.id_testblock: t for t in tbs}

    var_ids = list({p.id_variedad for p in plantas if p.id_variedad})
    pi_ids = list({p.id_portainjerto for p in plantas if p.id_portainjerto})
    var_map = {v.id_variedad: v.nombre for v in db.query(Variedad).filter(Variedad.id_variedad.in_(var_ids)).all()} if var_ids else {}
    pi_map = {p.id_portainjerto: p.nombre for p in db.query(Portainjerto).filter(Portainjerto.id_portainjerto.in_(pi_ids)).all()} if pi_ids else {}

    result = []
    for pl in plantas:
        pos = pos_map.get(pl.id_posicion)
        tb = tb_map.get(pos.id_testblock) if pos and pos.id_testblock else None
        result.append({
            "id_planta": pl.id_planta, "codigo": pl.codigo,
            "id_variedad": pl.id_variedad, "variedad": var_map.get(pl.id_variedad, "-"),
            "id_portainjerto": pl.id_portainjerto, "portainjerto": pi_map.get(pl.id_portainjerto, "-"),
            "etapa": pl.etapa or "formacion", "condicion": pl.condicion, "ano_plantacion": pl.ano_plantacion,
            "testblock": tb.nombre if tb else "-", "id_testblock": tb.id_testblock if tb else None,
            "posicion": f"H{pos.hilera}P{pos.posicion}" if pos else "-", "id_posicion": pl.id_posicion,
            "fecha_alta": str(pl.fecha_alta) if pl.fecha_alta else None,
        })
    return result


# ── Asignar lote a plantas ───────────────────────────────────────────────
@router.post("/asignar-lote")
def asignar_lote_a_plantas(
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Assign an existing lote to plants that don't have one."""
    from app.models.testblock import Planta, PosicionTestBlock
    id_lote = data.get("id_lote")
    planta_ids = data.get("planta_ids", [])
    if not id_lote or not planta_ids:
        raise HTTPException(status_code=400, detail="Se requiere id_lote y planta_ids")
    lote = db.get(InventarioVivero, id_lote)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    updated = 0
    for pid in planta_ids:
        planta = db.get(Planta, pid)
        if not planta or not planta.activa:
            continue
        planta.id_lote_origen = id_lote
        if planta.id_posicion:
            pos = db.get(PosicionTestBlock, planta.id_posicion)
            if pos:
                pos.id_lote = id_lote
        updated += 1
    db.commit()
    return {"updated": updated, "message": f"{updated} plantas asignadas al lote {lote.codigo_lote}"}


# ── Carga inicial (lote + plantacion directa sin guia) ──────────────────
@router.post("/carga-inicial", status_code=201)
def carga_inicial(
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Carga inicial: create lot + plant positions in one operation.
    No dispatch guides, no inventario_testblock.
    """
    from app.models.testblock import TestBlock, PosicionTestBlock, Planta, HistorialPosicion
    from app.services.testblock_service import plantar_en_posicion
    from datetime import date

    id_testblock = data.get("id_testblock")
    posicion_ids = data.get("posicion_ids", [])
    id_variedad = data.get("id_variedad")
    id_portainjerto = data.get("id_portainjerto")
    id_especie = data.get("id_especie")
    id_pmg = data.get("id_pmg")

    if not id_testblock or not posicion_ids or not id_variedad:
        raise HTTPException(status_code=400, detail="Se requiere id_testblock, posicion_ids, id_variedad")

    tb = db.query(TestBlock).filter(TestBlock.id_testblock == id_testblock).first()
    if not tb:
        raise HTTPException(status_code=404, detail="TestBlock no encontrado")

    posiciones = (
        db.query(PosicionTestBlock)
        .filter(
            PosicionTestBlock.id_posicion.in_(posicion_ids),
            PosicionTestBlock.id_testblock == id_testblock,
        )
        .all()
    )
    if not posiciones:
        raise HTTPException(status_code=400, detail="No hay posiciones validas")

    cantidad = len(posiciones)

    # Generate lot code using new format
    class _FakeData:
        pass
    fd = _FakeData()
    fd.id_especie = id_especie
    fd.id_variedad = id_variedad
    fd.id_portainjerto = id_portainjerto
    codigo_lote = _generar_codigo_lote(db, fd)

    # Create lot (already planted)
    lote = InventarioVivero(
        codigo_lote=codigo_lote,
        id_variedad=id_variedad,
        id_portainjerto=id_portainjerto,
        id_especie=id_especie,
        id_pmg=id_pmg,
        tipo_planta=data.get("tipo_planta"),
        tipo_injertacion=data.get("tipo_injertacion"),
        cantidad_inicial=cantidad,
        cantidad_actual=0,
        cantidad_minima=0,
        fecha_ingreso=date.today(),
        ano_plantacion=data.get("ano_plantacion") or date.today().year,
        estado="plantado",
        observaciones=data.get("observaciones") or f"Carga inicial TB {tb.codigo}",
    )
    db.add(lote)
    db.flush()

    # Plant each position
    plantas_creadas = 0
    for pos in posiciones:
        plantar_en_posicion(
            db, pos,
            id_variedad=id_variedad,
            id_portainjerto=id_portainjerto,
            id_especie=id_especie,
            id_pmg=id_pmg,
            id_lote=lote.id_inventario,
            accion="carga_inicial",
            usuario=user.username,
        )
        plantas_creadas += 1

    # Single movement record
    mov = MovimientoInventario(
        id_inventario=lote.id_inventario,
        tipo="CARGA_INICIAL",
        cantidad=cantidad,
        saldo_anterior=cantidad,
        saldo_nuevo=0,
        motivo=f"Carga inicial a TB {tb.codigo}",
        referencia_destino=tb.codigo,
        usuario=user.username,
    )
    db.add(mov)

    db.commit()
    return {
        "lote_id": lote.id_inventario,
        "codigo_lote": codigo_lote,
        "plantas_creadas": plantas_creadas,
        "testblock": tb.codigo,
    }


@router.get("/{id}")
def get_inventario(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return crud.get_by_id(db, InventarioVivero, id)


@router.post("", status_code=201)
def create_inventario(
    data: InventarioCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    # Auto-generate codigo_lote if not provided
    if not data.codigo_lote:
        data.codigo_lote = _generar_codigo_lote(db, data)
    return crud.create(db, InventarioVivero, data, usuario=user.username)


def _generar_codigo_lote(db: Session, data=None) -> str:
    """Generate descriptive lot code: LOT-{ESP}-{VAR}-{PI}-{YEAR}-{SEQ}"""
    from app.models.maestras import Especie, Portainjerto
    from app.models.variedades import Variedad
    from sqlalchemy import text
    from datetime import date

    esp_code = "XXX"
    var_code = "000"
    pi_code = "SPI"
    anio = str(date.today().year)

    id_especie = getattr(data, "id_especie", None) if data else None
    id_variedad = getattr(data, "id_variedad", None) if data else None
    id_portainjerto = getattr(data, "id_portainjerto", None) if data else None

    if id_especie:
        esp = db.query(Especie).filter(Especie.id_especie == id_especie).first()
        if esp:
            esp_code = esp.codigo[:3].upper()

    if id_variedad:
        var = db.query(Variedad).filter(Variedad.id_variedad == id_variedad).first()
        if var and var.codigo:
            parts = var.codigo.split("-")
            var_code = parts[-1][:3] if len(parts) > 1 else var.codigo[:3]

    if id_portainjerto:
        pi = db.query(Portainjerto).filter(Portainjerto.id_portainjerto == id_portainjerto).first()
        if pi:
            abbrevs = {"GXN": "GXN", "Nemaguard": "NEMA", "Noga": "NOGA", "H41": "H41", "H43": "H43"}
            pi_code = abbrevs.get(pi.nombre, pi.codigo[:4].upper() if pi.codigo else "PI")

    prefix = f"LOT-{esp_code}-{var_code}-{pi_code}-{anio}-"
    try:
        result = db.execute(text(
            "SELECT MAX(CAST(RIGHT(codigo_lote, 3) AS INT)) FROM inventario_vivero WHERE codigo_lote LIKE :p"
        ), {"p": prefix + "%"}).scalar()
        seq = (result or 0) + 1
    except Exception:
        seq = 1

    return f"{prefix}{seq:03d}"


@router.put("/{id}")
def update_inventario(
    id: int,
    data: InventarioUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return crud.update(db, InventarioVivero, id, data, usuario=user.username)


@router.get("/{id}/movimientos")
def list_movimientos(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(MovimientoInventario)
        .filter(MovimientoInventario.id_inventario == id)
        .order_by(MovimientoInventario.fecha_movimiento.desc())
        .all()
    )


@router.post("/{id}/movimientos", status_code=201)
def create_movimiento(
    id: int,
    data: MovimientoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return registrar_movimiento(db, id, data, usuario=user.username)


@router.post("/despacho", status_code=201)
def despacho(
    data: DespachoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return crear_despacho(db, data, usuario=user.username)


# ── Sin asignar (lotes con stock no asignado a testblocks) ────────────────
@router.get("/sin-testblock")
def lotes_sin_testblock(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Lotes with remaining stock that hasn't been fully assigned to testblocks."""
    from app.models.inventario import InventarioTestBlock
    from sqlalchemy import func, case

    # Subquery: total assigned per lote
    assigned_sub = (
        db.query(
            InventarioTestBlock.id_inventario,
            func.coalesce(func.sum(InventarioTestBlock.cantidad_asignada), 0).label("total_asignado"),
        )
        .group_by(InventarioTestBlock.id_inventario)
        .subquery()
    )

    lotes = (
        db.query(InventarioVivero)
        .outerjoin(assigned_sub, InventarioVivero.id_inventario == assigned_sub.c.id_inventario)
        .filter(
            InventarioVivero.cantidad_actual > 0,
            InventarioVivero.estado != "baja",
        )
        .all()
    )
    return lotes


# ── Mediciones por lote ───────────────────────────────────────────────────
@router.get("/{id}/mediciones")
def mediciones_por_lote(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Get lab measurements for plants originating from this lote."""
    from app.models.testblock import PosicionTestBlock, Planta
    from app.models.laboratorio import MedicionLaboratorio

    # Plants from this lote (via posicion.id_lote or planta.id_lote_origen)
    plantas = (
        db.query(Planta)
        .filter(Planta.id_lote_origen == id)
        .all()
    )
    if not plantas:
        # Fallback: plants in positions linked to this lote
        pos_ids = [
            p.id_posicion for p in
            db.query(PosicionTestBlock.id_posicion)
            .filter(PosicionTestBlock.id_lote == id)
            .all()
        ]
        if pos_ids:
            plantas = (
                db.query(Planta)
                .filter(Planta.id_posicion.in_(pos_ids))
                .all()
            )

    if not plantas:
        return []

    planta_ids = [p.id_planta for p in plantas]
    mediciones = (
        db.query(MedicionLaboratorio)
        .filter(MedicionLaboratorio.id_planta.in_(planta_ids))
        .order_by(MedicionLaboratorio.fecha_medicion.desc())
        .limit(500)
        .all()
    )

    # Enrich with plant code
    planta_map = {p.id_planta: p.codigo for p in plantas}
    result = []
    for m in mediciones:
        d = {c.name: getattr(m, c.name) for c in m.__table__.columns}
        d["planta_codigo"] = planta_map.get(m.id_planta, f"PLT-{m.id_planta}")
        result.append(d)
    return result


# ── Eliminar lote ─────────────────────────────────────────────────────────
@router.delete("/{id}")
def delete_inventario(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Delete a lote. Only allowed if no movements have been registered (pristine lote)."""
    lote = db.get(InventarioVivero, id)
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    movs = db.query(MovimientoInventario).filter(MovimientoInventario.id_inventario == id).count()
    if movs > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar: el lote tiene {movs} movimiento(s) registrados. Cambie su estado a 'baja' en su lugar.",
        )
    db.delete(lote)
    db.commit()
    return {"detail": "Lote eliminado"}


# ── Guias de despacho ──────────────────────────────────────────────────────
guias_router = APIRouter(prefix="/guias-despacho", tags=["Inventario"])


@guias_router.get("")
def list_guias(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return db.query(GuiaDespacho).order_by(GuiaDespacho.fecha_creacion.desc()).all()


@guias_router.get("/{id}")
def get_guia(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return crud.get_by_id(db, GuiaDespacho, id)
