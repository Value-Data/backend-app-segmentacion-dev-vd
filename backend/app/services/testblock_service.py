"""TestBlock business logic: alta, baja, replante, generar posiciones."""

from datetime import datetime
from app.core.utils import utcnow

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.testblock import (
    TestBlock,
    TestBlockHilera,
    PosicionTestBlock,
    Planta,
    HistorialPosicion,
)
from app.models.inventario import InventarioVivero, MovimientoInventario, InventarioTestBlock
from app.models.maestras import Cuartel
from app.schemas.testblock import (
    AltaPlantaRequest,
    AltaMasivaRequest,
    BajaPlantaRequest,
    BajaMasivaRequest,
    ReplantePlantaRequest,
)


def _get_testblock(db: Session, tb_id: int) -> TestBlock:
    tb = db.query(TestBlock).filter(TestBlock.id_testblock == tb_id).first()
    if not tb:
        raise HTTPException(status_code=404, detail="TestBlock no encontrado")
    return tb


def _get_cuartel_codigo(db: Session, id_cuartel: int | None) -> str:
    if not id_cuartel:
        return "TB"
    c = db.query(Cuartel).filter(Cuartel.id_cuartel == id_cuartel).first()
    return c.codigo if c and c.codigo else "TB"


def generar_posiciones(db: Session, tb_id: int, num_hileras: int | None = None, pos_por_hilera: int | None = None, usuario: str | None = None) -> int:
    tb = _get_testblock(db, tb_id)
    h = num_hileras or tb.num_hileras or 0
    p = pos_por_hilera or tb.posiciones_por_hilera or 0
    if h <= 0 or p <= 0:
        raise HTTPException(status_code=400, detail="num_hileras y posiciones_por_hilera deben ser > 0")

    cuartel_code = _get_cuartel_codigo(db, tb.id_cuartel)

    # Pre-fetch existing codigo_unico for this testblock to avoid N queries
    existing_codes = set(
        row[0]
        for row in db.query(PosicionTestBlock.codigo_unico)
        .filter(PosicionTestBlock.id_testblock == tb_id)
        .all()
    )

    count = 0
    for hi in range(1, h + 1):
        for pi in range(1, p + 1):
            cod = f"{cuartel_code}-H{hi:02d}-P{pi:02d}"
            if cod in existing_codes:
                continue
            pos = PosicionTestBlock(
                codigo_unico=cod,
                id_cuartel=tb.id_cuartel,
                id_testblock=tb_id,
                hilera=hi,
                posicion=pi,
                estado="vacia",
            )
            db.add(pos)
            existing_codes.add(cod)
            count += 1

    if count == 0:
        return 0

    tb.total_posiciones = (tb.total_posiciones or 0) + count
    tb.num_hileras = max(tb.num_hileras or 0, h)
    tb.posiciones_por_hilera = max(tb.posiciones_por_hilera or 0, p)
    tb.fecha_modificacion = utcnow()
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Las posiciones ya existen para este testblock. Se omitieron duplicados.")
    return count


def _discount_stock_vivero(db: Session, lote: InventarioVivero, cantidad: int, usuario: str | None, referencia: str | None = None) -> None:
    """Fallback: deducir stock directamente del vivero (compatibilidad hacia atras)."""
    if lote.cantidad_actual < cantidad:
        raise HTTPException(status_code=400, detail=f"Stock insuficiente en vivero: disponible={lote.cantidad_actual}")
    saldo_ant = lote.cantidad_actual
    lote.cantidad_actual -= cantidad
    if lote.cantidad_actual <= 0:
        lote.estado = "agotado"
    lote.fecha_modificacion = utcnow()
    mov = MovimientoInventario(
        id_inventario=lote.id_inventario,
        tipo="PLANTACION",
        cantidad=cantidad,
        saldo_anterior=saldo_ant,
        saldo_nuevo=lote.cantidad_actual,
        motivo="Alta planta en testblock (directo vivero)",
        referencia_destino=referencia,
        usuario=usuario,
    )
    db.add(mov)


