"""Generic CRUD routes for all master/mantenedor entities.

Uses a registry to map entity name → (Model, CreateSchema, UpdateSchema).
A single set of endpoints handles 15+ entity types with minimal code.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlmodel import select

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.sistema import Usuario
from app.services import crud

# Models
from app.models.maestras import (
    Pais, Region, Comuna, Campo, Cuartel, Especie, Portainjerto, Pmg, Origen, Vivero,
    Color, Susceptibilidad, TipoLabor, EstadoPlanta, Temporada, Bodega,
    Catalogo, CentroCosto, MarcoPlantacion, EstadoFenologico, PmgEspecie,
    PortainjertoEspecie,
)
from app.models.variedades import Variedad, VariedadSusceptibilidad
from app.models.bitacora import BitacoraVariedad

# Schemas
from app.schemas.maestras import (
    PaisCreate, PaisUpdate,
    RegionCreate, RegionUpdate,
    ComunaCreate, ComunaUpdate,
    CampoCreate, CampoUpdate,
    CuartelCreate, CuartelUpdate,
    EspecieCreate, EspecieUpdate,
    PortainjertoCr, PortainjertoUp,
    PmgCreate, PmgUpdate,
    OrigenCreate, OrigenUpdate,
    ViveroCreate, ViveroUpdate,
    ColorCreate, ColorUpdate,
    SusceptibilidadCreate, SusceptibilidadUpdate,
    EstadoFenologicoCreate, EstadoFenologicoUpdate,
    TipoLaborCreate, TipoLaborUpdate,
    EstadoPlantaCreate, EstadoPlantaUpdate,
    TemporadaCreate, TemporadaUpdate,
    BodegaCreate, BodegaUpdate,
    CatalogoCreate, CatalogoUpdate,
    CentroCostoCreate, CentroCostoUpdate,
    MarcoPlantacionCreate, MarcoPlantacionUpdate,
)
from app.schemas.variedades import (
    VariedadCreate, VariedadUpdate, VarSusceptCreate, VarSusceptUpdate,
    BitacoraVariedadCreate, BitacoraVariedadUpdate,
)

router = APIRouter(prefix="/mantenedores", tags=["Mantenedores"])

# Registry: entity_name → (Model, CreateSchema, UpdateSchema)
ENTITY_REGISTRY = {
    "paises": (Pais, PaisCreate, PaisUpdate),
    "regiones": (Region, RegionCreate, RegionUpdate),
    "comunas": (Comuna, ComunaCreate, ComunaUpdate),
    "campos": (Campo, CampoCreate, CampoUpdate),
    "cuarteles": (Cuartel, CuartelCreate, CuartelUpdate),
    "especies": (Especie, EspecieCreate, EspecieUpdate),
    "portainjertos": (Portainjerto, PortainjertoCr, PortainjertoUp),
    "pmg": (Pmg, PmgCreate, PmgUpdate),
    "origenes": (Origen, OrigenCreate, OrigenUpdate),
    "viveros": (Vivero, ViveroCreate, ViveroUpdate),
    "colores": (Color, ColorCreate, ColorUpdate),
    "susceptibilidades": (Susceptibilidad, SusceptibilidadCreate, SusceptibilidadUpdate),
    "estados-fenologicos": (EstadoFenologico, EstadoFenologicoCreate, EstadoFenologicoUpdate),
    "estados_fenologicos": (EstadoFenologico, EstadoFenologicoCreate, EstadoFenologicoUpdate),
    "tipos-labor": (TipoLabor, TipoLaborCreate, TipoLaborUpdate),
    "tipos_labor": (TipoLabor, TipoLaborCreate, TipoLaborUpdate),
    "estados-planta": (EstadoPlanta, EstadoPlantaCreate, EstadoPlantaUpdate),
    "estados_planta": (EstadoPlanta, EstadoPlantaCreate, EstadoPlantaUpdate),
    "temporadas": (Temporada, TemporadaCreate, TemporadaUpdate),
    "bodegas": (Bodega, BodegaCreate, BodegaUpdate),
    "catalogos": (Catalogo, CatalogoCreate, CatalogoUpdate),
    "centros-costo": (CentroCosto, CentroCostoCreate, CentroCostoUpdate),
    "centros_costo": (CentroCosto, CentroCostoCreate, CentroCostoUpdate),
    "marcos-plantacion": (MarcoPlantacion, MarcoPlantacionCreate, MarcoPlantacionUpdate),
    "marcos_plantacion": (MarcoPlantacion, MarcoPlantacionCreate, MarcoPlantacionUpdate),
    "variedades": (Variedad, VariedadCreate, VariedadUpdate),
}


def _resolve(entidad: str):
    entry = ENTITY_REGISTRY.get(entidad)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Entidad '{entidad}' no existe")
    return entry


# ── AUTO-CODE GENERATION ──────────────────────────────────────────────────
_CODE_PREFIXES = {
    "campos": "CAM",
    "viveros": "VIV",
    "pmg": "PMG",
    "portainjertos": "PI",
    "origenes": "ORI",
    "especies": "ESP",
    "bodegas": "BOD",
    "temporadas": "TMP",
}


@router.get("/{entidad}/next-code")
def next_code(
    entidad: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    prefix = _CODE_PREFIXES.get(entidad)
    if not prefix:
        raise HTTPException(status_code=400, detail=f"Auto-codigo no soportado para '{entidad}'")
    model, _, _ = _resolve(entidad)
    from sqlalchemy import text
    result = db.execute(text(
        f"SELECT MAX(CAST(SUBSTRING(codigo, {len(prefix) + 2}, LEN(codigo) - {len(prefix)}) AS INT)) "
        f"FROM [{model.__tablename__}] WHERE codigo LIKE '{prefix}-%'"
    )).scalar()
    seq = (result or 0) + 1
    return {"codigo": f"{prefix}-{seq:04d}"}


# ── VARIEDADES BY PMG ──────────────────────────────────────────────────────
@router.get("/variedades/by-pmg/{pmg_id}")
def variedades_by_pmg(
    pmg_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    rows = db.exec(
        select(Variedad).where(Variedad.id_pmg == pmg_id, Variedad.activo == True)
    ).all()
    return rows


# ── LIST ────────────────────────────────────────────────────────────────────
@router.get("/{entidad}")
def list_entities(
    entidad: str,
    especie: int | None = Query(None, description="Filtrar por id_especie"),
    tipo: str | None = Query(None, description="Filtrar por tipo (colores, catalogos)"),
    region: int | None = Query(None, description="Filtrar por id_region (comunas)"),
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    model, _, _ = _resolve(entidad)
    filters = {}
    if especie is not None and hasattr(model, "id_especie"):
        filters["id_especie"] = especie
    if tipo is not None and hasattr(model, "tipo"):
        filters["tipo"] = tipo
    if region is not None and hasattr(model, "id_region"):
        filters["id_region"] = region
    return crud.list_all(db, model, filters=filters, skip=skip, limit=limit)


# ── GET BY ID ───────────────────────────────────────────────────────────────
@router.get("/{entidad}/{id}")
def get_entity(
    entidad: str,
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    model, _, _ = _resolve(entidad)
    return crud.get_by_id(db, model, id)


# ── CREATE ──────────────────────────────────────────────────────────────────
@router.post("/{entidad}", status_code=201)
def create_entity(
    entidad: str,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    model, create_schema, _ = _resolve(entidad)
    from pydantic import ValidationError as PydanticValidationError
    try:
        validated = create_schema(**data)
    except PydanticValidationError:
        coerced = {}
        for k, v in data.items():
            if isinstance(v, (int, float)) and v is not True and v is not False:
                coerced[k] = str(v)
            else:
                coerced[k] = v
        validated = create_schema(**coerced)
    return crud.create(db, model, validated, usuario=user.username)


# ── UPDATE ──────────────────────────────────────────────────────────────────
@router.put("/{entidad}/{id}")
def update_entity(
    entidad: str,
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    model, _, update_schema = _resolve(entidad)
    # Coerce numeric values to string where the schema expects str
    # (prevents ValidationError when frontend sends numbers for string fields)
    from pydantic import ValidationError as PydanticValidationError
    try:
        validated = update_schema(**data)
    except PydanticValidationError:
        # Retry with all values coerced to string where needed
        coerced = {}
        for k, v in data.items():
            if isinstance(v, (int, float)) and v is not True and v is not False:
                coerced[k] = str(v)
            else:
                coerced[k] = v
        validated = update_schema(**coerced)
    # Capture old values for variedades_log before updating
    old_values = {}
    if entidad == "variedades":
        obj_before = db.get(model, id)
        if obj_before:
            new_vals = validated.model_dump(exclude_unset=True)
            for key, new_val in new_vals.items():
                if hasattr(obj_before, key):
                    old_val = getattr(obj_before, key)
                    if old_val != new_val:
                        old_values[key] = (str(old_val) if old_val is not None else None,
                                           str(new_val) if new_val is not None else None)

    result = crud.update(db, model, id, validated, usuario=user.username)

    # Log changes to variedades_log for traceability
    if entidad == "variedades" and old_values:
        from app.models.variedades import VariedadLog
        from app.core.utils import utcnow
        for campo, (val_ant, val_new) in old_values.items():
            log_entry = VariedadLog(
                id_variedad=id,
                accion="UPDATE",
                campo_modificado=campo,
                valor_anterior=val_ant,
                valor_nuevo=val_new,
                usuario=user.username,
                fecha=utcnow(),
            )
            db.add(log_entry)
        try:
            db.commit()
        except Exception:
            db.rollback()

    return result


# ── DELETE (soft) ───────────────────────────────────────────────────────────
@router.delete("/{entidad}/{id}")
def delete_entity(
    entidad: str,
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    model, _, _ = _resolve(entidad)
    return crud.soft_delete(db, model, id, usuario=user.username)


# ── MERGE: fusionar registros duplicados ────────────────────────────────────

# FK map: entity → list of (Model, fk_field) that reference this entity
from app.models.inventario import InventarioVivero
from app.models.testblock import TestBlock, TestBlockHilera, PosicionTestBlock, Planta
from app.models.laboratorio import MedicionLaboratorio, UmbralCalidad
from app.models.variedades_extra import BitacoraPortainjerto

_MERGE_FK_MAP = {
    "viveros": [
        (InventarioVivero, "id_vivero"),
    ],
    "campos": [
        (Cuartel, "id_campo"),
        (TestBlock, "id_campo"),
    ],
    "pmg": [
        (Variedad, "id_pmg"),
        (InventarioVivero, "id_pmg"),
        (PmgEspecie, "id_pmg"),
        (Planta, "id_pmg"),
    ],
    "portainjertos": [
        (InventarioVivero, "id_portainjerto"),
        (TestBlockHilera, "portainjerto_default_id"),
        (PosicionTestBlock, "id_portainjerto"),
        (Planta, "id_portainjerto"),
        (MedicionLaboratorio, "id_portainjerto"),
        (PortainjertoEspecie, "id_portainjerto"),
        (BitacoraPortainjerto, "id_portainjerto"),
    ],
    "origenes": [
        (Variedad, "id_origen"),
    ],
    "especies": [
        (Variedad, "id_especie"),
        (InventarioVivero, "id_especie"),
        (MedicionLaboratorio, "id_especie"),
        (PmgEspecie, "id_especie"),
        (PortainjertoEspecie, "id_especie"),
        (EstadoFenologico, "id_especie"),
        (UmbralCalidad, "id_especie"),
    ],
}

_MERGE_MODELS = {
    "viveros": (Vivero, "id_vivero"),
    "campos": (Campo, "id_campo"),
    "pmg": (Pmg, "id_pmg"),
    "portainjertos": (Portainjerto, "id_portainjerto"),
    "origenes": (Origen, "id_origen"),
    "especies": (Especie, "id_especie"),
}


@router.post("/{entidad}/merge")
def merge_entities(
    entidad: str,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Merge source entity into target: move all FK references, then deactivate source.

    Body: { "source_id": int, "target_id": int }
    """
    if entidad not in _MERGE_MODELS:
        raise HTTPException(status_code=400, detail=f"Merge no soportado para '{entidad}'")

    source_id = data.get("source_id")
    target_id = data.get("target_id")
    if not source_id or not target_id:
        raise HTTPException(status_code=422, detail="source_id y target_id son requeridos")
    if source_id == target_id:
        raise HTTPException(status_code=400, detail="source_id y target_id deben ser diferentes")

    model, pk_field = _MERGE_MODELS[entidad]

    # Verify both exist
    source = db.get(model, source_id)
    target = db.get(model, target_id)
    if not source:
        raise HTTPException(status_code=404, detail=f"Registro origen {source_id} no encontrado")
    if not target:
        raise HTTPException(status_code=404, detail=f"Registro destino {target_id} no encontrado")

    # Move all FK references from source to target
    fk_refs = _MERGE_FK_MAP.get(entidad, [])
    moved = 0
    for ref_model, fk_field_name in fk_refs:
        rows = db.query(ref_model).filter(getattr(ref_model, fk_field_name) == source_id).all()
        for row in rows:
            setattr(row, fk_field_name, target_id)
            moved += 1

    # Soft-delete source
    if hasattr(source, "activo"):
        source.activo = False

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al fusionar: {str(e)[:200]}")

    source_name = getattr(source, "nombre", str(source_id))
    target_name = getattr(target, "nombre", str(target_id))
    return {
        "ok": True,
        "message": f"'{source_name}' fusionado en '{target_name}'",
        "moved_references": moved,
        "source_deactivated": True,
    }


