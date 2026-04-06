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
from app.schemas.variedades import VariedadCreate, VariedadUpdate, VarSusceptCreate, VarSusceptUpdate

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
    "tipos-labor": (TipoLabor, TipoLaborCreate, TipoLaborUpdate),
    "estados-planta": (EstadoPlanta, EstadoPlantaCreate, EstadoPlantaUpdate),
    "temporadas": (Temporada, TemporadaCreate, TemporadaUpdate),
    "bodegas": (Bodega, BodegaCreate, BodegaUpdate),
    "catalogos": (Catalogo, CatalogoCreate, CatalogoUpdate),
    "centros-costo": (CentroCosto, CentroCostoCreate, CentroCostoUpdate),
    "marcos-plantacion": (MarcoPlantacion, MarcoPlantacionCreate, MarcoPlantacionUpdate),
    "variedades": (Variedad, VariedadCreate, VariedadUpdate),
}


def _resolve(entidad: str):
    entry = ENTITY_REGISTRY.get(entidad)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Entidad '{entidad}' no existe")
    return entry


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
    validated = create_schema(**data)
    return crud.create(db, model, validated, usuario=user.username)


# ── UPDATE ──────────────────────────────────────────────────────────────────
@router.put("/{entidad}/{id}")
def update_entity(
    entidad: str,
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    model, _, update_schema = _resolve(entidad)
    validated = update_schema(**data)
    return crud.update(db, model, id, validated, usuario=user.username)


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


# ── SPECIAL: variedades susceptibilidades ───────────────────────────────────
@router.get("/variedades/{id}/susceptibilidades")
def get_variedad_susceptibilidades(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return db.query(VariedadSusceptibilidad).filter(
        VariedadSusceptibilidad.id_variedad == id
    ).all()


@router.post("/variedades/{id}/susceptibilidades", status_code=201)
def add_variedad_susceptibilidad(
    id: int,
    data: VarSusceptCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    data.id_variedad = id
    vs = VariedadSusceptibilidad(**data.model_dump())
    db.add(vs)
    db.commit()
    db.refresh(vs)
    return vs


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
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    entry = BitacoraVariedad(
        id_variedad=id,
        tipo_entrada=data.get("tipo_entrada"),
        fecha=data.get("fecha"),
        titulo=data.get("titulo"),
        contenido=data.get("contenido"),
        resultado=data.get("resultado"),
        id_testblock=data.get("id_testblock"),
        ubicacion=data.get("ubicacion"),
        usuario=user.username,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