def _discount_stock_testblock(
    db: Session,
    inv_tb: InventarioTestBlock,
    cantidad: int,
) -> None:
    """Deducir stock del inventario en testblock (flujo correcto post-despacho)."""
    disponible = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
    if disponible < cantidad:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente en testblock: disponible={disponible}, requerido={cantidad}",
        )
    inv_tb.cantidad_plantada = (inv_tb.cantidad_plantada or 0) + cantidad
    if inv_tb.cantidad_plantada >= (inv_tb.cantidad_asignada or 0):
        inv_tb.estado = "completado"
        inv_tb.fecha_completado = utcnow()


def _find_inventario_testblock(
    db: Session,
    id_inventario: int,
    id_cuartel: int | None,
) -> InventarioTestBlock | None:
    """Buscar registro de inventario_testblock para un lote y cuartel."""
    if not id_cuartel:
        return None
    return (
        db.query(InventarioTestBlock)
        .filter(
            InventarioTestBlock.id_inventario == id_inventario,
            InventarioTestBlock.id_cuartel == id_cuartel,
            InventarioTestBlock.estado == "pendiente",
        )
        .first()
    )


def alta_planta(db: Session, tb_id: int, data: AltaPlantaRequest, usuario: str | None = None) -> dict:
    tb = _get_testblock(db, tb_id)
    pos = db.query(PosicionTestBlock).filter(PosicionTestBlock.id_posicion == data.id_posicion).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Posicion no encontrada")
    if pos.estado == "alta":
        raise HTTPException(status_code=400, detail="Posicion ya tiene planta activa. Debe dar de baja primero.")

    lote = db.query(InventarioVivero).filter(InventarioVivero.id_inventario == data.id_lote).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    # Try to deduct from inventario_testblock first (correct flow: post-despacho)
    inv_tb = _find_inventario_testblock(db, lote.id_inventario, tb.id_cuartel)
    use_tb_stock = inv_tb is not None
    if use_tb_stock:
        _discount_stock_testblock(db, inv_tb, 1)
    else:
        # Fallback: deduct directly from vivero (backward compat)
        if lote.cantidad_actual <= 0:
            raise HTTPException(status_code=400, detail="Sin stock disponible en el lote")
        # _discount_stock_vivero creates its own movimiento record
        _discount_stock_vivero(db, lote, 1, usuario, pos.codigo_unico)

    # Create planta
    planta = Planta(
        codigo=pos.codigo_unico,
        id_posicion=pos.id_posicion,
        id_variedad=lote.id_variedad,
        id_portainjerto=lote.id_portainjerto,
        id_especie=lote.id_especie,
        id_pmg=lote.id_pmg,
        id_lote_origen=lote.id_inventario,
        fecha_alta=utcnow(),
        observaciones=data.observaciones,
        usuario_creacion=usuario,
    )
    db.add(planta)
    db.flush()

    # Update posicion
    estado_anterior = pos.estado
    pos.estado = "alta"
    pos.id_variedad = lote.id_variedad
    pos.id_portainjerto = lote.id_portainjerto
    pos.id_pmg = lote.id_pmg
    pos.id_lote = lote.id_inventario
    pos.fecha_alta = utcnow()
    pos.fecha_plantacion = utcnow()
    pos.usuario_alta = usuario
    pos.fecha_modificacion = utcnow()

    # Create movimiento record only for testblock stock path
    # (vivero path already creates its own movimiento in _discount_stock_vivero)
    if use_tb_stock:
        disp_antes = (inv_tb.cantidad_asignada or 0) - ((inv_tb.cantidad_plantada or 0) - 1)
        disp_despues = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        mov = MovimientoInventario(
            id_inventario=lote.id_inventario,
            id_planta=planta.id_planta,
            tipo="PLANTACION",
            cantidad=1,
            saldo_anterior=disp_antes,
            saldo_nuevo=disp_despues,
            motivo="Alta planta desde inventario testblock",
            referencia_destino=pos.codigo_unico,
            usuario=usuario,
        )
        db.add(mov)

    # History
    hist = HistorialPosicion(
        id_posicion=pos.id_posicion,
        id_planta=planta.id_planta,
        accion="alta",
        estado_anterior=estado_anterior,
        estado_nuevo="alta",
        usuario=usuario,
    )
    db.add(hist)
    db.commit()
    db.refresh(planta)
    return {"id_planta": planta.id_planta, "posicion": pos.codigo_unico}


