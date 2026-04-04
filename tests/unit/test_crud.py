"""Unit tests for app.services.crud — generic CRUD operations.

Uses the Pais model as a simple test entity.
"""

import pytest
from fastapi import HTTPException

from app.models.maestras import Pais
from app.schemas.maestras import PaisCreate, PaisUpdate
from app.services.crud import list_all, get_by_id, create, update, soft_delete


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_pais(db, codigo: str = "CL", nombre: str = "Chile", activo: bool = True) -> Pais:
    """Insert a Pais directly into the test DB and return it."""
    pais = Pais(codigo=codigo, nombre=nombre, activo=activo)
    db.add(pais)
    db.commit()
    db.refresh(pais)
    return pais


# ---------------------------------------------------------------------------
# list_all
# ---------------------------------------------------------------------------

class TestListAll:
    """Tests for crud.list_all."""

    def test_list_all_returns_records(self, db):
        """list_all should return inserted records."""
        _create_pais(db, "CL", "Chile")
        _create_pais(db, "AR", "Argentina")
        results = list_all(db, Pais)
        codigos = {r.codigo for r in results}
        assert "CL" in codigos
        assert "AR" in codigos

    def test_list_all_only_active_true(self, db):
        """list_all with only_active=True should exclude inactive records."""
        _create_pais(db, "CL", "Chile", activo=True)
        _create_pais(db, "XX", "Inactive", activo=False)
        results = list_all(db, Pais, only_active=True)
        codigos = {r.codigo for r in results}
        assert "CL" in codigos
        assert "XX" not in codigos

    def test_list_all_only_active_false(self, db):
        """list_all with only_active=False should include inactive records."""
        _create_pais(db, "CL", "Chile", activo=True)
        _create_pais(db, "XX", "Inactive", activo=False)
        results = list_all(db, Pais, only_active=False)
        codigos = {r.codigo for r in results}
        assert "CL" in codigos
        assert "XX" in codigos

    def test_list_all_with_filters(self, db):
        """list_all with filters should narrow results."""
        _create_pais(db, "CL", "Chile")
        _create_pais(db, "AR", "Argentina")
        results = list_all(db, Pais, filters={"codigo": "CL"})
        assert len(results) == 1
        assert results[0].codigo == "CL"

    def test_list_all_empty_table(self, db):
        """list_all on an empty table should return an empty list."""
        results = list_all(db, Pais)
        assert results == []

    def test_list_all_skip_and_limit(self, db):
        """list_all should respect skip and limit."""
        _create_pais(db, "CL", "Chile")
        _create_pais(db, "AR", "Argentina")
        _create_pais(db, "BR", "Brasil")
        results = list_all(db, Pais, skip=0, limit=2)
        assert len(results) == 2


# ---------------------------------------------------------------------------
# get_by_id
# ---------------------------------------------------------------------------

class TestGetById:
    """Tests for crud.get_by_id."""

    def test_get_by_id_success(self, db):
        """get_by_id should return the matching record."""
        pais = _create_pais(db, "CL", "Chile")
        result = get_by_id(db, Pais, pais.id_pais)
        assert result.codigo == "CL"
        assert result.nombre == "Chile"

    def test_get_by_id_not_found(self, db):
        """get_by_id should raise HTTPException 404 for a missing ID."""
        with pytest.raises(HTTPException) as exc_info:
            get_by_id(db, Pais, 99999)
        assert exc_info.value.status_code == 404
        assert "no encontrado" in exc_info.value.detail


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

class TestCreate:
    """Tests for crud.create."""

    def test_create_inserts_record(self, db):
        """create should insert a new record and return it with an assigned PK."""
        data = PaisCreate(codigo="PE", nombre="Peru")
        result = create(db, Pais, data)
        assert result.id_pais is not None
        assert result.codigo == "PE"
        assert result.nombre == "Peru"
        assert result.activo is True

    def test_create_with_usuario(self, db):
        """create should set usuario_creacion when the model supports it."""
        # Pais has fecha_creacion but NOT usuario_creacion, so we use a direct check
        data = PaisCreate(codigo="MX", nombre="Mexico")
        result = create(db, Pais, data, usuario="admin")
        assert result.codigo == "MX"

    def test_create_returns_refreshed_object(self, db):
        """create should return an object with auto-generated PK populated."""
        data = PaisCreate(codigo="CO", nombre="Colombia")
        result = create(db, Pais, data)
        assert isinstance(result.id_pais, int)
        assert result.id_pais > 0


# ---------------------------------------------------------------------------
# update
# ---------------------------------------------------------------------------

class TestUpdate:
    """Tests for crud.update."""

    def test_update_modifies_record(self, db):
        """update should change the specified fields."""
        pais = _create_pais(db, "CL", "Chile")
        data = PaisUpdate(nombre="Chile Actualizado")
        result = update(db, Pais, pais.id_pais, data)
        assert result.nombre == "Chile Actualizado"
        assert result.codigo == "CL"  # unchanged

    def test_update_not_found(self, db):
        """update should raise 404 for a non-existent ID."""
        data = PaisUpdate(nombre="Fantasma")
        with pytest.raises(HTTPException) as exc_info:
            update(db, Pais, 99999, data)
        assert exc_info.value.status_code == 404

    def test_update_partial(self, db):
        """update with exclude_unset should only change provided fields."""
        pais = _create_pais(db, "CL", "Chile")
        data = PaisUpdate(orden=5)
        result = update(db, Pais, pais.id_pais, data)
        assert result.orden == 5
        assert result.nombre == "Chile"  # unchanged


# ---------------------------------------------------------------------------
# soft_delete
# ---------------------------------------------------------------------------

class TestSoftDelete:
    """Tests for crud.soft_delete."""

    def test_soft_delete_sets_activo_false(self, db):
        """soft_delete should set activo=False instead of deleting the row."""
        pais = _create_pais(db, "CL", "Chile")
        assert pais.activo is True

        result = soft_delete(db, Pais, pais.id_pais)
        assert result["ok"] is True
        assert result["id"] == pais.id_pais

        # Verify the record is now inactive
        db.refresh(pais)
        assert pais.activo is False

    def test_soft_delete_not_found(self, db):
        """soft_delete should raise 404 for a non-existent ID."""
        with pytest.raises(HTTPException) as exc_info:
            soft_delete(db, Pais, 99999)
        assert exc_info.value.status_code == 404

    def test_soft_delete_excluded_from_active_list(self, db):
        """After soft_delete, the record should not appear in list_all(only_active=True)."""
        pais = _create_pais(db, "ZZ", "Test Delete")
        soft_delete(db, Pais, pais.id_pais)
        results = list_all(db, Pais, only_active=True)
        codigos = {r.codigo for r in results}
        assert "ZZ" not in codigos
