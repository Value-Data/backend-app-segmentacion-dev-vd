"""Ordenes de Trabajo routes: CRUD, ejecucion, reprogramacion, kanban, por-persona, masivo."""

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.sistema import Usuario
from app.models.orden_trabajo import OrdenTrabajo
from app.models.laboratorio import EjecucionLabor
from app.models.maestras import TipoLabor
from app.models.testblock import TestBlock, PosicionTestBlock, Planta
from app.models.inventario import InventarioVivero

router = APIRouter(prefix="/ordenes-trabajo", tags=["Ordenes de Trabajo"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class OrdenTrabajoCreate(BaseModel):
    id_tipo_labor: int
    id_testblock: int
    id_lote: Optional[int] = None
    temporada: Optional[str] = None
    fecha_plan_inicio: date
    fecha_plan_fin: date
    id_responsable: Optional[int] = None
    equipo: Optional[str] = None
    prioridad: str = "media"
    observaciones_plan: Optional[str] = None
    posicion_ids: Optional[list[int]] = None


class OrdenTrabajoUpdate(BaseModel):
    fecha_plan_inicio: Optional[date] = None
    fecha_plan_fin: Optional[date] = None
    id_responsable: Optional[int] = None
    equipo: Optional[str] = None
    prioridad: Optional[str] = None
    observaciones_plan: Optional[str] = None


class EjecucionOTBody(BaseModel):
    cumplimiento: str  # segun_plan | parcial | no_realizada
    fecha_ejecucion: date
    ejecutor_real: Optional[str] = None
    duracion_real_min: Optional[int] = None
    posiciones_ejecutadas: Optional[int] = None
    motivo_desviacion: Optional[str] = None
    motivo_desviacion_detalle: Optional[str] = None
    observaciones: Optional[str] = None
    continuar_manana: bool = False


class ReprogramarBody(BaseModel):
    nueva_fecha_inicio: date
    nueva_fecha_fin: date
    motivo: Optional[str] = None


class EjecucionMasivaBody(BaseModel):
    ids: list[int]
    cumplimiento: str
    fecha_ejecucion: date
    ejecutor_real: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _generate_codigo(db: Session, year: int) -> str:
    """Generate auto-incremental OT code like OT-2026-001."""
    prefix = f"OT-{year}-"
    existing = (
        db.query(OrdenTrabajo.codigo)
        .filter(OrdenTrabajo.codigo.like(f"{prefix}%"))
        .all()
    )
    max_seq = 0
    for (codigo,) in existing:
        try:
            seq = int(codigo.replace(prefix, ""))
            if seq > max_seq:
                max_seq = seq
        except ValueError:
            continue
    return f"{prefix}{max_seq + 1:03d}"


def _enrich_ot(ot_dict: dict, db: Session) -> dict:
    """Add tipo_labor_nombre, testblock_nombre, responsable_nombre, lote_codigo."""
    # tipo_labor_nombre
    if ot_dict.get("id_tipo_labor"):
        tl = db.get(TipoLabor, ot_dict["id_tipo_labor"])
        ot_dict["tipo_labor_nombre"] = tl.nombre if tl else None
    else:
        ot_dict["tipo_labor_nombre"] = None

    # testblock_nombre
    if ot_dict.get("id_testblock"):
        tb = db.get(TestBlock, ot_dict["id_testblock"])
        ot_dict["testblock_nombre"] = tb.nombre if tb else None
    else:
        ot_dict["testblock_nombre"] = None

    # responsable_nombre
    if ot_dict.get("id_responsable"):
        usr = db.get(Usuario, ot_dict["id_responsable"])
        ot_dict["responsable_nombre"] = usr.nombre_completo if usr else None
    else:
        ot_dict["responsable_nombre"] = None

    # lote_codigo
    if ot_dict.get("id_lote"):
        lote = db.get(InventarioVivero, ot_dict["id_lote"])
        ot_dict["lote_codigo"] = lote.codigo_lote if lote else None
    else:
        ot_dict["lote_codigo"] = None

    return ot_dict


def _ot_to_dict(ot: OrdenTrabajo) -> dict:
    """Convert an OrdenTrabajo SQLModel instance to a plain dict."""
    return {c.name: getattr(ot, c.name) for c in ot.__table__.columns}


def _iso_week_to_dates(iso_week: str) -> tuple[date, date]:
    """Convert ISO week string like '2026-W16' to (monday, sunday) dates."""
    # Parse year and week
    parts = iso_week.split("-W")
    year = int(parts[0])
    week = int(parts[1])
    # Monday of the given ISO week
    jan4 = date(year, 1, 4)  # Jan 4 is always in ISO week 1
    start_of_week1 = jan4 - timedelta(days=jan4.isoweekday() - 1)
    monday = start_of_week1 + timedelta(weeks=week - 1)
    sunday = monday + timedelta(days=6)
    return monday, sunday


# ---------------------------------------------------------------------------
# 1. POST / — Create work order
# ---------------------------------------------------------------------------

@router.post("/", status_code=201)
def create_orden_trabajo(
    body: OrdenTrabajoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Create a new Orden de Trabajo and its linked EjecucionLabor records."""
    # Validate testblock exists
    tb = db.get(TestBlock, body.id_testblock)
    if not tb:
        raise HTTPException(status_code=404, detail="TestBlock no encontrado")

    # Validate tipo_labor exists
    tl = db.get(TipoLabor, body.id_tipo_labor)
    if not tl:
        raise HTTPException(status_code=404, detail="Tipo de labor no encontrado")

    # Validate responsable if provided
    if body.id_responsable:
        resp = db.get(Usuario, body.id_responsable)
        if not resp:
            raise HTTPException(status_code=404, detail="Responsable (usuario) no encontrado")

    # Validate lote if provided
    if body.id_lote:
        lote = db.get(InventarioVivero, body.id_lote)
        if not lote:
            raise HTTPException(status_code=404, detail="Lote de inventario no encontrado")

    # Generate auto-code
    year = body.fecha_plan_inicio.year
    codigo = _generate_codigo(db, year)

    # Determine positions
    if body.posicion_ids:
        posicion_ids = body.posicion_ids
    else:
        # Get all active positions from the testblock (estado != 'vacia' implies planted)
        positions = (
            db.query(PosicionTestBlock)
            .filter(
                PosicionTestBlock.id_testblock == body.id_testblock,
                PosicionTestBlock.estado != "vacia",
            )
            .all()
        )
        posicion_ids = [p.id_posicion for p in positions]

    # Create the OT
    ot = OrdenTrabajo(
        codigo=codigo,
        id_tipo_labor=body.id_tipo_labor,
        id_testblock=body.id_testblock,
        id_lote=body.id_lote,
        temporada=body.temporada,
        fecha_plan_inicio=body.fecha_plan_inicio,
        fecha_plan_fin=body.fecha_plan_fin,
        id_responsable=body.id_responsable,
        equipo=body.equipo,
        prioridad=body.prioridad,
        estado="planificada",
        posiciones_total=len(posicion_ids),
        observaciones_plan=body.observaciones_plan,
        usuario_creacion=user.username,
        fecha_creacion=datetime.utcnow(),
    )
    db.add(ot)
    db.flush()  # get ot.id

    # Create individual EjecucionLabor records for each position
    for pid in posicion_ids:
        # Look up the plant in this position (if any)
        planta = (
            db.query(Planta)
            .filter(Planta.id_posicion == pid, Planta.activa == True)
            .first()
        )
        ej = EjecucionLabor(
            id_posicion=pid,
            id_planta=planta.id_planta if planta else None,
            id_labor=body.id_tipo_labor,
            temporada=body.temporada,
            fecha_programada=body.fecha_plan_inicio,
            estado="planificada",
            id_orden_trabajo=ot.id,
            id_lote=body.id_lote,
            usuario_registro=user.username,
            fecha_creacion=datetime.utcnow(),
        )
        db.add(ej)

    db.commit()
    db.refresh(ot)

    result = _ot_to_dict(ot)
    return _enrich_ot(result, db)


# ---------------------------------------------------------------------------
# 8. GET /kanban — Kanban view grouped by estado
# ---------------------------------------------------------------------------

@router.get("/kanban")
def kanban_ordenes(
    semana: Optional[str] = Query(None, description="ISO week like 2026-W16"),
    testblock: Optional[int] = None,
    responsable: Optional[int] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Group OTs by estado for Kanban view."""
    q = db.query(OrdenTrabajo)

    if semana:
        monday, sunday = _iso_week_to_dates(semana)
        q = q.filter(
            OrdenTrabajo.fecha_plan_inicio <= sunday,
            OrdenTrabajo.fecha_plan_fin >= monday,
        )
    if testblock:
        q = q.filter(OrdenTrabajo.id_testblock == testblock)
    if responsable:
        q = q.filter(OrdenTrabajo.id_responsable == responsable)

    all_ots = q.order_by(OrdenTrabajo.fecha_plan_inicio).all()

    today = date.today()
    kanban = {
        "planificadas": [],
        "en_progreso": [],
        "completadas": [],
        "parciales": [],
        "atrasadas": [],
        "no_realizadas": [],
    }

    for ot in all_ots:
        d = _ot_to_dict(ot)
        _enrich_ot(d, db)

        estado = ot.estado or "planificada"

        # Detect overdue: planificada and past the planned end date
        if estado == "planificada" and ot.fecha_plan_fin < today:
            kanban["atrasadas"].append(d)
        elif estado == "planificada":
            kanban["planificadas"].append(d)
        elif estado == "en_progreso":
            kanban["en_progreso"].append(d)
        elif estado == "completada":
            kanban["completadas"].append(d)
        elif estado == "parcial":
            kanban["parciales"].append(d)
        elif estado == "no_realizada":
            kanban["no_realizadas"].append(d)
        else:
            # Fallback: put unknown estados in planificadas
            kanban["planificadas"].append(d)

    return kanban


# ---------------------------------------------------------------------------
# 9. GET /por-persona — Group by responsable
# ---------------------------------------------------------------------------

@router.get("/por-persona")
def ordenes_por_persona(
    semana: Optional[str] = Query(None, description="ISO week like 2026-W16"),
    testblock: Optional[int] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Group OTs by responsable."""
    q = db.query(OrdenTrabajo)

    if semana:
        monday, sunday = _iso_week_to_dates(semana)
        q = q.filter(
            OrdenTrabajo.fecha_plan_inicio <= sunday,
            OrdenTrabajo.fecha_plan_fin >= monday,
        )
    if testblock:
        q = q.filter(OrdenTrabajo.id_testblock == testblock)

    all_ots = q.order_by(OrdenTrabajo.fecha_plan_inicio).all()

    # Group by responsable
    personas_map: dict[Optional[int], list[dict]] = {}
    for ot in all_ots:
        d = _ot_to_dict(ot)
        _enrich_ot(d, db)
        key = ot.id_responsable
        if key not in personas_map:
            personas_map[key] = []
        personas_map[key].append(d)

    personas = []
    for id_usuario, ots in personas_map.items():
        if id_usuario is not None:
            usr = db.get(Usuario, id_usuario)
            personas.append({
                "id_usuario": id_usuario,
                "nombre": usr.nombre_completo if usr else f"Usuario #{id_usuario}",
                "ots": ots,
            })
        else:
            personas.append({
                "id_usuario": None,
                "nombre": "Sin asignar",
                "ots": ots,
            })

    # Put "Sin asignar" at the end
    personas.sort(key=lambda p: (p["id_usuario"] is None, p.get("nombre", "")))

    return {"personas": personas}


# ---------------------------------------------------------------------------
# 10. POST /masivo/ejecutar — Bulk execute
# ---------------------------------------------------------------------------

@router.post("/masivo/ejecutar")
def ejecutar_masivo(
    body: EjecucionMasivaBody,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Bulk execute multiple OTs."""
    if body.cumplimiento not in ("segun_plan", "parcial", "no_realizada"):
        raise HTTPException(status_code=400, detail="cumplimiento debe ser: segun_plan, parcial, no_realizada")

    results = []
    for ot_id in body.ids:
        ot = db.get(OrdenTrabajo, ot_id)
        if not ot:
            results.append({"id": ot_id, "ok": False, "error": "OT no encontrada"})
            continue
        if ot.estado not in ("planificada", "en_progreso"):
            results.append({"id": ot_id, "ok": False, "error": f"Estado '{ot.estado}' no permite ejecucion"})
            continue

        now = datetime.utcnow()

        if body.cumplimiento == "segun_plan":
            ot.estado = "completada"
            ot.cumplimiento = "segun_plan"
            ot.posiciones_ejecutadas = ot.posiciones_total
            ot.fecha_cierre = now
            # Mark all linked labores as ejecutada
            labores = db.query(EjecucionLabor).filter(EjecucionLabor.id_orden_trabajo == ot.id).all()
            for lab in labores:
                lab.estado = "ejecutada"
                lab.fecha_ejecucion = body.fecha_ejecucion
                lab.ejecutor = body.ejecutor_real
        elif body.cumplimiento == "no_realizada":
            ot.estado = "no_realizada"
            ot.cumplimiento = "no_realizada"
            ot.fecha_cierre = now

        ot.fecha_ejecucion_real = body.fecha_ejecucion
        ot.ejecutor_real = body.ejecutor_real
        ot.fecha_modificacion = now
        results.append({"id": ot_id, "ok": True, "estado": ot.estado})

    db.commit()
    return {"resultados": results}


# ---------------------------------------------------------------------------
# 11. GET /cumplimiento-tb — TestBlock × TipoLabor completion matrix
# ---------------------------------------------------------------------------

@router.get("/cumplimiento-tb")
def vista_cumplimiento_tb(
    temporada: str = Query("2025-2026"),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Matrix of TestBlock x TipoLabor showing completion percentages."""
    ots = db.query(OrdenTrabajo).filter(OrdenTrabajo.temporada == temporada).all()

    # Group by testblock + tipo_labor
    matrix: dict[int, dict[int, dict]] = {}
    tb_names: dict[int, str] = {}
    labor_names: dict[int, str] = {}

    for ot in ots:
        tb_id = ot.id_testblock or 0
        labor_id = ot.id_tipo_labor or 0

        if tb_id not in matrix:
            matrix[tb_id] = {}
        if labor_id not in matrix[tb_id]:
            matrix[tb_id][labor_id] = {"total": 0, "completadas": 0, "parciales": 0, "no_realizadas": 0}

        matrix[tb_id][labor_id]["total"] += 1
        if ot.estado == "completada":
            matrix[tb_id][labor_id]["completadas"] += 1
        elif ot.estado == "parcial":
            matrix[tb_id][labor_id]["parciales"] += 1
        elif ot.estado == "no_realizada":
            matrix[tb_id][labor_id]["no_realizadas"] += 1

    # Resolve names
    tb_ids = [tid for tid in matrix.keys() if tid]
    labor_ids_set: set[int] = set()
    for labors in matrix.values():
        labor_ids_set.update(labors.keys())
    labor_ids = [lid for lid in labor_ids_set if lid]

    if tb_ids:
        for tb in db.query(TestBlock).filter(TestBlock.id_testblock.in_(tb_ids)).all():
            tb_names[tb.id_testblock] = tb.nombre
    if labor_ids:
        for tl in db.query(TipoLabor).filter(TipoLabor.id_labor.in_(labor_ids)).all():
            labor_names[tl.id_labor] = tl.nombre

    result = []
    for tb_id, labors in matrix.items():
        row = {
            "id_testblock": tb_id,
            "testblock": tb_names.get(tb_id, f"TB-{tb_id}"),
            "labores": {},
        }
        for labor_id, stats in labors.items():
            pct = (
                round((stats["completadas"] + stats["parciales"] * 0.5) / stats["total"] * 100)
                if stats["total"] > 0
                else 0
            )
            row["labores"][labor_names.get(labor_id, f"Labor-{labor_id}")] = {
                **stats,
                "pct": pct,
            }
        result.append(row)

    return {"rows": result, "labor_names": list(labor_names.values())}


# ---------------------------------------------------------------------------
# 12. GET /desviaciones — Plan vs Real analysis
# ---------------------------------------------------------------------------

@router.get("/desviaciones")
def vista_desviaciones(
    temporada: str = Query("2025-2026"),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Plan vs Real analysis — compliance KPIs and deviation reasons."""
    ots = db.query(OrdenTrabajo).filter(
        OrdenTrabajo.temporada == temporada,
        OrdenTrabajo.cumplimiento != None,
    ).all()

    total = len(ots)
    segun_plan = sum(1 for o in ots if o.cumplimiento == "segun_plan")
    parciales = sum(1 for o in ots if o.cumplimiento == "parcial")
    no_realizadas = sum(1 for o in ots if o.cumplimiento == "no_realizada")
    reprogramadas = sum(1 for o in ots if o.cumplimiento == "reprogramada")

    # Motivos breakdown
    motivos: dict[str, int] = {}
    for o in ots:
        if o.motivo_desviacion:
            motivos[o.motivo_desviacion] = motivos.get(o.motivo_desviacion, 0) + 1

    return {
        "total": total,
        "segun_plan": segun_plan,
        "parciales": parciales,
        "no_realizadas": no_realizadas,
        "reprogramadas": reprogramadas,
        "pct_segun_plan": round(segun_plan / total * 100) if total > 0 else 0,
        "pct_parciales": round(parciales / total * 100) if total > 0 else 0,
        "pct_no_realizadas": round(no_realizadas / total * 100) if total > 0 else 0,
        "motivos": [{"motivo": k, "count": v} for k, v in sorted(motivos.items(), key=lambda x: -x[1])],
    }


# ---------------------------------------------------------------------------
# 2. GET / — List with filters
# ---------------------------------------------------------------------------

@router.get("/")
def list_ordenes_trabajo(
    testblock: Optional[int] = None,
    responsable: Optional[int] = None,
    estado: Optional[str] = None,
    prioridad: Optional[str] = None,
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """List work orders with optional filters."""
    q = db.query(OrdenTrabajo)

    if testblock:
        q = q.filter(OrdenTrabajo.id_testblock == testblock)
    if responsable:
        q = q.filter(OrdenTrabajo.id_responsable == responsable)
    if estado:
        q = q.filter(OrdenTrabajo.estado == estado)
    if prioridad:
        q = q.filter(OrdenTrabajo.prioridad == prioridad)
    if desde:
        q = q.filter(OrdenTrabajo.fecha_plan_inicio >= desde)
    if hasta:
        q = q.filter(OrdenTrabajo.fecha_plan_fin <= hasta)

    ots = q.order_by(OrdenTrabajo.fecha_plan_inicio.desc()).all()

    result = []
    for ot in ots:
        d = _ot_to_dict(ot)
        _enrich_ot(d, db)
        result.append(d)

    return result


# ---------------------------------------------------------------------------
# 3. GET /{id} — Get single OT
# ---------------------------------------------------------------------------

@router.get("/{ot_id}")
def get_orden_trabajo(
    ot_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Get a single OT with enriched data."""
    ot = db.get(OrdenTrabajo, ot_id)
    if not ot:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

    d = _ot_to_dict(ot)
    _enrich_ot(d, db)

    # Include linked labores
    labores = (
        db.query(EjecucionLabor)
        .filter(EjecucionLabor.id_orden_trabajo == ot_id)
        .all()
    )
    d["labores"] = [
        {c.name: getattr(lab, c.name) for c in lab.__table__.columns}
        for lab in labores
    ]
    d["labores_count"] = len(labores)
    d["labores_ejecutadas"] = sum(1 for lab in labores if lab.estado == "ejecutada")

    return d


# ---------------------------------------------------------------------------
# 4. PUT /{id} — Update OT (only planificada or en_progreso)
# ---------------------------------------------------------------------------

@router.put("/{ot_id}")
def update_orden_trabajo(
    ot_id: int,
    body: OrdenTrabajoUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Update an OT (only allowed when planificada or en_progreso)."""
    ot = db.get(OrdenTrabajo, ot_id)
    if not ot:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

    if ot.estado not in ("planificada", "en_progreso"):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede editar una OT con estado '{ot.estado}'. Solo planificada o en_progreso."
        )

    if body.fecha_plan_inicio is not None:
        ot.fecha_plan_inicio = body.fecha_plan_inicio
    if body.fecha_plan_fin is not None:
        ot.fecha_plan_fin = body.fecha_plan_fin
    if body.id_responsable is not None:
        ot.id_responsable = body.id_responsable
    if body.equipo is not None:
        ot.equipo = body.equipo
    if body.prioridad is not None:
        ot.prioridad = body.prioridad
    if body.observaciones_plan is not None:
        ot.observaciones_plan = body.observaciones_plan

    ot.fecha_modificacion = datetime.utcnow()
    db.commit()
    db.refresh(ot)

    d = _ot_to_dict(ot)
    return _enrich_ot(d, db)


# ---------------------------------------------------------------------------
# 5. POST /{id}/ejecutar — Register execution with compliance
# ---------------------------------------------------------------------------

@router.post("/{ot_id}/ejecutar")
def ejecutar_orden_trabajo(
    ot_id: int,
    body: EjecucionOTBody,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Register execution of an OT with compliance tracking."""
    ot = db.get(OrdenTrabajo, ot_id)
    if not ot:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

    if ot.estado not in ("planificada", "en_progreso"):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede ejecutar una OT con estado '{ot.estado}'."
        )

    if body.cumplimiento not in ("segun_plan", "parcial", "no_realizada"):
        raise HTTPException(status_code=400, detail="cumplimiento debe ser: segun_plan, parcial, no_realizada")

    now = datetime.utcnow()
    labores = db.query(EjecucionLabor).filter(EjecucionLabor.id_orden_trabajo == ot_id).all()

    if body.cumplimiento == "segun_plan":
        # Mark all labores as ejecutada
        for lab in labores:
            lab.estado = "ejecutada"
            lab.fecha_ejecucion = body.fecha_ejecucion
            lab.ejecutor = body.ejecutor_real
            lab.duracion_min = body.duracion_real_min
        ot.estado = "completada"
        ot.cumplimiento = "segun_plan"
        ot.posiciones_ejecutadas = ot.posiciones_total
        ot.fecha_cierre = now

    elif body.cumplimiento == "parcial":
        executed_count = body.posiciones_ejecutadas or 0
        # Mark only the first N planificada labores as ejecutada
        pending = [lab for lab in labores if lab.estado == "planificada"]
        for i, lab in enumerate(pending):
            if i < executed_count:
                lab.estado = "ejecutada"
                lab.fecha_ejecucion = body.fecha_ejecucion
                lab.ejecutor = body.ejecutor_real
                lab.duracion_min = body.duracion_real_min

        ot.estado = "parcial"
        ot.cumplimiento = "parcial"
        ot.posiciones_ejecutadas = executed_count

        # If continuar_manana, create a continuation OT for remaining positions
        if body.continuar_manana:
            remaining_labores = [lab for lab in pending if lab.estado == "planificada"]
            remaining_ids = [lab.id_posicion for lab in remaining_labores]
            if remaining_ids:
                next_day = body.fecha_ejecucion + timedelta(days=1)
                new_codigo = _generate_codigo(db, next_day.year)
                continuation_ot = OrdenTrabajo(
                    codigo=new_codigo,
                    id_tipo_labor=ot.id_tipo_labor,
                    id_testblock=ot.id_testblock,
                    id_lote=ot.id_lote,
                    temporada=ot.temporada,
                    fecha_plan_inicio=next_day,
                    fecha_plan_fin=next_day + (ot.fecha_plan_fin - ot.fecha_plan_inicio),
                    id_responsable=ot.id_responsable,
                    equipo=ot.equipo,
                    prioridad=ot.prioridad,
                    estado="planificada",
                    posiciones_total=len(remaining_ids),
                    observaciones_plan=f"Continuacion de {ot.codigo}. {body.observaciones or ''}".strip(),
                    usuario_creacion=user.username,
                    fecha_creacion=now,
                )
                db.add(continuation_ot)
                db.flush()

                # Re-link remaining labores to the new OT
                for lab in remaining_labores:
                    lab.id_orden_trabajo = continuation_ot.id
                    lab.fecha_programada = next_day

    elif body.cumplimiento == "no_realizada":
        ot.estado = "no_realizada"
        ot.cumplimiento = "no_realizada"
        ot.fecha_cierre = now

    # Update common execution fields
    ot.fecha_ejecucion_real = body.fecha_ejecucion
    ot.ejecutor_real = body.ejecutor_real
    ot.duracion_real_min = body.duracion_real_min
    ot.motivo_desviacion = body.motivo_desviacion
    ot.motivo_desviacion_detalle = body.motivo_desviacion_detalle
    ot.observaciones_ejecucion = body.observaciones
    ot.fecha_modificacion = now

    db.commit()
    db.refresh(ot)

    d = _ot_to_dict(ot)
    _enrich_ot(d, db)

    # If continuation was created, include its info
    if body.cumplimiento == "parcial" and body.continuar_manana:
        cont = (
            db.query(OrdenTrabajo)
            .filter(OrdenTrabajo.observaciones_plan.like(f"Continuacion de {ot.codigo}%"))
            .order_by(OrdenTrabajo.id.desc())
            .first()
        )
        if cont:
            d["continuacion"] = _enrich_ot(_ot_to_dict(cont), db)

    return d


# ---------------------------------------------------------------------------
# 6. POST /{id}/reprogramar — Reschedule
# ---------------------------------------------------------------------------

@router.post("/{ot_id}/reprogramar")
def reprogramar_orden_trabajo(
    ot_id: int,
    body: ReprogramarBody,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Reschedule an OT to new dates."""
    ot = db.get(OrdenTrabajo, ot_id)
    if not ot:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

    if ot.estado not in ("planificada", "en_progreso", "parcial"):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede reprogramar una OT con estado '{ot.estado}'."
        )

    ot.fecha_plan_inicio = body.nueva_fecha_inicio
    ot.fecha_plan_fin = body.nueva_fecha_fin
    ot.estado = "planificada"
    ot.cumplimiento = "reprogramada"
    ot.motivo_desviacion = body.motivo
    ot.fecha_modificacion = datetime.utcnow()

    # Also update linked labores' fecha_programada
    labores = (
        db.query(EjecucionLabor)
        .filter(
            EjecucionLabor.id_orden_trabajo == ot_id,
            EjecucionLabor.estado == "planificada",
        )
        .all()
    )
    for lab in labores:
        lab.fecha_programada = body.nueva_fecha_inicio

    db.commit()
    db.refresh(ot)

    d = _ot_to_dict(ot)
    return _enrich_ot(d, db)


# ---------------------------------------------------------------------------
# 7. DELETE /{id} — Delete OT (only if planificada, no executed labores)
# ---------------------------------------------------------------------------

@router.delete("/{ot_id}", status_code=200)
def delete_orden_trabajo(
    ot_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Delete an OT (only if planificada and no linked executed labores)."""
    ot = db.get(OrdenTrabajo, ot_id)
    if not ot:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

    if ot.estado != "planificada":
        raise HTTPException(
            status_code=400,
            detail=f"Solo se puede eliminar una OT planificada. Estado actual: '{ot.estado}'."
        )

    # Check for executed labores
    executed_count = (
        db.query(EjecucionLabor)
        .filter(
            EjecucionLabor.id_orden_trabajo == ot_id,
            EjecucionLabor.estado == "ejecutada",
        )
        .count()
    )
    if executed_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar: hay {executed_count} labores ya ejecutadas vinculadas."
        )

    # Delete linked planificada labores
    db.query(EjecucionLabor).filter(
        EjecucionLabor.id_orden_trabajo == ot_id,
        EjecucionLabor.estado == "planificada",
    ).delete(synchronize_session="fetch")

    db.delete(ot)
    db.commit()

    return {"detail": f"Orden de trabajo {ot.codigo} eliminada exitosamente"}