def alta_masiva(db: Session, tb_id: int, data: AltaMasivaRequest, usuario: str | None = None) -> dict:
    tb = _get_testblock(db, tb_id)
    lote = db.query(InventarioVivero).filter(InventarioVivero.id_inventario == data.id_lote).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    posiciones = (
        db.query(PosicionTestBlock)
        .filter(
            PosicionTestBlock.id_testblock == tb_id,
            PosicionTestBlock.hilera >= data.h_desde,
            PosicionTestBlock.hilera <= data.h_hasta,
            PosicionTestBlock.posicion >= data.p_desde,
            PosicionTestBlock.posicion <= data.p_hasta,
            PosicionTestBlock.estado == "vacia",
        )
        .order_by(PosicionTestBlock.hilera, PosicionTestBlock.posicion)
        .all()
    )

    if not posiciones:
        raise HTTPException(status_code=400, detail="No hay posiciones vacias en el rango especificado")

    cantidad_requerida = len(posiciones)

    # Determine stock source: inventario_testblock or vivero (fallback)
    inv_tb = _find_inventario_testblock(db, lote.id_inventario, tb.id_cuartel)
    if inv_tb:
        disponible_tb = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        if disponible_tb < cantidad_requerida:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente en testblock: disponible={disponible_tb}, requerido={cantidad_requerida}",
            )
        use_testblock_stock = True
    else:
        if lote.cantidad_actual < cantidad_requerida:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente en vivero: disponible={lote.cantidad_actual}, requerido={cantidad_requerida}",
            )
        use_testblock_stock = False

    planted = 0
    for pos in posiciones:
        planta = Planta(
            codigo=pos.codigo_unico,
            id_posicion=pos.id_posicion,
            id_variedad=lote.id_variedad,
            id_portainjerto=lote.id_portainjerto,
            id_especie=lote.id_especie,
            id_pmg=lote.id_pmg,
            id_lote_origen=lote.id_inventario,
            fecha_alta=utcnow(),
            observaciones=data.observaciones,
            usuario_creacion=usuario,
        )
        db.add(planta)
        db.flush()

        estado_ant = pos.estado
        pos.estado = "alta"
        pos.id_variedad = lote.id_variedad
        pos.id_portainjerto = lote.id_portainjerto
        pos.id_pmg = lote.id_pmg
        pos.id_lote = lote.id_inventario
        pos.fecha_alta = utcnow()
        pos.fecha_plantacion = utcnow()
        pos.usuario_alta = usuario
        pos.fecha_modificacion = utcnow()

        hist = HistorialPosicion(
            id_posicion=pos.id_posicion,
            id_planta=planta.id_planta,
            accion="alta_masiva",
            estado_anterior=estado_ant,
            estado_nuevo="alta",
            usuario=usuario,
        )
        db.add(hist)
        planted += 1

    # Discount stock in bulk from the correct source
    if use_testblock_stock:
        disp_antes = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        _discount_stock_testblock(db, inv_tb, planted)
        disp_despues = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        mov = MovimientoInventario(
            id_inventario=lote.id_inventario,
            tipo="PLANTACION",
            cantidad=planted,
            saldo_anterior=disp_antes,
            saldo_nuevo=disp_despues,
            motivo="Alta masiva desde inventario testblock",
            referencia_destino=f"alta_masiva TB-{tb_id}",
            usuario=usuario,
        )
        db.add(mov)
    else:
        # _discount_stock_vivero creates its own movimiento record
        _discount_stock_vivero(db, lote, planted, usuario, f"alta_masiva TB-{tb_id}")

    db.commit()
    return {"planted": planted, "testblock_id": tb_id}


