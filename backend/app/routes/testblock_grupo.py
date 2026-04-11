"""TestBlock group action endpoints: baja, fenologia, labores, polinizante, QR, alta, replante, historial, deshacer."""

import io
import json
import logging
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.utils import utcnow
from app.models.sistema import Usuario
from app.models.testblock import (
    TestBlock,
    PosicionTestBlock,
    Planta,
    HistorialPosicion,
)
from app.models.inventario import InventarioVivero, MovimientoInventario, InventarioTestBlock
from app.models.laboratorio import EjecucionLabor, RegistroFenologico
from app.models.maestras import TipoLabor, EstadoFenologico
from app.models.variedades_extra import TestblockEvento
from app.services import crud

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/testblocks", tags=["TestBlock Grupo"])


# ---------------------------------------------------------------------------
# Helper: resolve positions from selection modes
# ---------------------------------------------------------------------------

def _resolve_posiciones(
    db: Session,
    testblock_id: int,
    data: dict,
) -> list[PosicionTestBlock]:
    """Return list of PosicionTestBlock objects based on selection mode in data.

    Selection modes (mutually exclusive, checked in order):
      - posicion_ids: list[int]            -- explicit list
      - filtro_variedad_id + filtro_portainjerto_id  -- combo filter
      - filtro_variedad_id: int            -- all positions with that variedad
      - filtro_hilera_id: int              -- all positions in a hilera number
    """
    # Validate testblock exists
    tb = db.query(TestBlock).filter(TestBlock.id_testblock == testblock_id).first()
    if not tb:
        raise HTTPException(status_code=404, detail="TestBlock no encontrado")

    posicion_ids = data.get("posicion_ids")
    filtro_variedad_id = data.get("filtro_variedad_id")
    filtro_portainjerto_id = data.get("filtro_portainjerto_id")
    filtro_hilera_id = data.get("filtro_hilera_id")

    q = db.query(PosicionTestBlock).filter(
        PosicionTestBlock.id_testblock == testblock_id,
    )

    if posicion_ids:
        q = q.filter(PosicionTestBlock.id_posicion.in_(posicion_ids))
    elif filtro_variedad_id is not None and filtro_portainjerto_id is not None:
        q = q.filter(
            PosicionTestBlock.id_variedad == filtro_variedad_id,
            PosicionTestBlock.id_portainjerto == filtro_portainjerto_id,
        )
    elif filtro_variedad_id is not None:
        q = q.filter(PosicionTestBlock.id_variedad == filtro_variedad_id)
    elif filtro_hilera_id is not None:
        q = q.filter(PosicionTestBlock.hilera == filtro_hilera_id)
    else:
        # No selection filter provided -- return all positions in testblock
        pass

    return q.order_by(PosicionTestBlock.hilera, PosicionTestBlock.posicion).all()


def _log_evento(
    db: Session,
    testblock_id: int,
    posicion_ids: list[int],
    tipo_evento: str,
    datos_antes: dict | None,
    datos_despues: dict | None,
    usuario: str,
) -> TestblockEvento:
    """Create a single TestblockEvento record summarising the group action."""
    evento = TestblockEvento(
        id_testblock=testblock_id,
        id_posicion=posicion_ids[0] if posicion_ids else 0,
        tipo_evento=tipo_evento,
        datos_antes=json.dumps(
            {"posicion_ids": posicion_ids, **(datos_antes or {})},
            default=str,
            ensure_ascii=False,
        ),
        datos_despues=json.dumps(
            {"posicion_ids": posicion_ids, **(datos_despues or {})},
            default=str,
            ensure_ascii=False,
        ),
        created_by=usuario,
        created_at=utcnow(),
        revertido=False,
    )
    db.add(evento)
    return evento


# ---------------------------------------------------------------------------
# 1. POST /testblocks/{id}/grupo/baja
# ---------------------------------------------------------------------------