# ── SPECIAL: variedades susceptibilidades ───────────────────────────────────
@router.get("/variedades/{id}/susceptibilidades")
def get_variedad_susceptibilidades(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Get susceptibilidades assigned to a variedad, enriched with name/grupo."""
    rows = db.query(VariedadSusceptibilidad).filter(
        VariedadSusceptibilidad.id_variedad == id
    ).all()
    suscept_ids = [r.id_suscept for r in rows]
    suscept_map = {}
    if suscept_ids:
        for s in db.query(Susceptibilidad).filter(Susceptibilidad.id_suscept.in_(suscept_ids)).all():
            suscept_map[s.id_suscept] = {"nombre": s.nombre, "nombre_en": s.nombre_en, "grupo": s.grupo, "codigo": s.codigo}
    result = []
    for r in rows:
        d = {c: getattr(r, c) for c in r.__class__.model_fields}
        d.update(suscept_map.get(r.id_suscept, {}))
        result.append(d)
    return result


@router.post("/variedades/{id}/susceptibilidades", status_code=201)
def add_variedad_susceptibilidad(
    id: int,
    data: VarSusceptCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Asignar susceptibilidad a variedad.

    SUS-4: si la susceptibilidad tiene id_especie distinta a la de la
    variedad, rechaza con 422. Cuando la susceptibilidad todavía no tiene
    id_especie (legacy), se permite sin bloqueo.
    """
    var = db.get(Variedad, id)
    if not var:
        raise HTTPException(status_code=404, detail="Variedad no encontrada")
    sus = db.get(Susceptibilidad, data.id_suscept)
    if not sus:
        raise HTTPException(status_code=404, detail="Susceptibilidad no encontrada")
    # SUS-4: cross-species guard
    if sus.id_especie is not None and var.id_especie is not None \
            and sus.id_especie != var.id_especie:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Susceptibilidad '{sus.codigo}' (especie {sus.id_especie}) "
                f"no aplica a variedad de especie {var.id_especie}"
            ),
        )

    existing = db.query(VariedadSusceptibilidad).filter(
        VariedadSusceptibilidad.id_variedad == id,
        VariedadSusceptibilidad.id_suscept == data.id_suscept,
    ).first()
    if existing:
        return existing

    # SUS-5: id_variedad viene del path, body sólo tiene id_suscept/nivel/notas
    vs = VariedadSusceptibilidad(id_variedad=id, **data.model_dump())
    db.add(vs)
    db.commit()
    db.refresh(vs)
    return vs