def baja_planta(db: Session, tb_id: int, data: BajaPlantaRequest, usuario: str | None = None) -> dict:
    pos = db.query(PosicionTestBlock).filter(PosicionTestBlock.id_posicion == data.id_posicion).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Posicion no encontrada")
    if pos.estado != "alta":
        raise HTTPException(status_code=400, detail="Posicion no tiene planta activa")

    planta = db.query(Planta).filter(Planta.id_posicion == pos.id_posicion, Planta.activa == True).first()
    if planta:
        planta.activa = False
        planta.fecha_baja = utcnow()
        planta.motivo_baja = data.motivo
        planta.observaciones = data.observaciones
        planta.usuario_modificacion = usuario

    estado_ant = pos.estado
    pos.estado = "baja"
    pos.fecha_baja = utcnow()
    pos.motivo_baja = data.motivo
    pos.usuario_baja = usuario
    pos.fecha_modificacion = utcnow()

    hist = HistorialPosicion(
        id_posicion=pos.id_posicion,
        id_planta=planta.id_planta if planta else None,
        accion="baja",
        estado_anterior=estado_ant,
        estado_nuevo="baja",
        motivo=data.motivo,
        usuario=usuario,
    )
    db.add(hist)
    db.commit()
    return {"ok": True, "posicion": pos.codigo_unico}


def baja_masiva(db: Session, tb_id: int, data: BajaMasivaRequest, usuario: str | None = None) -> dict:
    count = 0
    errores: list[dict] = []
    for pid in data.ids_posiciones:
        try:
            baja_planta(db, tb_id, BajaPlantaRequest(id_posicion=pid, motivo=data.motivo, observaciones=data.observaciones), usuario)
            count += 1
        except HTTPException as e:
            errores.append({"id_posicion": pid, "error": e.detail})
        except Exception as e:
            errores.append({"id_posicion": pid, "error": str(e)})
    return {
        "bajas": count,
        "total_solicitadas": len(data.ids_posiciones),
        "errores": errores,
    }


