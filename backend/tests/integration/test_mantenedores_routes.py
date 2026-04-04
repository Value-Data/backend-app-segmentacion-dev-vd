"""Integration tests for generic mantenedor CRUD routes: /api/v1/mantenedores/{entidad}."""


class TestListPaises:
    """Tests for GET /api/v1/mantenedores/paises."""

    def test_list_paises_empty(self, client, test_user, auth_headers):
        """GET /paises on an empty table should return an empty list."""
        response = client.get("/api/v1/mantenedores/paises", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_paises_after_create(self, client, test_user, auth_headers):
        """GET /paises should include a previously created record."""
        client.post(
            "/api/v1/mantenedores/paises",
            json={"codigo": "CL", "nombre": "Chile"},
            headers=auth_headers,
        )
        response = client.get("/api/v1/mantenedores/paises", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        codigos = [p["codigo"] for p in data]
        assert "CL" in codigos

    def test_list_paises_requires_auth(self, client):
        """GET /paises without auth should return 401."""
        response = client.get("/api/v1/mantenedores/paises")
        assert response.status_code == 401


class TestCreatePais:
    """Tests for POST /api/v1/mantenedores/paises."""

    def test_create_pais_success(self, client, test_user, auth_headers):
        """POST /paises with valid data should return 201 and the new record."""
        response = client.post(
            "/api/v1/mantenedores/paises",
            json={"codigo": "AR", "nombre": "Argentina"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["codigo"] == "AR"
        assert data["nombre"] == "Argentina"
        assert "id_pais" in data

    def test_create_pais_requires_auth(self, client):
        """POST /paises without auth should return 401."""
        response = client.post(
            "/api/v1/mantenedores/paises",
            json={"codigo": "BR", "nombre": "Brasil"},
        )
        assert response.status_code == 401


class TestGetPaisById:
    """Tests for GET /api/v1/mantenedores/paises/{id}."""

    def test_get_pais_by_id_success(self, client, test_user, auth_headers):
        """GET /paises/{id} should return the matching record."""
        create_resp = client.post(
            "/api/v1/mantenedores/paises",
            json={"codigo": "PE", "nombre": "Peru"},
            headers=auth_headers,
        )
        pais_id = create_resp.json()["id_pais"]

        response = client.get(f"/api/v1/mantenedores/paises/{pais_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["codigo"] == "PE"

    def test_get_pais_by_id_not_found(self, client, test_user, auth_headers):
        """GET /paises/{id} for a non-existent ID should return 404."""
        response = client.get("/api/v1/mantenedores/paises/99999", headers=auth_headers)
        assert response.status_code == 404


class TestUpdatePais:
    """Tests for PUT /api/v1/mantenedores/paises/{id}."""

    def test_update_pais_success(self, client, test_user, auth_headers):
        """PUT /paises/{id} should update the record."""
        create_resp = client.post(
            "/api/v1/mantenedores/paises",
            json={"codigo": "MX", "nombre": "Mexico"},
            headers=auth_headers,
        )
        pais_id = create_resp.json()["id_pais"]

        response = client.put(
            f"/api/v1/mantenedores/paises/{pais_id}",
            json={"nombre": "Mexico Actualizado"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["nombre"] == "Mexico Actualizado"
        assert response.json()["codigo"] == "MX"  # unchanged

    def test_update_pais_not_found(self, client, test_user, auth_headers):
        """PUT /paises/{id} for a non-existent ID should return 404."""
        response = client.put(
            "/api/v1/mantenedores/paises/99999",
            json={"nombre": "Ghost"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestDeletePais:
    """Tests for DELETE /api/v1/mantenedores/paises/{id} (soft delete)."""

    def test_soft_delete_pais(self, client, test_user, auth_headers):
        """DELETE /paises/{id} should soft-delete (activo=False) and return ok."""
        create_resp = client.post(
            "/api/v1/mantenedores/paises",
            json={"codigo": "CO", "nombre": "Colombia"},
            headers=auth_headers,
        )
        pais_id = create_resp.json()["id_pais"]

        response = client.delete(f"/api/v1/mantenedores/paises/{pais_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True

        # Verify it no longer shows in the active list
        list_resp = client.get("/api/v1/mantenedores/paises", headers=auth_headers)
        codigos = [p["codigo"] for p in list_resp.json()]
        assert "CO" not in codigos

    def test_delete_pais_not_found(self, client, test_user, auth_headers):
        """DELETE /paises/{id} for a non-existent ID should return 404."""
        response = client.delete("/api/v1/mantenedores/paises/99999", headers=auth_headers)
        assert response.status_code == 404


class TestNonexistentEntity:
    """Tests for unknown entity names."""

    def test_get_nonexistent_entity(self, client, test_user, auth_headers):
        """GET /nonexistent should return 404."""
        response = client.get("/api/v1/mantenedores/nonexistent", headers=auth_headers)
        assert response.status_code == 404
