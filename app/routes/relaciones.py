"""API endpoints for N:M relationship management.

Handles:
- Portainjerto <-> Especie (portainjerto_especies)
- Vivero <-> PMG (vivero_pmg)
- PMG <-> Especie (pmg_especies — already existed, now with full CRUD)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.sistema import Usuario
from app.models.maestras import (
    PortainjertoEspecie, ViveroPmg, PmgEspecie,
    Portainjerto, Vivero, Pmg, Especie,
)

router = APIRouter(prefix="/relaciones", tags=["Relaciones N:M"])


class IdsPayload(BaseModel):
    """Body for replacing all relationships: list of related entity IDs."""
    ids: list[int]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _replace_relations(
    db: Session,
    junction_model,
    parent_fk_field: str,
    parent_id: int,
    child_fk_field: str,
    new_child_ids: list[int],
):
    """Generic helper: soft-delete old rows and insert new ones."""
    # Deactivate all existing active rows for this parent
    db.query(junction_model).filter(
        getattr(junction_model, parent_fk_field) == parent_id,
        junction_model.activo == True,
    ).update({"activo": False})

    inserted = []
    for child_id in new_child_ids:
        # Try to reactivate an existing row first
        existing = db.query(junction_model).filter(
            getattr(junction_model, parent_fk_field) == parent_id,
            getattr(junction_model, child_fk_field) == child_id,
        ).first()
        if existing:
            existing.activo = True
            inserted.append(existing)
        else:
            row = junction_model(**{
                parent_fk_field: parent_id,
                child_fk_field: child_id,
                "activo": True,
            })
            db.add(row)
            inserted.append(row)

    db.commit()
    for r in inserted:
        db.refresh(r)
    return inserted


def _list_relations(db: Session, junction_model, fk_field: str, parent_id: int):
    """Return all active junction rows for a given parent."""
    return db.query(junction_model).filter(
        getattr(junction_model, fk_field) == parent_id,
        junction_model.activo == True,
    ).all()


# ---------------------------------------------------------------------------
# Portainjerto <-> Especie
# ---------------------------------------------------------------------------

@router.get("/portainjerto/{id}/especies")
def get_portainjerto_especies(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """List especies linked to a portainjerto."""
    pi = db.get(Portainjerto, id)
    if not pi:
        raise HTTPException(404, "Portainjerto no encontrado")
    rows = _list_relations(db, PortainjertoEspecie, "id_portainjerto", id)
    # Enrich with especie name
    result = []
    for r in rows:
        esp = db.get(Especie, r.id_especie)
        result.append({
            "id_pe": r.id_pe,
            "id_portainjerto": r.id_portainjerto,
            "id_especie": r.id_especie,
            "especie_nombre": esp.nombre if esp else None,
            "especie_color_hex": esp.color_hex if esp else None,
        })
    return result


@router.post("/portainjerto/{id}/especies")
def set_portainjerto_especies(
    id: int,
    payload: IdsPayload,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Replace all especies for a portainjerto."""
    pi = db.get(Portainjerto, id)
    if not pi:
        raise HTTPException(404, "Portainjerto no encontrado")
    _replace_relations(
        db, PortainjertoEspecie,
        "id_portainjerto", id,
        "id_especie", payload.ids,
    )
    # Return updated list
    return get_portainjerto_especies(id, db, user)


# ---------------------------------------------------------------------------
# Vivero <-> PMG
# ---------------------------------------------------------------------------

@router.get("/vivero/{id}/pmgs")
def get_vivero_pmgs(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """List PMGs linked to a vivero."""
    viv = db.get(Vivero, id)
    if not viv:
        raise HTTPException(404, "Vivero no encontrado")
    rows = _list_relations(db, ViveroPmg, "id_vivero", id)
    result = []
    for r in rows:
        pmg = db.get(Pmg, r.id_pmg)
        result.append({
            "id_vp": r.id_vp,
            "id_vivero": r.id_vivero,
            "id_pmg": r.id_pmg,
            "pmg_nombre": pmg.nombre if pmg else None,
            "pmg_codigo": pmg.codigo if pmg else None,
        })
    return result


@router.post("/vivero/{id}/pmgs")
def set_vivero_pmgs(
    id: int,
    payload: IdsPayload,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Replace all PMGs for a vivero."""
    viv = db.get(Vivero, id)
    if not viv:
        raise HTTPException(404, "Vivero no encontrado")
    _replace_relations(
        db, ViveroPmg,
        "id_vivero", id,
        "id_pmg", payload.ids,
    )
    return get_vivero_pmgs(id, db, user)


# ---------------------------------------------------------------------------
# PMG <-> Especie  (uses existing pmg_especies table)
# ---------------------------------------------------------------------------

@router.get("/pmg/{id}/especies")
def get_pmg_especies(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """List especies linked to a PMG."""
    pmg = db.get(Pmg, id)
    if not pmg:
        raise HTTPException(404, "PMG no encontrado")
    rows = _list_relations(db, PmgEspecie, "id_pmg", id)
    result = []
    for r in rows:
        esp = db.get(Especie, r.id_especie)
        result.append({
            "id_pmg_especie": r.id_pmg_especie,
            "id_pmg": r.id_pmg,
            "id_especie": r.id_especie,
            "especie_nombre": esp.nombre if esp else None,
            "especie_color_hex": esp.color_hex if esp else None,
        })
    return result


@router.post("/pmg/{id}/especies")
def set_pmg_especies(
    id: int,
    payload: IdsPayload,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Replace all especies for a PMG."""
    pmg = db.get(Pmg, id)
    if not pmg:
        raise HTTPException(404, "PMG no encontrado")
    _replace_relations(
        db, PmgEspecie,
        "id_pmg", id,
        "id_especie", payload.ids,
    )
    return get_pmg_especies(id, db, user)