def replante_planta(db: Session, tb_id: int, data: ReplantePlantaRequest, usuario: str | None = None) -> dict:
    tb = _get_testblock(db, tb_id)
    pos = db.query(PosicionTestBlock).filter(PosicionTestBlock.id_posicion == data.id_posicion).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Posicion no encontrada")
    if pos.estado == "vacia":
        raise HTTPException(status_code=400, detail="Posicion vacia — use Alta en vez de Replante")

    # If active plant exists (estado=alta), do baja first (no stock return)
    if pos.estado == "alta":
        planta_vieja = db.query(Planta).filter(Planta.id_posicion == pos.id_posicion, Planta.activa == True).first()
        if planta_vieja:
            planta_vieja.activa = False
            planta_vieja.fecha_baja = utcnow()
            planta_vieja.motivo_baja = data.motivo or "Replante"
            planta_vieja.usuario_modificacion = usuario
    # estado=baja or estado=replante: old plant already inactive, proceed directly

    lote = db.query(InventarioVivero).filter(InventarioVivero.id_inventario == data.id_lote).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    # Check stock availability in testblock inventory or vivero
    inv_tb_check = _find_inventario_testblock(db, lote.id_inventario, tb.id_cuartel)
    if not inv_tb_check and lote.cantidad_actual <= 0:
        raise HTTPException(status_code=400, detail="Sin stock disponible")

    planta_nueva = Planta(
        codigo=pos.codigo_unico,
        id_posicion=pos.id_posicion,
        id_variedad=lote.id_variedad,
        id_portainjerto=lote.id_portainjerto,
        id_especie=lote.id_especie,
        id_pmg=lote.id_pmg,
        id_lote_origen=lote.id_inventario,
        fecha_alta=utcnow(),
        usuario_creacion=usuario,
    )
    db.add(planta_nueva)
    db.flush()

    estado_ant = pos.estado
    pos.estado = "replante"
    pos.id_variedad = lote.id_variedad
    pos.id_portainjerto = lote.id_portainjerto
    pos.id_pmg = lote.id_pmg
    pos.id_lote = lote.id_inventario
    pos.fecha_alta = utcnow()
    pos.fecha_plantacion = utcnow()
    pos.usuario_alta = usuario
    pos.fecha_modificacion = utcnow()

    # Discount stock from testblock inventory or vivero (fallback)
    inv_tb = _find_inventario_testblock(db, lote.id_inventario, tb.id_cuartel)
    if inv_tb:
        disp_antes = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        _discount_stock_testblock(db, inv_tb, 1)
        disp_despues = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        mov = MovimientoInventario(
            id_inventario=lote.id_inventario,
            id_planta=planta_nueva.id_planta,
            tipo="PLANTACION",
            cantidad=1,
            saldo_anterior=disp_antes,
            saldo_nuevo=disp_despues,
            motivo="Replante desde inventario testblock",
            referencia_destino=pos.codigo_unico,
            usuario=usuario,
        )
        db.add(mov)
    else:
        _discount_stock_vivero(db, lote, 1, usuario, pos.codigo_unico)

    hist = HistorialPosicion(
        id_posicion=pos.id_posicion,
        id_planta=planta_nueva.id_planta,
        accion="replante",
        estado_anterior=estado_ant,
        estado_nuevo="replante",
        motivo=data.motivo,
        usuario=usuario,
    )
    db.add(hist)
    db.commit()
    db.refresh(planta_nueva)
    return {"id_planta": planta_nueva.id_planta, "posicion": pos.codigo_unico}


def get_grilla(db: Session, tb_id: int) -> dict:
    """Return grid data for the testblock, enriched with active plant info."""
    posiciones = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == tb_id)
        .order_by(PosicionTestBlock.hilera, PosicionTestBlock.posicion)
        .all()
    )
    if not posiciones:
        return {"hileras": 0, "max_pos": 0, "posiciones": []}

    # Build a map of id_posicion -> active plant for positions with estado "alta" or "replante"
    plant_map: dict[int, Planta] = {}
    pos_with_plant_ids = [p.id_posicion for p in posiciones if p.estado in ("alta", "replante")]
    if pos_with_plant_ids:
        plantas = (
            db.query(Planta)
            .filter(
                Planta.id_posicion.in_(pos_with_plant_ids),
                Planta.activa == True,
            )
            .all()
        )
        for pl in plantas:
            plant_map[pl.id_posicion] = pl

    max_h = max(p.hilera for p in posiciones)
    max_p = max(p.posicion for p in posiciones)

    # Serialize positions and enrich with plant data
    result = []
    for p in posiciones:
        data = {c: getattr(p, c) for c in p.__class__.model_fields}
        planta = plant_map.get(p.id_posicion)
        if planta:
            data["planta_id"] = planta.id_planta
            data["planta_codigo"] = planta.codigo
            data["planta_variedad"] = planta.id_variedad
            data["planta_portainjerto"] = planta.id_portainjerto
            data["planta_especie"] = planta.id_especie
            data["planta_condicion"] = planta.condicion
        result.append(data)

    return {
        "hileras": max_h,
        "max_pos": max_p,
        "posiciones": result,
    }


def get_resumen_hileras(db: Session, tb_id: int) -> list[dict]:
    posiciones = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == tb_id)
        .all()
    )
    hileras: dict[int, dict] = {}
    for p in posiciones:
        h = p.hilera
        if h not in hileras:
            hileras[h] = {"hilera": h, "total": 0, "alta": 0, "vacia": 0, "baja": 0, "replante": 0}
        hileras[h]["total"] += 1
        estado = p.estado or "vacia"
        if estado in hileras[h]:
            hileras[h][estado] += 1
    return sorted(hileras.values(), key=lambda x: x["hilera"])


