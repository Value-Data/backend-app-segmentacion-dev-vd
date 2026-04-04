"""Labores routes: planificacion, ejecucion, ordenes de trabajo, dashboard, evidencias, QR."""

import json
from datetime import date, timedelta
from io import BytesIO

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.sistema import Usuario
from app.models.laboratorio import EjecucionLabor
from app.models.maestras import TipoLabor
from app.models.testblock import PosicionTestBlock
from app.models.evidencia import EvidenciaLabor
from app.schemas.laboratorio import LaborPlanificacion, LaborPlanificacionTestblock, LaborEjecucion
from app.services import crud

router = APIRouter(prefix="/labores", tags=["Labores"])


# ---------------------------------------------------------------------------
# Dashboard KPIs
# ---------------------------------------------------------------------------

@router.get("/dashboard")
def labores_dashboard(
    testblock: int | None = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Dashboard KPIs and stats for labores."""
    q = db.query(EjecucionLabor)
    if testblock:
        pos_ids = [
            p.id_posicion
            for p in db.query(PosicionTestBlock.id_posicion).filter(
                PosicionTestBlock.id_testblock == testblock
            ).all()
        ]
        q = q.filter(EjecucionLabor.id_posicion.in_(pos_ids))

    all_labores = q.all()
    today = date.today()

    planificadas = [l for l in all_labores if l.estado == "planificada"]
    ejecutadas = [l for l in all_labores if l.estado == "ejecutada"]

    # Delayed: planificada and fecha_programada < today
    atrasadas = [
        l for l in planificadas
        if l.fecha_programada and l.fecha_programada < today
    ]

    # This week
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    esta_semana = [
        l for l in planificadas
        if l.fecha_programada and week_start <= l.fecha_programada <= week_end
    ]

    # Pre-load all labor types (avoid N+1)
    labor_names: dict[int, str] = {}
    for t in db.query(TipoLabor).all():
        labor_names[t.id_labor] = t.nombre

    # Group by tipo_labor
    por_tipo: dict[str, dict[str, int]] = {}
    for l in all_labores:
        nombre = labor_names.get(l.id_labor, f"Labor #{l.id_labor}")
        if nombre not in por_tipo:
            por_tipo[nombre] = {"planificadas": 0, "ejecutadas": 0, "atrasadas": 0}
        if l.estado == "planificada":
            por_tipo[nombre]["planificadas"] += 1
            if l.fecha_programada and l.fecha_programada < today:
                por_tipo[nombre]["atrasadas"] += 1
        elif l.estado == "ejecutada":
            por_tipo[nombre]["ejecutadas"] += 1

    # Group by month
    por_mes: dict[str, dict[str, int]] = {}
    for l in all_labores:
        if l.fecha_programada:
            mes = l.fecha_programada.strftime("%Y-%m")
            if mes not in por_mes:
                por_mes[mes] = {"planificadas": 0, "ejecutadas": 0}
            if l.estado == "planificada":
                por_mes[mes]["planificadas"] += 1
            else:
                por_mes[mes]["ejecutadas"] += 1

    return {
        "total": len(all_labores),
        "planificadas": len(planificadas),
        "ejecutadas": len(ejecutadas),
        "atrasadas": len(atrasadas),
        "esta_semana": len(esta_semana),
        "por_tipo": por_tipo,
        "por_mes": dict(sorted(por_mes.items())),
        "pct_cumplimiento": round(len(ejecutadas) / max(len(all_labores), 1) * 100, 1),
    }


# ---------------------------------------------------------------------------
# Planificacion
# ---------------------------------------------------------------------------

@router.get("/planificacion")
def list_planificacion(
    testblock: int | None = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    q = db.query(EjecucionLabor)
    if testblock:
        pos_ids = [p.id_posicion for p in db.query(PosicionTestBlock.id_posicion).filter(
            PosicionTestBlock.id_testblock == testblock
        ).all()]
        q = q.filter(EjecucionLabor.id_posicion.in_(pos_ids))
    return q.order_by(EjecucionLabor.fecha_programada).all()


@router.post("/planificacion", status_code=201)
def create_planificacion(
    data: LaborPlanificacion,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo", "operador")),
):
    labor = EjecucionLabor(
        id_posicion=data.id_posicion,
        id_planta=data.id_planta,
        id_labor=data.id_labor,
        temporada=data.temporada,
        fecha_programada=data.fecha_programada,
        fecha_ejecucion=data.fecha_programada,
        estado="planificada",
        observaciones=data.observaciones,
        usuario_registro=user.username,
    )
    db.add(labor)
    db.commit()
    db.refresh(labor)
    return labor


@router.post("/planificacion-testblock", status_code=201)
def create_planificacion_testblock(
    data: LaborPlanificacionTestblock,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo", "operador")),
):
    """Plan a labor for all active positions in a testblock."""
    posiciones = (
        db.query(PosicionTestBlock)
        .filter(
            PosicionTestBlock.id_testblock == data.id_testblock,
            PosicionTestBlock.estado == "alta",
        )
        .all()
    )
    if not posiciones:
        raise HTTPException(status_code=400, detail="No hay posiciones activas en este testblock")

    created = 0
    for pos in posiciones:
        labor = EjecucionLabor(
            id_posicion=pos.id_posicion,
            id_labor=data.id_labor,
            temporada=data.temporada,
            fecha_programada=data.fecha_programada,
            fecha_ejecucion=data.fecha_programada,
            estado="planificada",
            observaciones=data.observaciones,
            usuario_registro=user.username,
        )
        db.add(labor)
        created += 1

    db.commit()
    return {"created": created, "testblock": data.id_testblock}


# ---------------------------------------------------------------------------
# Labores de hoy / atrasadas
# ---------------------------------------------------------------------------

@router.get("/hoy")
def labores_hoy(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Return labores due today or overdue (fecha_programada <= today, estado planificada), grouped by testblock."""
    today = date.today()
    rows = (
        db.query(EjecucionLabor)
        .filter(
            EjecucionLabor.fecha_programada <= today,
            EjecucionLabor.estado.in_(["planificada"]),
        )
        .order_by(EjecucionLabor.fecha_programada)
        .all()
    )

    # Build a position → testblock lookup for all positions referenced
    pos_ids = list({r.id_posicion for r in rows if r.id_posicion is not None})
    pos_tb_map: dict[int, int | None] = {}
    if pos_ids:
        for p in (
            db.query(PosicionTestBlock.id_posicion, PosicionTestBlock.id_testblock)
            .filter(PosicionTestBlock.id_posicion.in_(pos_ids))
            .all()
        ):
            pos_tb_map[p.id_posicion] = p.id_testblock

    # Group labores by testblock id
    grouped: dict[int | None, list] = {}
    for r in rows:
        tb_id = pos_tb_map.get(r.id_posicion)
        grouped.setdefault(tb_id, []).append(r)

    return {
        "total": len(rows),
        "por_testblock": {
            str(tb_id): items for tb_id, items in grouped.items()
        },
    }


# ---------------------------------------------------------------------------
# Ejecucion masiva
# ---------------------------------------------------------------------------

@router.post("/ejecutar-masivo")
def ejecutar_masivo(
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo", "operador")),
):
    """Mark multiple labores as executed in one call."""
    from datetime import datetime

    ids = data.get("ids", [])
    fecha = data.get("fecha_ejecucion", datetime.utcnow().date().isoformat())
    ejecutor = data.get("ejecutor", user.username)
    updated = 0
    for lid in ids:
        labor = db.get(EjecucionLabor, lid)
        if labor and labor.estado in ("planificada",):
            labor.estado = "ejecutada"
            labor.fecha_ejecucion = fecha
            labor.ejecutor = ejecutor
            db.add(labor)
            updated += 1
    db.commit()
    return {"updated": updated}


# ---------------------------------------------------------------------------
# Ejecucion
# ---------------------------------------------------------------------------

@router.put("/ejecucion/{id}")
def ejecutar_labor(
    id: int,
    data: LaborEjecucion,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo", "operador")),
):
    labor = crud.get_by_id(db, EjecucionLabor, id)
    labor.fecha_ejecucion = data.fecha_ejecucion
    labor.ejecutor = data.ejecutor
    labor.duracion_min = data.duracion_min
    labor.estado = "ejecutada"
    if data.observaciones:
        labor.observaciones = data.observaciones
    labor.usuario_registro = user.username
    db.commit()
    db.refresh(labor)
    return labor


# ---------------------------------------------------------------------------
# Ordenes de trabajo
# ---------------------------------------------------------------------------

@router.get("/ordenes-trabajo")
def ordenes_trabajo(
    testblock: int | None = Query(None),
    fecha: date | None = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    q = db.query(EjecucionLabor).filter(EjecucionLabor.estado == "planificada")
    if testblock:
        pos_ids = [p.id_posicion for p in db.query(PosicionTestBlock.id_posicion).filter(
            PosicionTestBlock.id_testblock == testblock
        ).all()]
        q = q.filter(EjecucionLabor.id_posicion.in_(pos_ids))
    if fecha:
        q = q.filter(EjecucionLabor.fecha_programada == fecha)
    return q.order_by(EjecucionLabor.fecha_programada).all()


# ---------------------------------------------------------------------------
# Evidencias
# ---------------------------------------------------------------------------

@router.get("/ejecucion/{id}/evidencias")
def get_evidencias(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """List all evidence items for a labor execution."""
    return (
        db.query(EvidenciaLabor)
        .filter(EvidenciaLabor.id_ejecucion == id)
        .order_by(EvidenciaLabor.fecha_creacion.desc())
        .all()
    )


@router.post("/ejecucion/{id}/evidencias", status_code=201)
def add_evidencia(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo", "operador")),
):
    """Add photo/note evidence to a labor execution."""
    # Verify the execution exists
    crud.get_by_id(db, EjecucionLabor, id)
    ev = EvidenciaLabor(
        id_ejecucion=id,
        tipo=data.get("tipo", "foto"),
        descripcion=data.get("descripcion"),
        imagen_base64=data.get("imagen_base64"),
        url=data.get("url"),
        lat=data.get("lat"),
        lng=data.get("lng"),
        usuario=user.username,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


# ---------------------------------------------------------------------------
# QR Code generation
# ---------------------------------------------------------------------------

@router.get("/ejecucion/{id}/qr")
def get_labor_qr(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Generate a QR code PNG for a specific labor execution."""
    labor = crud.get_by_id(db, EjecucionLabor, id)
    tipo = db.query(TipoLabor).filter(TipoLabor.id_labor == labor.id_labor).first()

    qr_data = json.dumps({
        "type": "labor",
        "id": labor.id_ejecucion,
        "labor": tipo.nombre if tipo else str(labor.id_labor),
        "pos": labor.id_posicion,
        "fecha": str(labor.fecha_programada),
        "estado": labor.estado,
    })

    img = qrcode.make(qr_data)
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")
