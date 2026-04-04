"""TestBlock routes: CRUD, posiciones, grilla, alta/baja/replante, config, QR."""

import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.sistema import Usuario
from app.models.testblock import TestBlock, PosicionTestBlock, HistorialPosicion
from app.models.inventario import InventarioVivero, InventarioTestBlock
from app.schemas.testblock import (
    TestBlockCreate, TestBlockUpdate,
    AltaPlantaRequest, AltaMasivaRequest,
    BajaPlantaRequest, BajaMasivaRequest,
    ReplantePlantaRequest,
    AgregarHileraRequest, AgregarPosicionesRequest,
    GenerarPosicionesRequest,
)
from app.services import crud
from app.services.testblock_service import (
    generar_posiciones, alta_planta, alta_masiva,
    baja_planta, baja_masiva, replante_planta,
    get_grilla, get_resumen_hileras, get_resumen_variedades,
    agregar_hilera, agregar_posiciones,
    eliminar_hilera, eliminar_posiciones,
    get_inventario_testblock,
)

router = APIRouter(prefix="/testblocks", tags=["TestBlock"])


# ── CRUD ────────────────────────────────────────────────────────────────────
@router.get("")
def list_testblocks(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    from sqlalchemy import func, case

    tbs = crud.list_all(db, TestBlock)
    if not tbs:
        return []

    tb_ids = [tb.id_testblock for tb in tbs]

    # Single GROUP BY query instead of N+1 per-testblock queries
    stats_q = (
        db.query(
            PosicionTestBlock.id_testblock,
            func.sum(case((PosicionTestBlock.estado == "alta", 1), else_=0)).label("pos_alta"),
            func.sum(case((PosicionTestBlock.estado == "baja", 1), else_=0)).label("pos_baja"),
            func.sum(case((PosicionTestBlock.estado == "replante", 1), else_=0)).label("pos_replante"),
            func.sum(case((PosicionTestBlock.estado == "vacia", 1), else_=0)).label("pos_vacia"),
        )
        .filter(PosicionTestBlock.id_testblock.in_(tb_ids))
        .group_by(PosicionTestBlock.id_testblock)
        .all()
    )
    stats_map = {row[0]: row for row in stats_q}

    result = []
    for tb in tbs:
        data = {c: getattr(tb, c) for c in tb.__class__.model_fields}
        s = stats_map.get(tb.id_testblock)
        data["pos_alta"] = int(s[1]) if s else 0
        data["pos_baja"] = int(s[2]) if s else 0
        data["pos_replante"] = int(s[3]) if s else 0
        data["pos_vacia"] = int(s[4]) if s else 0
        result.append(data)
    return result


@router.get("/{id}")
def get_testblock(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    from sqlalchemy import func, case

    tb = crud.get_by_id(db, TestBlock, id)
    data = {c: getattr(tb, c) for c in tb.__class__.model_fields}

    stats = (
        db.query(
            func.sum(case((PosicionTestBlock.estado == "alta", 1), else_=0)).label("pos_alta"),
            func.sum(case((PosicionTestBlock.estado == "baja", 1), else_=0)).label("pos_baja"),
            func.sum(case((PosicionTestBlock.estado == "replante", 1), else_=0)).label("pos_replante"),
            func.sum(case((PosicionTestBlock.estado == "vacia", 1), else_=0)).label("pos_vacia"),
        )
        .filter(PosicionTestBlock.id_testblock == id)
        .first()
    )
    data["pos_alta"] = int(stats[0] or 0) if stats else 0
    data["pos_baja"] = int(stats[1] or 0) if stats else 0
    data["pos_replante"] = int(stats[2] or 0) if stats else 0
    data["pos_vacia"] = int(stats[3] or 0) if stats else 0
    return data


@router.post("", status_code=201)
def create_testblock(
    data: TestBlockCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return crud.create(db, TestBlock, data, usuario=user.username)


@router.put("/{id}")
def update_testblock(
    id: int,
    data: TestBlockUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return crud.update(db, TestBlock, id, data, usuario=user.username)


@router.delete("/{id}")
def delete_testblock(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return crud.soft_delete(db, TestBlock, id, usuario=user.username)


# ── Generar posiciones ──────────────────────────────────────────────────────
@router.post("/{id}/generar-posiciones")
def api_generar_posiciones(
    id: int,
    data: GenerarPosicionesRequest | None = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    count = generar_posiciones(
        db, id,
        num_hileras=data.num_hileras if data else None,
        pos_por_hilera=data.posiciones_por_hilera if data else None,
        usuario=user.username,
    )
    return {"count": count}


# ── Posiciones y Grilla ────────────────────────────────────────────────────
@router.get("/{id}/posiciones")
def list_posiciones(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == id)
        .order_by(PosicionTestBlock.hilera, PosicionTestBlock.posicion)
        .all()
    )


@router.get("/{id}/grilla")
def api_grilla(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return get_grilla(db, id)


@router.get("/{id}/resumen-hileras")
def api_resumen_hileras(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return get_resumen_hileras(db, id)


@router.get("/{id}/resumen-variedades")
def api_resumen_variedades(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return get_resumen_variedades(db, id)


# ── Operaciones de planta ──────────────────────────────────────────────────
@router.post("/{id}/alta")
def api_alta(
    id: int,
    data: AltaPlantaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return alta_planta(db, id, data, usuario=user.username)


@router.post("/{id}/alta-masiva")
def api_alta_masiva(
    id: int,
    data: AltaMasivaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return alta_masiva(db, id, data, usuario=user.username)


@router.post("/{id}/baja")
def api_baja(
    id: int,
    data: BajaPlantaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return baja_planta(db, id, data, usuario=user.username)


@router.post("/{id}/baja-masiva")
def api_baja_masiva(
    id: int,
    data: BajaMasivaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return baja_masiva(db, id, data, usuario=user.username)


@router.post("/{id}/replante")
def api_replante(
    id: int,
    data: ReplantePlantaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return replante_planta(db, id, data, usuario=user.username)


# ── Configuracion ──────────────────────────────────────────────────────────
@router.post("/{id}/agregar-hilera")
def api_agregar_hilera(
    id: int,
    data: AgregarHileraRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    count = agregar_hilera(db, id, data.num_posiciones, usuario=user.username)
    return {"count": count}


@router.post("/{id}/agregar-posiciones")
def api_agregar_posiciones(
    id: int,
    data: AgregarPosicionesRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    count = agregar_posiciones(db, id, data.hilera, data.cantidad, usuario=user.username)
    return {"count": count}


@router.delete("/{id}/eliminar-hilera/{hilera}")
def api_eliminar_hilera(
    id: int,
    hilera: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return eliminar_hilera(db, id, hilera, usuario=user.username)


@router.post("/{id}/eliminar-posiciones")
def api_eliminar_posiciones(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    ids = data.get("ids_posiciones", [])
    if not ids:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="ids_posiciones requerido")
    return eliminar_posiciones(db, id, ids, usuario=user.username)


# ── Inventario vinculado ───────────────────────────────────────────────────
@router.get("/{id}/pendientes")
def api_pendientes(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    tb = crud.get_by_id(db, TestBlock, id)
    return (
        db.query(InventarioTestBlock)
        .filter(InventarioTestBlock.id_cuartel == tb.id_cuartel, InventarioTestBlock.estado == "pendiente")
        .all()
    )


@router.get("/{id}/inventario-disponible")
def api_inventario_disponible(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(InventarioVivero)
        .filter(InventarioVivero.estado == "disponible", InventarioVivero.cantidad_actual > 0)
        .all()
    )


@router.get("/{id}/inventario")
def api_inventario_testblock(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Inventario asignado al testblock (post-despacho, en standby o completado)."""
    return get_inventario_testblock(db, id)


# ── Historial ──────────────────────────────────────────────────────────────
posiciones_router = APIRouter(prefix="/posiciones", tags=["TestBlock"])


@posiciones_router.get("/{id}/historial")
def api_historial(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(HistorialPosicion)
        .filter(HistorialPosicion.id_posicion == id)
        .order_by(HistorialPosicion.fecha.desc())
        .all()
    )


# ── QR ─────────────────────────────────────────────────────────────────────
@posiciones_router.get("/{id}/qr")
def api_qr_posicion(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    pos = crud.get_by_id(db, PosicionTestBlock, id)
    import qrcode
    img = qrcode.make(pos.codigo_unico)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@router.get("/{id}/qr-pdf")
def api_qr_pdf(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    import qrcode

    posiciones = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == id)
        .order_by(PosicionTestBlock.hilera, PosicionTestBlock.posicion)
        .all()
    )

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    w, h = letter
    x, y = 50, h - 80
    col_w, row_h = 120, 120

    for pos in posiciones:
        img = qrcode.make(pos.codigo_unico)
        img_buf = io.BytesIO()
        img.save(img_buf, format="PNG")
        img_buf.seek(0)

        from reportlab.lib.utils import ImageReader
        c.drawImage(ImageReader(img_buf), x, y - 80, 80, 80)
        c.setFont("Helvetica", 7)
        c.drawString(x, y - 90, pos.codigo_unico)

        x += col_w
        if x > w - col_w:
            x = 50
            y -= row_h
            if y < 80:
                c.showPage()
                y = h - 80

    c.save()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=qr_testblock_{id}.pdf"})


@router.get("/{id}/qr-hilera/{hilera}")
def api_qr_hilera(
    id: int,
    hilera: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader
    import qrcode

    posiciones = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == id, PosicionTestBlock.hilera == hilera)
        .order_by(PosicionTestBlock.posicion)
        .all()
    )

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    w, h = letter
    x, y = 50, h - 80
    col_w, row_h = 120, 120

    for pos in posiciones:
        img = qrcode.make(pos.codigo_unico)
        img_buf = io.BytesIO()
        img.save(img_buf, format="PNG")
        img_buf.seek(0)

        c.drawImage(ImageReader(img_buf), x, y - 80, 80, 80)
        c.setFont("Helvetica", 7)
        c.drawString(x, y - 90, pos.codigo_unico)

        x += col_w
        if x > w - col_w:
            x = 50
            y -= row_h
            if y < 80:
                c.showPage()
                y = h - 80

    c.save()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=qr_tb{id}_h{hilera}.pdf"})