def get_resumen_variedades(db: Session, tb_id: int) -> list[dict]:
    """Return variety summary using plant data (preferred) with position fallback."""
    from app.models.variedades import Variedad

    posiciones = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == tb_id, PosicionTestBlock.estado.in_(["alta", "replante"]))
        .all()
    )

    # Fetch active plants linked to these positions
    pos_ids = [p.id_posicion for p in posiciones]
    plant_map: dict[int, Planta] = {}
    if pos_ids:
        plantas = (
            db.query(Planta)
            .filter(
                Planta.id_posicion.in_(pos_ids),
                Planta.activa == True,
            )
            .all()
        )
        for pl in plantas:
            plant_map[pl.id_posicion] = pl

    var_count: dict[int, int] = {}
    for p in posiciones:
        # Prefer plant's id_variedad, fallback to position's id_variedad
        planta = plant_map.get(p.id_posicion)
        vid = (planta.id_variedad if planta and planta.id_variedad else None) or p.id_variedad
        if vid:
            var_count[vid] = var_count.get(vid, 0) + 1

    total = sum(var_count.values()) or 1

    # Batch-fetch all varieties at once instead of N+1
    var_ids = list(var_count.keys())
    var_map: dict[int, str] = {}
    if var_ids:
        vars_db = db.query(Variedad.id_variedad, Variedad.nombre).filter(
            Variedad.id_variedad.in_(var_ids)
        ).all()
        var_map = {v[0]: v[1] for v in vars_db}

    result = []
    for vid, cnt in var_count.items():
        result.append({
            "id_variedad": vid,
            "variedad": var_map.get(vid, str(vid)),
            "cantidad": cnt,
            "pct": round(cnt / total * 100, 1),
        })
    return sorted(result, key=lambda x: x["cantidad"], reverse=True)


def agregar_hilera(db: Session, tb_id: int, num_posiciones: int, usuario: str | None = None) -> int:
    tb = _get_testblock(db, tb_id)
    cuartel_code = _get_cuartel_codigo(db, tb.id_cuartel)

    # Find next hilera number
    max_h = db.query(func.max(PosicionTestBlock.hilera)).filter(
        PosicionTestBlock.id_testblock == tb_id
    ).scalar() or 0
    new_h = max_h + 1

    count = 0
    for pi in range(1, num_posiciones + 1):
        cod = f"{cuartel_code}-H{new_h:02d}-P{pi:02d}"
        pos = PosicionTestBlock(
            codigo_unico=cod,
            id_cuartel=tb.id_cuartel,
            id_testblock=tb_id,
            hilera=new_h,
            posicion=pi,
            estado="vacia",
        )
        db.add(pos)
        count += 1

    tb.num_hileras = new_h
    tb.total_posiciones = (tb.total_posiciones or 0) + count
    tb.fecha_modificacion = utcnow()
    db.commit()
    return count


def eliminar_hilera(db: Session, tb_id: int, hilera: int, usuario: str | None = None) -> dict:
    """Delete all positions in a hilera. Only empty/baja positions can be deleted."""
    tb = _get_testblock(db, tb_id)
    posiciones = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == tb_id, PosicionTestBlock.hilera == hilera)
        .all()
    )
    if not posiciones:
        raise HTTPException(status_code=404, detail=f"Hilera {hilera} no encontrada")

    activas = [p for p in posiciones if p.estado in ("alta", "replante")]
    if activas:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar: {len(activas)} posicion(es) tienen planta activa. Dar de baja primero.",
        )

    count = len(posiciones)
    for p in posiciones:
        db.delete(p)
    tb.total_posiciones = max((tb.total_posiciones or 0) - count, 0)
    tb.fecha_modificacion = utcnow()
    db.commit()
    return {"deleted": count, "hilera": hilera}


