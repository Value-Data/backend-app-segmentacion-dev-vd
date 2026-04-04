"""Inventario routes: CRUD, movimientos, despacho, stats, kardex, por-bodega."""

from fastapi import APIRouter, Depends, Query
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
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return crud.list_all(db, InventarioVivero, only_active=False, skip=skip, limit=limit)


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
    return crud.create(db, InventarioVivero, data, usuario=user.username)


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