@router.delete("/variedades/{id}/susceptibilidades/{id_vs}")
def delete_variedad_susceptibilidad(
    id: int,
    id_vs: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    vs = db.get(VariedadSusceptibilidad, id_vs)
    if not vs or vs.id_variedad != id:
        raise HTTPException(status_code=404, detail="No encontrado")
    id_suscept = vs.id_suscept
    db.delete(vs)
    db.commit()

    # SUS-6: audit log (el CRUD genérico lo hacía; este endpoint específico no)
    try:
        import json as _json
        from app.services.audit_service import log_audit
        log_audit(
            db,
            tabla="variedad_susceptibilidades",
            registro_id=id_vs,
            accion="DELETE",
            datos_anteriores=_json.dumps(
                {"id_variedad": id, "id_suscept": id_suscept}, ensure_ascii=False,
            ),
            usuario=user.username,
        )
        db.commit()
    except Exception:
        pass

    return {"detail": "Eliminado"}


# ── SPECIAL: vivero-pmg (N:M) ────────────────────────────────────────────
from app.models.maestras import ViveroPmg, Vivero, Pmg


@router.get("/pmg/{id_pmg}/viveros")
def get_pmg_viveros(
    id_pmg: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Get viveros that supply a PMG, enriched with vivero name."""
    rows = db.query(ViveroPmg).filter(ViveroPmg.id_pmg == id_pmg, ViveroPmg.activo == True).all()
    viv_ids = [r.id_vivero for r in rows]
    viv_map = {}
    if viv_ids:
        for v in db.query(Vivero).filter(Vivero.id_vivero.in_(viv_ids)).all():
            viv_map[v.id_vivero] = v.nombre
    return [
        {"id_vp": r.id_vp, "id_vivero": r.id_vivero, "id_pmg": r.id_pmg,
         "vivero_nombre": viv_map.get(r.id_vivero, f"Vivero #{r.id_vivero}")}
        for r in rows
    ]


@router.post("/pmg/{id_pmg}/viveros", status_code=201)
def add_pmg_vivero(
    id_pmg: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    id_vivero = data.get("id_vivero")
    if not id_vivero:
        raise HTTPException(status_code=400, detail="Se requiere id_vivero")
    existing = db.query(ViveroPmg).filter(
        ViveroPmg.id_pmg == id_pmg, ViveroPmg.id_vivero == id_vivero, ViveroPmg.activo == True
    ).first()
    if existing:
        return {"id_vp": existing.id_vp, "id_vivero": existing.id_vivero, "id_pmg": existing.id_pmg,
                "vivero_nombre": db.get(Vivero, id_vivero).nombre if db.get(Vivero, id_vivero) else "-"}
    vp = ViveroPmg(id_pmg=id_pmg, id_vivero=id_vivero)
    db.add(vp)
    db.commit()
    db.refresh(vp)
    v = db.get(Vivero, id_vivero)
    return {"id_vp": vp.id_vp, "id_vivero": vp.id_vivero, "id_pmg": vp.id_pmg,
            "vivero_nombre": v.nombre if v else "-"}


@router.delete("/pmg/{id_pmg}/viveros/{id_vp}")
def delete_pmg_vivero(
    id_pmg: int,
    id_vp: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    vp = db.get(ViveroPmg, id_vp)
    if not vp or vp.id_pmg != id_pmg:
        raise HTTPException(status_code=404, detail="No encontrado")
    vp.activo = False
    db.commit()
    return {"detail": "Eliminado"}


@router.get("/viveros/{id_vivero}/pmgs")
def get_vivero_pmgs(
    id_vivero: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Get PMGs supplied by a vivero."""
    rows = db.query(ViveroPmg).filter(ViveroPmg.id_vivero == id_vivero, ViveroPmg.activo == True).all()
    pmg_ids = [r.id_pmg for r in rows]
    pmg_map = {}
    if pmg_ids:
        for p in db.query(Pmg).filter(Pmg.id_pmg.in_(pmg_ids)).all():
            pmg_map[p.id_pmg] = p.nombre
    return [
        {"id_vp": r.id_vp, "id_vivero": r.id_vivero, "id_pmg": r.id_pmg,
         "pmg_nombre": pmg_map.get(r.id_pmg, f"PMG #{r.id_pmg}")}
        for r in rows
    ]


# ── SPECIAL: variedades bitacora ─────────────────────────────────────────
@router.get("/variedades/{id}/bitacora")
def get_variedad_bitacora(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(BitacoraVariedad)
        .filter(BitacoraVariedad.id_variedad == id)
        .order_by(BitacoraVariedad.fecha.desc())
        .all()
    )


@router.post("/variedades/{id}/bitacora", status_code=201)
def add_variedad_bitacora(
    id: int,
    body: BitacoraVariedadCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Crear entrada de bitácora (BIT-2..5).

    - BIT-2: campos requeridos (tipo, título, contenido, fecha) validados por schema.
    - BIT-3: fecha debe estar entre 2000-01-01 y mañana.
    - BIT-4: título/contenido/ubicación/resultado sanitizados con bleach.
    - BIT-5: `extra="forbid"` rechaza keys desconocidas.
    """
    payload = body.model_dump()
    payload["tipo_entrada"] = payload["tipo_entrada"].value  # Enum → str
    entry = BitacoraVariedad(id_variedad=id, usuario=user.username, **payload)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/variedades/{id}/bitacora/{bid}")
def update_variedad_bitacora(
    id: int,
    bid: int,
    body: BitacoraVariedadUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    entry = db.get(BitacoraVariedad, bid)
    if not entry or entry.id_variedad != id:
        raise HTTPException(status_code=404, detail="Entrada de bitacora no encontrada")
    values = body.model_dump(exclude_unset=True)
    if "tipo_entrada" in values and values["tipo_entrada"] is not None:
        values["tipo_entrada"] = values["tipo_entrada"].value
    for field, value in values.items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/variedades/{id}/bitacora/{bid}")
def delete_variedad_bitacora(
    id: int,
    bid: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    entry = db.get(BitacoraVariedad, bid)
    if not entry or entry.id_variedad != id:
        raise HTTPException(status_code=404, detail="Entrada de bitacora no encontrada")
    db.delete(entry)
    db.commit()
    return {"detail": "Entrada eliminada"}


# ── SPECIAL: variedades log (change history) ─────────────────────────────
@router.get("/variedades/{id}/log")
def get_variedad_log(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    from app.models.variedades import VariedadLog
    return (
        db.query(VariedadLog)
        .filter(VariedadLog.id_variedad == id)
        .order_by(VariedadLog.fecha.desc())
        .limit(100)
        .all()
    )