@router.post("/{id}/grupo/baja")
def grupo_baja(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Baja grupal: dar de baja todas las posiciones seleccionadas con estado='alta'."""
    posiciones = _resolve_posiciones(db, id, data)
    activas = [p for p in posiciones if p.estado == "alta"]

    if not activas:
        raise HTTPException(status_code=400, detail="No hay posiciones con estado 'alta' en la seleccion")

    motivo = data.get("motivo", "Baja grupal")
    today = date.today()
    affected_ids: list[int] = []

    for pos in activas:
        # Deactivate linked plant
        planta = (
            db.query(Planta)
            .filter(Planta.id_posicion == pos.id_posicion, Planta.activa == True)
            .first()
        )
        if planta:
            planta.activa = False
            planta.fecha_baja = today
            planta.motivo_baja = motivo
            planta.usuario_modificacion = user.username

        estado_anterior = pos.estado
        pos.estado = "baja"
        pos.fecha_baja = today
        pos.motivo_baja = motivo
        pos.usuario_baja = user.username
        pos.fecha_modificacion = utcnow()

        # Position history
        hist = HistorialPosicion(
            id_posicion=pos.id_posicion,
            id_planta=planta.id_planta if planta else None,
            accion="baja",
            estado_anterior=estado_anterior,
            estado_nuevo="baja",
            motivo=motivo,
            usuario=user.username,
        )
        db.add(hist)
        affected_ids.append(pos.id_posicion)

    _log_evento(
        db, id, affected_ids, "BAJA_GRUPAL",
        datos_antes={"estado": "alta"},
        datos_despues={"estado": "baja", "motivo": motivo},
        usuario=user.username,
    )
    db.commit()

    return {"affected": len(affected_ids), "posiciones": affected_ids}


# ---------------------------------------------------------------------------
# 2. POST /testblocks/{id}/grupo/fenologia
# ---------------------------------------------------------------------------

@router.post("/{id}/grupo/fenologia")
def grupo_fenologia(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo", "laboratorio", "operador")),
):
    """Registro fenologico grupal para posiciones con planta activa."""
    posiciones = _resolve_posiciones(db, id, data)
    activas = [p for p in posiciones if p.estado in ("alta", "replante")]

    if not activas:
        raise HTTPException(status_code=400, detail="No hay posiciones con planta activa en la seleccion")

    id_estado_fenol = data.get("estado_fenologico_id") or data.get("id_estado_fenol")
    if not id_estado_fenol:
        raise HTTPException(status_code=400, detail="Debe indicar estado_fenologico_id")

    estado_fenol = db.get(EstadoFenologico, id_estado_fenol)
    if not estado_fenol:
        raise HTTPException(status_code=404, detail=f"Estado fenologico {id_estado_fenol} no encontrado")

    fecha = data.get("fecha", date.today().isoformat())
    observaciones = data.get("observaciones", "")
    temporada = data.get("temporada", "2025-2026")
    porcentaje = data.get("porcentaje")

    # Get the REG_FENOL tipo_labor for the EjecucionLabor entry
    tipo_labor = db.query(TipoLabor).filter(TipoLabor.codigo == "REG_FENOL").first()

    created = 0
    affected_ids: list[int] = []
    for pos in activas:
        id_planta = None
        planta = (
            db.query(Planta)
            .filter(Planta.id_posicion == pos.id_posicion, Planta.activa == True)
            .first()
        )
        if planta:
            id_planta = planta.id_planta

        # Create EjecucionLabor entry if tipo_labor exists
        if tipo_labor:
            obs_text = (
                f"{estado_fenol.nombre}: {porcentaje}% - {observaciones}"
                if porcentaje
                else f"{estado_fenol.nombre} - {observaciones}"
            )
            ej = EjecucionLabor(
                id_labor=tipo_labor.id_labor,
                id_posicion=pos.id_posicion,
                id_planta=id_planta,
                temporada=temporada,
                fecha_programada=fecha,
                fecha_ejecucion=fecha,
                estado="ejecutada",
                ejecutor=user.username,
                observaciones=obs_text,
                usuario_registro=user.username,
            )
            db.add(ej)

        # Create RegistroFenologico entry
        reg = RegistroFenologico(
            id_posicion=pos.id_posicion,
            id_planta=id_planta,
            id_estado_fenol=id_estado_fenol,
            temporada=temporada,
            fecha_registro=fecha,
            porcentaje=porcentaje,
            observaciones=observaciones,
            usuario_registro=user.username,
        )
        db.add(reg)
        created += 1
        affected_ids.append(pos.id_posicion)

    _log_evento(
        db, id, affected_ids, "FENOLOGIA_GRUPAL",
        datos_antes=None,
        datos_despues={"estado_fenologico_id": id_estado_fenol, "fecha": fecha},
        usuario=user.username,
    )
    db.commit()

    return {"created": created}


# ---------------------------------------------------------------------------
# 3. POST /testblocks/{id}/grupo/labores
# ---------------------------------------------------------------------------

@router.post("/{id}/grupo/labores")
def grupo_labores(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo", "operador")),
):
    """Registro de labor grupal para posiciones con planta activa."""
    posiciones = _resolve_posiciones(db, id, data)
    activas = [p for p in posiciones if p.estado in ("alta", "replante")]

    if not activas:
        raise HTTPException(status_code=400, detail="No hay posiciones con planta activa en la seleccion")

    id_labor = data.get("id_labor")
    if not id_labor:
        raise HTTPException(status_code=400, detail="Debe indicar id_labor")

    tipo_labor = db.get(TipoLabor, id_labor)
    if not tipo_labor:
        raise HTTPException(status_code=404, detail=f"Tipo de labor {id_labor} no encontrado")

    fecha_programada = data.get("fecha_programada", date.today().isoformat())
    observaciones = data.get("observaciones", "")
    temporada = data.get("temporada", "2025-2026")

    created = 0
    affected_ids: list[int] = []
    for pos in activas:
        id_planta = None
        planta = (
            db.query(Planta)
            .filter(Planta.id_posicion == pos.id_posicion, Planta.activa == True)
            .first()
        )
        if planta:
            id_planta = planta.id_planta

        ej = EjecucionLabor(
            id_labor=id_labor,
            id_posicion=pos.id_posicion,
            id_planta=id_planta,
            temporada=temporada,
            fecha_programada=fecha_programada,
            fecha_ejecucion=None,
            estado="programada",
            ejecutor=user.username,
            observaciones=observaciones,
            usuario_registro=user.username,
        )
        db.add(ej)
        created += 1
        affected_ids.append(pos.id_posicion)

    _log_evento(
        db, id, affected_ids, "LABOR_GRUPAL",
        datos_antes=None,
        datos_despues={"id_labor": id_labor, "fecha_programada": fecha_programada},
        usuario=user.username,
    )
    db.commit()

    return {"created": created}


# ---------------------------------------------------------------------------
# 4. POST /testblocks/{id}/grupo/polinizante
# ---------------------------------------------------------------------------

@router.post("/{id}/grupo/polinizante")
def grupo_polinizante(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Toggle polinizante (protegida) flag for selected positions.

    The `protegida` boolean field on PosicionTestBlock is used to mark
    polinizante positions (shown in amber/orange in the grid).
    """
    posiciones = _resolve_posiciones(db, id, data)
    activas = [p for p in posiciones if p.estado in ("alta", "replante")]

    if not activas:
        raise HTTPException(status_code=400, detail="No hay posiciones con planta activa en la seleccion")

    es_polinizante = data.get("es_polinizante", True)

    affected_ids: list[int] = []
    for pos in activas:
        pos.protegida = bool(es_polinizante)
        pos.fecha_modificacion = utcnow()
        affected_ids.append(pos.id_posicion)

    _log_evento(
        db, id, affected_ids, "POLINIZANTE_GRUPAL",
        datos_antes={"protegida": not es_polinizante},
        datos_despues={"protegida": es_polinizante},
        usuario=user.username,
    )
    db.commit()

    return {"affected": len(affected_ids), "posiciones": affected_ids}


# ---------------------------------------------------------------------------
# 5. POST /testblocks/{id}/grupo/qr
# ---------------------------------------------------------------------------

@router.post("/{id}/grupo/qr")
def grupo_qr(
    id: int,
    data: dict | None = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Generate PDF with QR codes for selected positions, grouped by variedad+portainjerto.

    If no selection is provided, generates QR for all positions with plants.
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader
    import qrcode

    if data is None:
        data = {}

    posiciones = _resolve_posiciones(db, id, data)

    # Filter to positions with plants unless explicitly selecting empty ones
    if data.get("posicion_ids"):
        target = posiciones
    else:
        target = [p for p in posiciones if p.estado in ("alta", "replante")]

    if not target:
        raise HTTPException(status_code=400, detail="No hay posiciones para generar QR")

    # Fetch testblock name for QR content
    tb = db.query(TestBlock).filter(TestBlock.id_testblock == id).first()
    tb_name = tb.nombre if tb else f"TB-{id}"

    # Fetch variedad and portainjerto names in bulk
    from app.models.variedades import Variedad
    from app.models.maestras import Portainjerto

    var_ids = list({p.id_variedad for p in target if p.id_variedad})
    pi_ids = list({p.id_portainjerto for p in target if p.id_portainjerto})

    var_map: dict[int, str] = {}
    if var_ids:
        for v in db.query(Variedad.id_variedad, Variedad.nombre).filter(Variedad.id_variedad.in_(var_ids)).all():
            var_map[v[0]] = v[1]

    pi_map: dict[int, str] = {}
    if pi_ids:
        for p in db.query(Portainjerto.id_portainjerto, Portainjerto.nombre).filter(Portainjerto.id_portainjerto.in_(pi_ids)).all():
            pi_map[p[0]] = p[1]

    # Sort by variedad + portainjerto for grouping
    def sort_key(pos: PosicionTestBlock):
        return (
            var_map.get(pos.id_variedad, "") if pos.id_variedad else "",
            pi_map.get(pos.id_portainjerto, "") if pos.id_portainjerto else "",
            pos.hilera,
            pos.posicion,
        )

    target.sort(key=sort_key)

    # Generate PDF
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    w, h = letter
    x, y = 50, h - 80
    col_w, row_h = 140, 130

    current_group = None
    for pos in target:
        variedad_name = var_map.get(pos.id_variedad, "?") if pos.id_variedad else "?"
        pi_name = pi_map.get(pos.id_portainjerto, "?") if pos.id_portainjerto else "?"
        group_key = f"{variedad_name} / {pi_name}"

        # Print group header when it changes
        if group_key != current_group:
            if current_group is not None:
                # Start on new line for new group
                x = 50
                y -= row_h
                if y < 80:
                    c.showPage()
                    y = h - 80
            c.setFont("Helvetica-Bold", 10)
            c.drawString(50, y, group_key)
            y -= 20
            x = 50
            current_group = group_key

        # QR content
        qr_content = f"{tb_name}|{variedad_name}|{pi_name}|H{pos.hilera}-P{pos.posicion}"
        img = qrcode.make(qr_content)
        img_buf = io.BytesIO()
        img.save(img_buf, format="PNG")
        img_buf.seek(0)

        c.drawImage(ImageReader(img_buf), x, y - 80, 80, 80)
        c.setFont("Helvetica", 6)
        c.drawString(x, y - 88, pos.codigo_unico)
        c.drawString(x, y - 96, f"H{pos.hilera}-P{pos.posicion}")

        x += col_w
        if x > w - col_w:
            x = 50
            y -= row_h
            if y < 80:
                c.showPage()
                y = h - 80

    c.save()
    buf.seek(0)

    filename = f"qr_grupo_tb{id}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# 6. POST /testblocks/{id}/grupo/alta
# ---------------------------------------------------------------------------

@router.post("/{id}/grupo/alta")
def grupo_alta(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Alta grupal: asignar plantas desde un lote a posiciones vacias."""
    id_lote = data.get("id_lote")
    if not id_lote:
        raise HTTPException(status_code=400, detail="Debe indicar id_lote")

    lote = db.query(InventarioVivero).filter(InventarioVivero.id_inventario == id_lote).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    posiciones = _resolve_posiciones(db, id, data)
    vacias = [p for p in posiciones if p.estado in ("vacia", None)]

    if not vacias:
        raise HTTPException(status_code=400, detail="No hay posiciones vacias en la seleccion")

    # Check stock availability
    tb = db.query(TestBlock).filter(TestBlock.id_testblock == id).first()
    inv_tb = None
    if tb and tb.id_cuartel:
        inv_tb = (
            db.query(InventarioTestBlock)
            .filter(
                InventarioTestBlock.id_inventario == lote.id_inventario,
                InventarioTestBlock.id_cuartel == tb.id_cuartel,
                InventarioTestBlock.estado == "pendiente",
            )
            .first()
        )

    cantidad_requerida = len(vacias)

    if inv_tb:
        disponible = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        if disponible < cantidad_requerida:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente en testblock: disponible={disponible}, requerido={cantidad_requerida}",
            )
    else:
        if lote.cantidad_actual < cantidad_requerida:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente en vivero: disponible={lote.cantidad_actual}, requerido={cantidad_requerida}",
            )

    today = date.today()
    affected_ids: list[int] = []

    for pos in vacias:
        # Create plant
        planta = Planta(
            codigo=pos.codigo_unico,
            id_posicion=pos.id_posicion,
            id_variedad=lote.id_variedad,
            id_portainjerto=lote.id_portainjerto,
            id_especie=lote.id_especie,
            id_pmg=lote.id_pmg,
            id_lote_origen=lote.id_inventario,
            fecha_alta=today,
            usuario_creacion=user.username,
        )
        db.add(planta)
        db.flush()

        # Update position
        estado_anterior = pos.estado
        pos.estado = "alta"
        pos.id_variedad = lote.id_variedad
        pos.id_portainjerto = lote.id_portainjerto
        pos.id_pmg = lote.id_pmg
        pos.id_lote = lote.id_inventario
        pos.fecha_alta = today
        pos.fecha_plantacion = today
        pos.usuario_alta = user.username
        pos.fecha_modificacion = utcnow()

        # History
        hist = HistorialPosicion(
            id_posicion=pos.id_posicion,
            id_planta=planta.id_planta,
            accion="alta",
            estado_anterior=estado_anterior or "vacia",
            estado_nuevo="alta",
            usuario=user.username,
        )
        db.add(hist)
        affected_ids.append(pos.id_posicion)

    # Discount stock in bulk
    if inv_tb:
        disp_antes = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        inv_tb.cantidad_plantada = (inv_tb.cantidad_plantada or 0) + cantidad_requerida
        if inv_tb.cantidad_plantada >= (inv_tb.cantidad_asignada or 0):
            inv_tb.estado = "completado"
            inv_tb.fecha_completado = utcnow()
        disp_despues = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        mov = MovimientoInventario(
            id_inventario=lote.id_inventario,
            tipo="PLANTACION",
            cantidad=cantidad_requerida,
            saldo_anterior=disp_antes,
            saldo_nuevo=disp_despues,
            motivo="Alta grupal desde inventario testblock",
            referencia_destino=f"grupo_alta TB-{id}",
            usuario=user.username,
        )
        db.add(mov)
        stock_remaining = disp_despues
    else:
        saldo_ant = lote.cantidad_actual
        lote.cantidad_actual -= cantidad_requerida
        if lote.cantidad_actual <= 0:
            lote.estado = "agotado"
        lote.fecha_modificacion = utcnow()
        mov = MovimientoInventario(
            id_inventario=lote.id_inventario,
            tipo="PLANTACION",
            cantidad=cantidad_requerida,
            saldo_anterior=saldo_ant,
            saldo_nuevo=lote.cantidad_actual,
            motivo="Alta grupal desde vivero",
            referencia_destino=f"grupo_alta TB-{id}",
            usuario=user.username,
        )
        db.add(mov)
        stock_remaining = lote.cantidad_actual

    _log_evento(
        db, id, affected_ids, "ALTA_GRUPAL",
        datos_antes={"estado": "vacia"},
        datos_despues={"estado": "alta", "id_lote": id_lote},
        usuario=user.username,
    )
    db.commit()

    return {"affected": len(affected_ids), "posiciones": affected_ids, "stock_remaining": stock_remaining}


# ---------------------------------------------------------------------------
# 7. POST /testblocks/{id}/grupo/replantar
# ---------------------------------------------------------------------------

@router.post("/{id}/grupo/replantar")
def grupo_replantar(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Replante grupal: replantar posiciones con estado='baja' usando un lote."""
    id_lote = data.get("id_lote")
    if not id_lote:
        raise HTTPException(status_code=400, detail="Debe indicar id_lote")

    lote = db.query(InventarioVivero).filter(InventarioVivero.id_inventario == id_lote).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    posiciones = _resolve_posiciones(db, id, data)
    bajas = [p for p in posiciones if p.estado == "baja"]

    if not bajas:
        raise HTTPException(status_code=400, detail="No hay posiciones con estado 'baja' en la seleccion")

    # Check stock availability
    tb = db.query(TestBlock).filter(TestBlock.id_testblock == id).first()
    inv_tb = None
    if tb and tb.id_cuartel:
        inv_tb = (
            db.query(InventarioTestBlock)
            .filter(
                InventarioTestBlock.id_inventario == lote.id_inventario,
                InventarioTestBlock.id_cuartel == tb.id_cuartel,
                InventarioTestBlock.estado == "pendiente",
            )
            .first()
        )

    cantidad_requerida = len(bajas)

    if inv_tb:
        disponible = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        if disponible < cantidad_requerida:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente en testblock: disponible={disponible}, requerido={cantidad_requerida}",
            )
    else:
        if lote.cantidad_actual < cantidad_requerida:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente en vivero: disponible={lote.cantidad_actual}, requerido={cantidad_requerida}",
            )

    today = date.today()
    affected_ids: list[int] = []

    for pos in bajas:
        # Deactivate old plant and free up the unique codigo
        old_plantas = (
            db.query(Planta)
            .filter(Planta.id_posicion == pos.id_posicion)
            .all()
        )
        for old_p in old_plantas:
            if old_p.activa:
                old_p.activa = False
                old_p.fecha_baja = today
                old_p.motivo_baja = "Replante grupal"
            # Rename old codigo to avoid unique constraint conflict
            if old_p.codigo == pos.codigo_unico:
                old_p.codigo = f"{pos.codigo_unico}_prev_{old_p.id_planta}"
        db.flush()

        # Create new plant
        planta = Planta(
            codigo=pos.codigo_unico,
            id_posicion=pos.id_posicion,
            id_variedad=lote.id_variedad,
            id_portainjerto=lote.id_portainjerto,
            id_especie=lote.id_especie,
            id_pmg=lote.id_pmg,
            id_lote_origen=lote.id_inventario,
            fecha_alta=today,
            usuario_creacion=user.username,
        )
        db.add(planta)
        db.flush()

        # Update position
        estado_anterior = pos.estado
        pos.estado = "replante"
        pos.id_variedad = lote.id_variedad
        pos.id_portainjerto = lote.id_portainjerto
        pos.id_pmg = lote.id_pmg
        pos.id_lote = lote.id_inventario
        pos.fecha_alta = today
        pos.fecha_plantacion = today
        pos.fecha_baja = None
        pos.motivo_baja = None
        pos.usuario_alta = user.username
        pos.usuario_baja = None
        pos.fecha_modificacion = utcnow()

        # History
        hist = HistorialPosicion(
            id_posicion=pos.id_posicion,
            id_planta=planta.id_planta,
            accion="replante",
            estado_anterior=estado_anterior,
            estado_nuevo="replante",
            usuario=user.username,
        )
        db.add(hist)
        affected_ids.append(pos.id_posicion)

    # Discount stock in bulk
    if inv_tb:
        disp_antes = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        inv_tb.cantidad_plantada = (inv_tb.cantidad_plantada or 0) + cantidad_requerida
        if inv_tb.cantidad_plantada >= (inv_tb.cantidad_asignada or 0):
            inv_tb.estado = "completado"
            inv_tb.fecha_completado = utcnow()
        disp_despues = (inv_tb.cantidad_asignada or 0) - (inv_tb.cantidad_plantada or 0)
        mov = MovimientoInventario(
            id_inventario=lote.id_inventario,
            tipo="PLANTACION",
            cantidad=cantidad_requerida,
            saldo_anterior=disp_antes,
            saldo_nuevo=disp_despues,
            motivo="Replante grupal desde inventario testblock",
            referencia_destino=f"grupo_replante TB-{id}",
            usuario=user.username,
        )
        db.add(mov)
    else:
        saldo_ant = lote.cantidad_actual
        lote.cantidad_actual -= cantidad_requerida
        if lote.cantidad_actual <= 0:
            lote.estado = "agotado"
        lote.fecha_modificacion = utcnow()
        mov = MovimientoInventario(
            id_inventario=lote.id_inventario,
            tipo="PLANTACION",
            cantidad=cantidad_requerida,
            saldo_anterior=saldo_ant,
            saldo_nuevo=lote.cantidad_actual,
            motivo="Replante grupal desde vivero",
            referencia_destino=f"grupo_replante TB-{id}",
            usuario=user.username,
        )
        db.add(mov)

    _log_evento(
        db, id, affected_ids, "REPLANTE_GRUPAL",
        datos_antes={"estado": "baja"},
        datos_despues={"estado": "replante", "id_lote": id_lote},
        usuario=user.username,
    )
    db.commit()

    return {"affected": len(affected_ids), "posiciones": affected_ids}


# ---------------------------------------------------------------------------
# GET /testblocks/{id}/historial  (event log)
# ---------------------------------------------------------------------------

@router.get("/{id}/historial-eventos")
def historial_eventos(
    id: int,
    tipo_evento: Optional[str] = Query(None),
    hilera: Optional[int] = Query(None),
    variedad_id: Optional[int] = Query(None),
    usuario: Optional[str] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Query testblock_eventos for this testblock with optional filters."""
    q = db.query(TestblockEvento).filter(TestblockEvento.id_testblock == id)

    if tipo_evento:
        q = q.filter(TestblockEvento.tipo_evento == tipo_evento)
    if usuario:
        q = q.filter(TestblockEvento.created_by == usuario)
    if fecha_desde:
        q = q.filter(TestblockEvento.created_at >= fecha_desde)
    if fecha_hasta:
        q = q.filter(TestblockEvento.created_at <= fecha_hasta + "T23:59:59")

    # Filter by hilera or variedad requires parsing datos_antes/datos_despues JSON,
    # or joining on posiciones. We use a subquery approach via position IDs.
    if hilera is not None or variedad_id is not None:
        pos_q = db.query(PosicionTestBlock.id_posicion).filter(
            PosicionTestBlock.id_testblock == id,
        )
        if hilera is not None:
            pos_q = pos_q.filter(PosicionTestBlock.hilera == hilera)
        if variedad_id is not None:
            pos_q = pos_q.filter(PosicionTestBlock.id_variedad == variedad_id)
        pos_ids = [r[0] for r in pos_q.all()]
        if pos_ids:
            q = q.filter(TestblockEvento.id_posicion.in_(pos_ids))
        else:
            return []

    eventos = (
        q.order_by(TestblockEvento.created_at.desc())
        .limit(200)
        .all()
    )

    return eventos


# ---------------------------------------------------------------------------
# POST /testblocks/{id}/deshacer  (undo last event)
# ---------------------------------------------------------------------------

@router.post("/{id}/deshacer")
def deshacer_evento(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Undo the last non-reverted event for this testblock."""
    evento = (
        db.query(TestblockEvento)
        .filter(
            TestblockEvento.id_testblock == id,
            TestblockEvento.revertido == False,
        )
        .order_by(TestblockEvento.created_at.desc())
        .first()
    )
    if not evento:
        raise HTTPException(status_code=404, detail="No hay eventos para deshacer")

    # Parse the datos_antes and datos_despues to determine the action
    try:
        datos_antes = json.loads(evento.datos_antes) if evento.datos_antes else {}
        datos_despues = json.loads(evento.datos_despues) if evento.datos_despues else {}
    except (json.JSONDecodeError, TypeError):
        datos_antes = {}
        datos_despues = {}

    posicion_ids = datos_antes.get("posicion_ids", []) or datos_despues.get("posicion_ids", [])
    tipo = evento.tipo_evento

    if tipo == "BAJA_GRUPAL":
        # Reverse: set positions back to "alta"
        for pid in posicion_ids:
            pos = db.get(PosicionTestBlock, pid)
            if pos and pos.estado == "baja":
                pos.estado = "alta"
                pos.fecha_baja = None
                pos.motivo_baja = None
                pos.usuario_baja = None
                pos.fecha_modificacion = utcnow()
                # Reactivate plant if possible
                planta = (
                    db.query(Planta)
                    .filter(Planta.id_posicion == pid, Planta.activa == False)
                    .order_by(Planta.fecha_baja.desc())
                    .first()
                )
                if planta:
                    planta.activa = True
                    planta.fecha_baja = None
                    planta.motivo_baja = None

    elif tipo == "ALTA_GRUPAL":
        # Reverse: set positions back to "vacia", deactivate plants, restore stock
        id_lote = datos_despues.get("id_lote")
        for pid in posicion_ids:
            pos = db.get(PosicionTestBlock, pid)
            if pos and pos.estado == "alta":
                planta = (
                    db.query(Planta)
                    .filter(Planta.id_posicion == pid, Planta.activa == True)
                    .first()
                )
                if planta:
                    planta.activa = False
                    planta.fecha_baja = date.today()
                    planta.motivo_baja = "Deshacer alta grupal"

                pos.estado = "vacia"
                pos.id_variedad = None
                pos.id_portainjerto = None
                pos.id_pmg = None
                pos.id_lote = None
                pos.fecha_alta = None
                pos.fecha_plantacion = None
                pos.usuario_alta = None
                pos.fecha_modificacion = utcnow()

        # Restore stock
        if id_lote:
            lote = db.query(InventarioVivero).filter(InventarioVivero.id_inventario == id_lote).first()
            if lote:
                cantidad = len(posicion_ids)
                saldo_ant = lote.cantidad_actual
                lote.cantidad_actual += cantidad
                if lote.estado == "agotado":
                    lote.estado = "disponible"
                lote.fecha_modificacion = utcnow()
                mov = MovimientoInventario(
                    id_inventario=lote.id_inventario,
                    tipo="DEVOLUCION",
                    cantidad=cantidad,
                    saldo_anterior=saldo_ant,
                    saldo_nuevo=lote.cantidad_actual,
                    motivo="Deshacer alta grupal",
                    referencia_destino=f"deshacer TB-{id}",
                    usuario=user.username,
                )
                db.add(mov)

    elif tipo == "REPLANTE_GRUPAL":
        # Reverse: set positions back to "baja", deactivate new plants, restore stock
        id_lote = datos_despues.get("id_lote")
        for pid in posicion_ids:
            pos = db.get(PosicionTestBlock, pid)
            if pos and pos.estado == "replante":
                planta = (
                    db.query(Planta)
                    .filter(Planta.id_posicion == pid, Planta.activa == True)
                    .first()
                )
                if planta:
                    planta.activa = False
                    planta.fecha_baja = date.today()
                    planta.motivo_baja = "Deshacer replante grupal"

                pos.estado = "baja"
                pos.fecha_modificacion = utcnow()

        # Restore stock
        if id_lote:
            lote = db.query(InventarioVivero).filter(InventarioVivero.id_inventario == id_lote).first()
            if lote:
                cantidad = len(posicion_ids)
                saldo_ant = lote.cantidad_actual
                lote.cantidad_actual += cantidad
                if lote.estado == "agotado":
                    lote.estado = "disponible"
                lote.fecha_modificacion = utcnow()
                mov = MovimientoInventario(
                    id_inventario=lote.id_inventario,
                    tipo="DEVOLUCION",
                    cantidad=cantidad,
                    saldo_anterior=saldo_ant,
                    saldo_nuevo=lote.cantidad_actual,
                    motivo="Deshacer replante grupal",
                    referencia_destino=f"deshacer TB-{id}",
                    usuario=user.username,
                )
                db.add(mov)

    elif tipo == "POLINIZANTE_GRUPAL":
        # Reverse: toggle protegida back
        prev_value = datos_antes.get("protegida", False)
        for pid in posicion_ids:
            pos = db.get(PosicionTestBlock, pid)
            if pos:
                pos.protegida = bool(prev_value)
                pos.fecha_modificacion = utcnow()

    # Note: FENOLOGIA_GRUPAL and LABOR_GRUPAL are not easily reversible
    # (would require deleting RegistroFenologico/EjecucionLabor records).
    # We log the reversal but skip the DB changes for these types.
    elif tipo in ("FENOLOGIA_GRUPAL", "LABOR_GRUPAL"):
        logger.warning(
            "Deshacer %s no revierte registros individuales (solo marca evento como revertido)",
            tipo,
        )

    # Mark event as reverted
    evento.revertido = True
    db.commit()

    return {
        "reverted_event_id": evento.id,
        "tipo_evento": evento.tipo_evento,
        "posiciones_afectadas": posicion_ids,
    }