def eliminar_posiciones(db: Session, tb_id: int, ids_posiciones: list[int], usuario: str | None = None) -> dict:
    """Delete specific positions by ID. Only empty/baja positions can be deleted."""
    tb = _get_testblock(db, tb_id)
    posiciones = (
        db.query(PosicionTestBlock)
        .filter(
            PosicionTestBlock.id_testblock == tb_id,
            PosicionTestBlock.id_posicion.in_(ids_posiciones),
        )
        .all()
    )
    if not posiciones:
        raise HTTPException(status_code=404, detail="Posiciones no encontradas")

    activas = [p for p in posiciones if p.estado in ("alta", "replante")]
    if activas:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar: {len(activas)} posicion(es) tienen planta activa. Dar de baja primero.",
        )

    count = len(posiciones)
    for p in posiciones:
        db.delete(p)
    tb.total_posiciones = max((tb.total_posiciones or 0) - count, 0)
    tb.fecha_modificacion = utcnow()
    db.commit()
    return {"deleted": count}


def agregar_posiciones(db: Session, tb_id: int, hilera: int, cantidad: int, usuario: str | None = None) -> int:
    tb = _get_testblock(db, tb_id)
    cuartel_code = _get_cuartel_codigo(db, tb.id_cuartel)

    max_p = db.query(func.max(PosicionTestBlock.posicion)).filter(
        PosicionTestBlock.id_testblock == tb_id,
        PosicionTestBlock.hilera == hilera,
    ).scalar() or 0

    count = 0
    for pi in range(max_p + 1, max_p + 1 + cantidad):
        cod = f"{cuartel_code}-H{hilera:02d}-P{pi:02d}"
        pos = PosicionTestBlock(
            codigo_unico=cod,
            id_cuartel=tb.id_cuartel,
            id_testblock=tb_id,
            hilera=hilera,
            posicion=pi,
            estado="vacia",
        )
        db.add(pos)
        count += 1

    tb.total_posiciones = (tb.total_posiciones or 0) + count
    tb.fecha_modificacion = utcnow()
    db.commit()
    return count


def get_inventario_testblock(db: Session, tb_id: int) -> list[dict]:
    """Return inventario_testblock records for a testblock, joined with lote info."""
    from app.models.variedades import Variedad
    from app.models.maestras import Portainjerto

    tb = _get_testblock(db, tb_id)
    if not tb.id_cuartel:
        return []

    records = (
        db.query(InventarioTestBlock)
        .filter(InventarioTestBlock.id_cuartel == tb.id_cuartel)
        .all()
    )

    result = []
    for rec in records:
        lote = db.query(InventarioVivero).filter(InventarioVivero.id_inventario == rec.id_inventario).first()

        variedad_nombre = None
        portainjerto_nombre = None
        codigo_lote = None

        if lote:
            codigo_lote = lote.codigo_lote
            if lote.id_variedad:
                var = db.query(Variedad).filter(Variedad.id_variedad == lote.id_variedad).first()
                variedad_nombre = var.nombre if var else None
            if lote.id_portainjerto:
                pi = db.query(Portainjerto).filter(Portainjerto.id_portainjerto == lote.id_portainjerto).first()
                portainjerto_nombre = pi.nombre if pi else None

        disponible = (rec.cantidad_asignada or 0) - (rec.cantidad_plantada or 0)
        result.append({
            "id_inventario_tb": rec.id_inventario_tb,
            "id_inventario": rec.id_inventario,
            "id_cuartel": rec.id_cuartel,
            "codigo_lote": codigo_lote,
            "variedad": variedad_nombre,
            "portainjerto": portainjerto_nombre,
            "cantidad_asignada": rec.cantidad_asignada or 0,
            "cantidad_plantada": rec.cantidad_plantada or 0,
            "disponible": disponible,
            "estado": rec.estado,
            "fecha_despacho": rec.fecha_despacho,
            "fecha_completado": rec.fecha_completado,
            "observaciones": rec.observaciones,
        })

    return result
