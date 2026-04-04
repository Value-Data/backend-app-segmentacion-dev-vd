"""Inventario business logic: movimientos, despachos."""

from datetime import datetime
from app.core.utils import utcnow

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.inventario import (
    InventarioVivero,
    MovimientoInventario,
    InventarioTestBlock,
    GuiaDespacho,
)
from app.models.maestras import Correlativo
from app.schemas.inventario import MovimientoCreate, DespachoCreate

VALID_TIPOS = {"INGRESO", "RETIRO", "AJUSTE", "PLANTACION", "DEVOLUCION", "DESPACHO"}


def registrar_movimiento(
    db: Session,
    id_inventario: int,
    data: MovimientoCreate,
    usuario: str | None = None,
) -> MovimientoInventario:
    if data.tipo not in VALID_TIPOS:
        raise HTTPException(status_code=400, detail=f"Tipo invalido: {data.tipo}. Validos: {VALID_TIPOS}")

    lote = db.query(InventarioVivero).filter(InventarioVivero.id_inventario == id_inventario).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    saldo_anterior = lote.cantidad_actual

    if data.tipo in ("INGRESO", "DEVOLUCION"):
        lote.cantidad_actual += data.cantidad
    elif data.tipo in ("RETIRO", "AJUSTE", "PLANTACION", "DESPACHO"):
        if lote.cantidad_actual < data.cantidad:
            raise HTTPException(status_code=400, detail="Stock insuficiente")
        lote.cantidad_actual -= data.cantidad

    saldo_nuevo = lote.cantidad_actual

    # Update estado based on stock
    if lote.cantidad_actual <= 0:
        lote.estado = "agotado"
    elif lote.estado == "agotado":
        lote.estado = "disponible"

    lote.fecha_modificacion = utcnow()

    mov = MovimientoInventario(
        id_inventario=id_inventario,
        tipo=data.tipo,
        cantidad=data.cantidad,
        saldo_anterior=saldo_anterior,
        saldo_nuevo=saldo_nuevo,
        motivo=data.motivo,
        referencia_destino=data.referencia_destino,
        usuario=usuario,
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)
    return mov


def _next_guia_number(db: Session) -> str:
    corr = db.query(Correlativo).filter(Correlativo.tipo == "guia_despacho").first()
    if corr:
        corr.ultimo_numero += 1
        corr.fecha_modificacion = utcnow()
        num = corr.ultimo_numero
    else:
        corr = Correlativo(tipo="guia_despacho", prefijo="GD", ultimo_numero=1, formato="GD-{:05d}")
        db.add(corr)
        num = 1
    return f"GD-{num:05d}"


def crear_despacho(
    db: Session,
    data: DespachoCreate,
    usuario: str | None = None,
) -> GuiaDespacho:
    lote = db.query(InventarioVivero).filter(InventarioVivero.id_inventario == data.id_inventario).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    total = sum(d.cantidad for d in data.destinos)
    if lote.cantidad_actual < total:
        raise HTTPException(status_code=400, detail=f"Stock insuficiente: disponible={lote.cantidad_actual}, requerido={total}")

    numero_guia = _next_guia_number(db)

    guia = GuiaDespacho(
        numero_guia=numero_guia,
        id_bodega_origen=data.id_bodega_origen or lote.id_bodega or 1,
        id_testblock_destino=data.id_testblock_destino,
        total_plantas=total,
        estado="en_transito",
        responsable=data.responsable,
        motivo=data.motivo,
        usuario=usuario,
    )
    db.add(guia)

    for dest in data.destinos:
        inv_tb = InventarioTestBlock(
            id_inventario=data.id_inventario,
            id_cuartel=dest.id_cuartel,
            cantidad_asignada=dest.cantidad,
            usuario_creacion=usuario,
            fecha_despacho=utcnow(),
        )
        db.add(inv_tb)

    # Discount from lote
    saldo_anterior = lote.cantidad_actual
    lote.cantidad_actual -= total
    if lote.cantidad_actual <= 0:
        lote.estado = "agotado"
    lote.fecha_modificacion = utcnow()

    mov = MovimientoInventario(
        id_inventario=data.id_inventario,
        tipo="DESPACHO",
        cantidad=total,
        saldo_anterior=saldo_anterior,
        saldo_nuevo=lote.cantidad_actual,
        motivo=f"Despacho {numero_guia}",
        referencia_destino=numero_guia,
        usuario=usuario,
    )
    db.add(mov)

    db.commit()
    db.refresh(guia)
    return guia


def get_inventario_stats(db: Session) -> dict:
    lotes = db.query(InventarioVivero).filter(InventarioVivero.estado != "baja").all()
    total_lotes = len(lotes)
    total_stock = sum(l.cantidad_actual for l in lotes)
    disponibles = sum(1 for l in lotes if l.estado == "disponible" and l.cantidad_actual > 0)
    agotados = sum(1 for l in lotes if l.cantidad_actual <= 0)
    return {
        "total_lotes": total_lotes,
        "total_stock": total_stock,
        "lotes_disponibles": disponibles,
        "lotes_agotados": agotados,
    }
