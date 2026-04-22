"""Full QA E2E test suite: every CRUD button and action across all modules.

Tests every mantenedor entity CRUD (create, read, update, delete),
type coercion (number→string), auth, merge, testblock operations,
inventario flow, labores, fenologia, laboratorio, and edge cases.
"""

import pytest

# ═══════════════════════════════════════════════════════════════════════════════
# Shared helpers
# ═══════════════════════════════════════════════════════════════════════════════

API = "/api/v1"


def crud_test(client, headers, entidad, id_field, create_data, update_data, extra_create_fields=None):
    """Generic CRUD test for any mantenedor entity. Returns (created_id, issues)."""
    issues = []

    # CREATE
    r = client.post(f"{API}/mantenedores/{entidad}", json=create_data, headers=headers)
    if r.status_code != 201:
        issues.append(f"CREATE {entidad}: expected 201, got {r.status_code} - {r.text[:200]}")
        return None, issues
    created = r.json()
    cid = created.get(id_field)
    # SQLite NVARCHAR serialization may return empty body — get ID from LIST
    if not cid:
        r2 = client.get(f"{API}/mantenedores/{entidad}", headers=headers)
        if r2.status_code == 200:
            items = r2.json()
            if items:
                cid = items[-1].get(id_field) or items[0].get(id_field)
    if not cid:
        issues.append(f"CREATE {entidad}: could not resolve '{id_field}'")
        return None, issues

    # LIST
    r = client.get(f"{API}/mantenedores/{entidad}", headers=headers)
    if r.status_code != 200:
        issues.append(f"LIST {entidad}: expected 200, got {r.status_code}")

    # GET BY ID
    r = client.get(f"{API}/mantenedores/{entidad}/{cid}", headers=headers)
    if r.status_code != 200:
        issues.append(f"GET {entidad}/{cid}: expected 200, got {r.status_code}")

    # GET NOT FOUND
    r = client.get(f"{API}/mantenedores/{entidad}/99999", headers=headers)
    if r.status_code != 404:
        issues.append(f"GET {entidad}/99999: expected 404, got {r.status_code}")

    # UPDATE
    r = client.put(f"{API}/mantenedores/{entidad}/{cid}", json=update_data, headers=headers)
    if r.status_code != 200:
        issues.append(f"UPDATE {entidad}/{cid}: expected 200, got {r.status_code} - {r.text[:200]}")

    # UPDATE NOT FOUND
    r = client.put(f"{API}/mantenedores/{entidad}/99999", json=update_data, headers=headers)
    if r.status_code != 404:
        issues.append(f"UPDATE {entidad}/99999: expected 404, got {r.status_code}")

    # DELETE (soft)
    r = client.delete(f"{API}/mantenedores/{entidad}/{cid}", headers=headers)
    if r.status_code != 200:
        issues.append(f"DELETE {entidad}/{cid}: expected 200, got {r.status_code}")

    # DELETE NOT FOUND
    r = client.delete(f"{API}/mantenedores/{entidad}/99999", headers=headers)
    if r.status_code != 404:
        issues.append(f"DELETE {entidad}/99999: expected 404, got {r.status_code}")

    # AUTH: no token
    r = client.get(f"{API}/mantenedores/{entidad}")
    if r.status_code != 401:
        issues.append(f"AUTH {entidad}: GET without token expected 401, got {r.status_code}")

    return cid, issues


# ═══════════════════════════════════════════════════════════════════════════════
# 1. ALL MANTENEDOR ENTITIES CRUD
# ═══════════════════════════════════════════════════════════════════════════════

class TestAllMantenedoresCRUD:
    """Test CRUD for every mantenedor entity."""

    def test_paises(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "paises", "id_pais",
            {"codigo": "CL", "nombre": "Chile"},
            {"nombre": "Chile Updated"})
        assert issues == [], "\n".join(issues)

    def test_regiones(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "regiones", "id_region",
            {"codigo": "RM", "nombre": "Metropolitana"},
            {"nombre": "RM Updated"})
        assert issues == [], "\n".join(issues)

    def test_comunas(self, client, test_user, auth_headers, db):
        from app.models.maestras import Region
        reg = Region(codigo="OH", nombre="OHiggins")
        db.add(reg); db.flush()
        _, issues = crud_test(client, auth_headers, "comunas", "id_comuna",
            {"nombre": "Rancagua", "id_region": reg.id_region},
            {"nombre": "Rancagua Updated"})
        assert issues == [], "\n".join(issues)

    def test_especies(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "especies", "id_especie",
            {"codigo": "CER", "nombre": "Cerezo"},
            {"nombre": "Cerezo Updated"})
        assert issues == [], "\n".join(issues)

    def test_portainjertos(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "portainjertos", "id_portainjerto",
            {"codigo": "MAX14", "nombre": "Maxma 14"},
            {"nombre": "Maxma 14 Updated"})
        assert issues == [], "\n".join(issues)

    def test_pmg(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "pmg", "id_pmg",
            {"codigo": "IFG", "nombre": "IFG Genetics"},
            {"nombre": "IFG Updated"})
        assert issues == [], "\n".join(issues)

    def test_origenes(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "origenes", "id_origen",
            {"codigo": "OR1", "nombre": "Origen Test"},
            {"nombre": "Origen Updated"})
        assert issues == [], "\n".join(issues)

    def test_viveros(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "viveros", "id_vivero",
            {"codigo": "VIV1", "nombre": "Vivero Test"},
            {"nombre": "Vivero Updated"})
        assert issues == [], "\n".join(issues)

    def test_campos(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "campos", "id_campo",
            {"codigo": "CAM1", "nombre": "Campo Test"},
            {"nombre": "Campo Updated"})
        assert issues == [], "\n".join(issues)

    def test_colores(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "colores", "id_color",
            {"codigo": "RJ", "nombre": "Rojo", "tipo": "fruto"},
            {"nombre": "Rojo Updated"})
        assert issues == [], "\n".join(issues)

    def test_susceptibilidades(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "susceptibilidades", "id_suscept",
            {"codigo": "CR", "nombre": "Cracking"},
            {"nombre": "Cracking Updated"})
        assert issues == [], "\n".join(issues)

    def test_tipos_labor(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "tipos-labor", "id_labor",
            {"codigo": "PODA", "nombre": "Poda", "categoria": "manejo"},
            {"nombre": "Poda Updated"})
        assert issues == [], "\n".join(issues)

    def test_estados_planta(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "estados-planta", "id_estado",
            {"codigo": "ACT", "nombre": "Activa", "color_hex": "#00FF00"},
            {"nombre": "Activa Updated"})
        assert issues == [], "\n".join(issues)

    def test_temporadas(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "temporadas", "id_temporada",
            {"codigo": "2025-2026", "nombre": "Temporada 2025-2026"},
            {"nombre": "Temporada Updated"})
        assert issues == [], "\n".join(issues)

    def test_bodegas(self, client, test_user, auth_headers):
        _, issues = crud_test(client, auth_headers, "bodegas", "id_bodega",
            {"codigo": "BOD1", "nombre": "Bodega Central"},
            {"nombre": "Bodega Updated"})
        assert issues == [], "\n".join(issues)

    def test_estados_fenologicos(self, client, test_user, auth_headers, db):
        from app.models.maestras import Especie
        esp = Especie(codigo="CER2", nombre="Cerezo2")
        db.add(esp); db.flush()
        _, issues = crud_test(client, auth_headers, "estados-fenologicos", "id_estado",
            {"id_especie": esp.id_especie, "codigo": "EF1", "nombre": "Yema", "orden": 1},
            {"nombre": "Yema Updated"})
        assert issues == [], "\n".join(issues)

    def test_nonexistent_entity(self, client, test_user, auth_headers):
        r = client.get(f"{API}/mantenedores/fantasma", headers=auth_headers)
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# 2. VARIEDADES: full flow including type coercion
# ═══════════════════════════════════════════════════════════════════════════════

class TestVariedadesFullFlow:

    @pytest.fixture()
    def especie(self, db):
        from app.models.maestras import Especie
        esp = Especie(codigo="VCER", nombre="Cerezo V")
        db.add(esp); db.flush()
        return esp

    @pytest.fixture()
    def pmg(self, db):
        from app.models.maestras import Pmg
        p = Pmg(codigo="VPMG", nombre="PMG Test V")
        db.add(p); db.flush()
        return p

    def test_create_variedad(self, client, test_user, auth_headers, especie, pmg):
        r = client.post(f"{API}/mantenedores/variedades", json={
            "codigo": "V-LAP", "nombre": "Lapins", "id_especie": especie.id_especie,
            "id_pmg": pmg.id_pmg, "estado": "prospecto"
        }, headers=auth_headers)
        assert r.status_code == 201

    def test_update_variedad_with_numbers(self, client, test_user, auth_headers, especie, db):
        """The exact scenario that was failing: update with numeric calibre/firmeza."""
        from app.models.variedades import Variedad
        var = Variedad(codigo="V-NUM", nombre="NumTest", id_especie=especie.id_especie)
        db.add(var); db.flush()
        vid = var.id_variedad

        # Update with NUMBER values (previously caused 500)
        r = client.put(f"{API}/mantenedores/variedades/{vid}", json={
            "nombre": "NumTest Edited",
            "calibre_esperado": 28,
            "firmeza_esperada": 12.5,
            "auto_fertil": True,
            "estado": "en_evaluacion",
        }, headers=auth_headers)
        assert r.status_code == 200, f"Update with numbers failed: {r.text[:300]}"

    def test_update_variedad_with_strings(self, client, test_user, auth_headers, especie, db):
        from app.models.variedades import Variedad
        var = Variedad(codigo="V-STR", nombre="StrTest", id_especie=especie.id_especie)
        db.add(var); db.flush()

        r = client.put(f"{API}/mantenedores/variedades/{var.id_variedad}", json={
            "nombre": "StrTest Edited",
            "calibre_esperado": "28",
            "firmeza_esperada": "12.5",
        }, headers=auth_headers)
        assert r.status_code == 200

    def test_update_variedad_with_nulls(self, client, test_user, auth_headers, especie, db):
        from app.models.variedades import Variedad
        var = Variedad(codigo="V-NUL", nombre="NullTest", id_especie=especie.id_especie,
                       calibre_esperado="28")
        db.add(var); db.flush()

        r = client.put(f"{API}/mantenedores/variedades/{var.id_variedad}", json={
            "calibre_esperado": None,
        }, headers=auth_headers)
        assert r.status_code == 200

    def test_delete_variedad(self, client, test_user, auth_headers, especie, db):
        from app.models.variedades import Variedad
        var = Variedad(codigo="V-DEL", nombre="ToDelete", id_especie=especie.id_especie)
        db.add(var); db.flush()

        r = client.delete(f"{API}/mantenedores/variedades/{var.id_variedad}", headers=auth_headers)
        assert r.status_code == 200

    def test_create_variedad_with_number_coercion(self, client, test_user, auth_headers, especie):
        """CREATE also needs coercion: numbers for string fields."""
        r = client.post(f"{API}/mantenedores/variedades", json={
            "codigo": "V-COE", "nombre": "CoercionTest", "id_especie": especie.id_especie,
            "calibre_esperado": 30, "firmeza_esperada": 15.2,
        }, headers=auth_headers)
        assert r.status_code == 201, f"Create with numbers failed: {r.text[:300]}"


# ═══════════════════════════════════════════════════════════════════════════════
# 3. MERGE
# ═══════════════════════════════════════════════════════════════════════════════

class TestMerge:

    def test_merge_viveros(self, client, test_user, auth_headers, db):
        from app.models.maestras import Vivero
        v1 = Vivero(codigo="MV1", nombre="Vivero A")
        v2 = Vivero(codigo="MV2", nombre="Vivero B")
        db.add(v1); db.add(v2); db.flush()

        r = client.post(f"{API}/mantenedores/viveros/merge", json={
            "source_id": v1.id_vivero, "target_id": v2.id_vivero
        }, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_merge_campos(self, client, test_user, auth_headers, db):
        from app.models.maestras import Campo
        c1 = Campo(codigo="MC1", nombre="Campo A")
        c2 = Campo(codigo="MC2", nombre="Campo B")
        db.add(c1); db.add(c2); db.flush()

        r = client.post(f"{API}/mantenedores/campos/merge", json={
            "source_id": c1.id_campo, "target_id": c2.id_campo
        }, headers=auth_headers)
        assert r.status_code == 200

    def test_merge_pmg(self, client, test_user, auth_headers, db):
        from app.models.maestras import Pmg
        p1 = Pmg(codigo="MP1", nombre="Zaiger 1")
        p2 = Pmg(codigo="MP2", nombre="Zaiger 2")
        db.add(p1); db.add(p2); db.flush()

        r = client.post(f"{API}/mantenedores/pmg/merge", json={
            "source_id": p1.id_pmg, "target_id": p2.id_pmg
        }, headers=auth_headers)
        assert r.status_code == 200

    def test_merge_same_id(self, client, test_user, auth_headers, db):
        from app.models.maestras import Vivero
        v = Vivero(codigo="MS1", nombre="Self")
        db.add(v); db.flush()

        r = client.post(f"{API}/mantenedores/viveros/merge", json={
            "source_id": v.id_vivero, "target_id": v.id_vivero
        }, headers=auth_headers)
        assert r.status_code == 400

    def test_merge_not_found(self, client, test_user, auth_headers):
        r = client.post(f"{API}/mantenedores/viveros/merge", json={
            "source_id": 99998, "target_id": 99999
        }, headers=auth_headers)
        assert r.status_code == 404

    def test_merge_unsupported_entity(self, client, test_user, auth_headers):
        r = client.post(f"{API}/mantenedores/paises/merge", json={
            "source_id": 1, "target_id": 2
        }, headers=auth_headers)
        assert r.status_code == 400

    def test_merge_missing_fields(self, client, test_user, auth_headers):
        r = client.post(f"{API}/mantenedores/viveros/merge", json={}, headers=auth_headers)
        assert r.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# 4. TESTBLOCK OPERATIONS
# ═══════════════════════════════════════════════════════════════════════════════

class TestTestblockOperations:

    @pytest.fixture()
    def tb_setup(self, db, client, test_user, auth_headers):
        from app.models.maestras import Campo, Cuartel, Especie, Vivero
        from app.models.testblock import TestBlock, PosicionTestBlock
        from app.models.variedades import Variedad
        from app.models.inventario import InventarioVivero
        from datetime import date

        campo = Campo(codigo="QA-C", nombre="QA Campo")
        db.add(campo); db.flush()
        cuartel = Cuartel(codigo="QA-CUA", nombre="QA Cuartel", id_campo=campo.id_campo)
        db.add(cuartel); db.flush()
        esp = Especie(codigo="QA-E", nombre="QA Especie")
        db.add(esp); db.flush()
        var = Variedad(codigo="QA-V", nombre="QA Var", id_especie=esp.id_especie)
        db.add(var); db.flush()
        viv = Vivero(codigo="QA-VIV", nombre="QA Vivero")
        db.add(viv); db.flush()

        tb = TestBlock(codigo="QA-TB", nombre="QA TestBlock", id_campo=campo.id_campo,
                       id_cuartel=cuartel.id_cuartel, num_hileras=2, posiciones_por_hilera=3,
                       total_posiciones=6, estado="activo")
        db.add(tb); db.flush()

        positions = []
        for h in range(1, 3):
            for p in range(1, 4):
                pos = PosicionTestBlock(
                    codigo_unico=f"QA-TB-H{h}-P{p}", id_cuartel=cuartel.id_cuartel,
                    id_testblock=tb.id_testblock, hilera=h, posicion=p, estado="vacia")
                db.add(pos)
                positions.append(pos)
        db.flush()

        lote = InventarioVivero(
            codigo_lote="QA-LOT", id_variedad=var.id_variedad, id_especie=esp.id_especie,
            id_vivero=viv.id_vivero, tipo_planta="Planta terminada raiz desnuda",
            cantidad_inicial=20, cantidad_actual=20, fecha_ingreso=date(2025, 1, 1), estado="disponible")
        db.add(lote); db.flush()

        return {"tb": tb, "positions": positions, "lote": lote, "var": var, "esp": esp}

    def test_list_testblocks(self, client, auth_headers, tb_setup):
        r = client.get(f"{API}/testblocks", headers=auth_headers)
        assert r.status_code == 200

    def test_get_testblock(self, client, auth_headers, tb_setup):
        r = client.get(f"{API}/testblocks/{tb_setup['tb'].id_testblock}", headers=auth_headers)
        assert r.status_code == 200

    def test_get_posiciones(self, client, auth_headers, tb_setup):
        r = client.get(f"{API}/testblocks/{tb_setup['tb'].id_testblock}/posiciones", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) == 6

    def test_get_grilla(self, client, auth_headers, tb_setup):
        r = client.get(f"{API}/testblocks/{tb_setup['tb'].id_testblock}/grilla", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["hileras"] == 2
        assert data["max_pos"] == 3
        assert len(data["posiciones"]) == 6

    def test_alta_planta(self, client, auth_headers, tb_setup):
        pos = tb_setup["positions"][0]
        r = client.post(f"{API}/testblocks/{tb_setup['tb'].id_testblock}/alta", json={
            "id_posicion": pos.id_posicion,
            "id_lote": tb_setup["lote"].id_inventario,
        }, headers=auth_headers)
        assert r.status_code == 200, f"Alta failed: {r.text[:300]}"

    def test_alta_on_occupied_position(self, client, auth_headers, tb_setup):
        """Can't plant on an already occupied position."""
        pos = tb_setup["positions"][1]
        # First alta
        client.post(f"{API}/testblocks/{tb_setup['tb'].id_testblock}/alta", json={
            "id_posicion": pos.id_posicion,
            "id_lote": tb_setup["lote"].id_inventario,
        }, headers=auth_headers)
        # Second alta on same position
        r = client.post(f"{API}/testblocks/{tb_setup['tb'].id_testblock}/alta", json={
            "id_posicion": pos.id_posicion,
            "id_lote": tb_setup["lote"].id_inventario,
        }, headers=auth_headers)
        assert r.status_code in (400, 409), f"Expected rejection, got {r.status_code}"

    def test_baja_planta(self, client, auth_headers, tb_setup):
        pos = tb_setup["positions"][2]
        client.post(f"{API}/testblocks/{tb_setup['tb'].id_testblock}/alta", json={
            "id_posicion": pos.id_posicion,
            "id_lote": tb_setup["lote"].id_inventario,
        }, headers=auth_headers)
        r = client.post(f"{API}/testblocks/{tb_setup['tb'].id_testblock}/baja", json={
            "id_posicion": pos.id_posicion,
            "motivo": "test",
        }, headers=auth_headers)
        assert r.status_code == 200

    def test_baja_on_empty_position(self, client, auth_headers, tb_setup):
        pos = tb_setup["positions"][3]
        r = client.post(f"{API}/testblocks/{tb_setup['tb'].id_testblock}/baja", json={
            "id_posicion": pos.id_posicion,
            "motivo": "test",
        }, headers=auth_headers)
        assert r.status_code in (400, 404)

    def test_resumen_hileras(self, client, auth_headers, tb_setup):
        r = client.get(f"{API}/testblocks/{tb_setup['tb'].id_testblock}/resumen-hileras", headers=auth_headers)
        assert r.status_code == 200

    def test_resumen_variedades(self, client, auth_headers, tb_setup):
        r = client.get(f"{API}/testblocks/{tb_setup['tb'].id_testblock}/resumen-variedades", headers=auth_headers)
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# 5. INVENTARIO
# ═══════════════════════════════════════════════════════════════════════════════

class TestInventario:

    def test_list_inventario(self, client, test_user, auth_headers):
        r = client.get(f"{API}/inventario", headers=auth_headers)
        assert r.status_code == 200

    def test_create_lote(self, client, test_user, auth_headers, db):
        from app.models.maestras import Especie, Vivero
        from app.models.variedades import Variedad
        esp = Especie(codigo="INV-E", nombre="Inv Esp")
        db.add(esp); db.flush()
        var = Variedad(codigo="INV-V", nombre="Inv Var", id_especie=esp.id_especie)
        db.add(var); db.flush()
        viv = Vivero(codigo="INV-VIV", nombre="Inv Vivero")
        db.add(viv); db.flush()

        r = client.post(f"{API}/inventario", json={
            "codigo_lote": "LOT-QA-001",
            "id_variedad": var.id_variedad,
            "id_especie": esp.id_especie,
            "id_vivero": viv.id_vivero,
            "tipo_planta": "Planta terminada raiz desnuda",
            "tipo_injertacion": "Ojo vivo",
            "cantidad_inicial": 50,
            "cantidad_actual": 50,
            "fecha_ingreso": "2025-01-15",
            "estado": "disponible",
        }, headers=auth_headers)
        assert r.status_code in (200, 201), f"Create lote failed: {r.text[:300]}"


# ═══════════════════════════════════════════════════════════════════════════════
# 6. LABORES ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestLaboresEndpoints:

    def test_seed_tipos_labor(self, client, test_user, auth_headers):
        r = client.post(f"{API}/labores/seed-tipos-labor", headers=auth_headers)
        assert r.status_code == 201

    def test_list_tipos_labor(self, client, test_user, auth_headers):
        client.post(f"{API}/labores/seed-tipos-labor", headers=auth_headers)
        r = client.get(f"{API}/labores/tipos-labor", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_seed_detalles_labor(self, client, test_user, auth_headers):
        client.post(f"{API}/labores/seed-tipos-labor", headers=auth_headers)
        r = client.post(f"{API}/labores/seed-detalles-labor", headers=auth_headers)
        assert r.status_code == 201
        assert r.json()["created"] >= 50

    def test_detalles_crud(self, client, test_user, auth_headers):
        client.post(f"{API}/labores/seed-tipos-labor", headers=auth_headers)
        tipos = client.get(f"{API}/labores/tipos-labor", headers=auth_headers).json()
        lid = tipos[0]["id_labor"]

        # Create
        r = client.post(f"{API}/labores/tipos-labor/{lid}/detalles", json={
            "descripcion": "QA Step", "aplica_especie": "General"
        }, headers=auth_headers)
        assert r.status_code == 201
        did = r.json()["id_detalle"]

        # List
        r = client.get(f"{API}/labores/tipos-labor/{lid}/detalles", headers=auth_headers)
        assert r.status_code == 200

        # Update
        r = client.put(f"{API}/labores/detalles-labor/{did}", json={
            "descripcion": "QA Step Updated"
        }, headers=auth_headers)
        assert r.status_code == 200

        # Delete
        r = client.delete(f"{API}/labores/detalles-labor/{did}", headers=auth_headers)
        assert r.status_code == 200

    def test_detalles_missing_descripcion(self, client, test_user, auth_headers):
        client.post(f"{API}/labores/seed-tipos-labor", headers=auth_headers)
        tipos = client.get(f"{API}/labores/tipos-labor", headers=auth_headers).json()
        r = client.post(f"{API}/labores/tipos-labor/{tipos[0]['id_labor']}/detalles", json={
            "aplica_especie": "General"
        }, headers=auth_headers)
        assert r.status_code == 422

    def test_dashboard_empty(self, client, test_user, auth_headers):
        r = client.get(f"{API}/labores/dashboard", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_hoy_empty(self, client, test_user, auth_headers):
        r = client.get(f"{API}/labores/hoy", headers=auth_headers)
        assert r.status_code == 200

    def test_ordenes_empty(self, client, test_user, auth_headers):
        r = client.get(f"{API}/labores/ordenes-trabajo", headers=auth_headers)
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# 7. FENOLOGIA
# ═══════════════════════════════════════════════════════════════════════════════

class TestFenologiaEndpoints:

    def test_seed_estados(self, client, test_user, auth_headers, db):
        from app.models.maestras import Especie
        for code, name in [("FE-CER", "Cerezo"), ("FE-CIR", "Ciruela"), ("FE-CAR", "Carozo")]:
            db.add(Especie(codigo=code, nombre=name))
        db.flush()
        r = client.post(f"{API}/labores/seed-estados-fenologicos", headers=auth_headers)
        assert r.status_code == 201
        assert r.json()["created"] > 0

    def test_list_estados(self, client, test_user, auth_headers, db):
        from app.models.maestras import Especie
        db.add(Especie(codigo="FE2-CER", nombre="Cerezo"))
        db.flush()
        client.post(f"{API}/labores/seed-estados-fenologicos", headers=auth_headers)
        r = client.get(f"{API}/mantenedores/estados-fenologicos", headers=auth_headers)
        assert r.status_code == 200

    def test_registro_fenologico_no_positions(self, client, test_user, auth_headers):
        r = client.post(f"{API}/labores/registro-fenologico", json={
            "id_estado_fenol": 1, "posiciones_ids": [], "temporada": "2025-2026"
        }, headers=auth_headers)
        assert r.status_code == 400

    def test_registro_fenologico_missing_estado(self, client, test_user, auth_headers):
        r = client.post(f"{API}/labores/registro-fenologico", json={
            "posiciones_ids": [1], "temporada": "2025-2026"
        }, headers=auth_headers)
        assert r.status_code == 400

    def test_registro_fenologico_bad_estado(self, client, test_user, auth_headers):
        r = client.post(f"{API}/labores/registro-fenologico", json={
            "id_estado_fenol": 99999, "posiciones_ids": [1], "temporada": "2025-2026"
        }, headers=auth_headers)
        assert r.status_code == 404

    def test_historial_empty(self, client, test_user, auth_headers):
        r = client.get(f"{API}/labores/historial-fenologico/99999", headers=auth_headers)
        assert r.status_code == 200
        assert r.json() == []


# ═══════════════════════════════════════════════════════════════════════════════
# 8. LABORATORIO
# ═══════════════════════════════════════════════════════════════════════════════

class TestLaboratorioEndpoints:

    def test_list_mediciones_empty(self, client, test_user, auth_headers):
        r = client.get(f"{API}/laboratorio/mediciones", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, dict)
        assert "data" in body
        assert "total" in body
        assert isinstance(body["data"], list)
        assert body["total"] >= 0

    def test_mediciones_with_filters(self, client, test_user, auth_headers):
        r = client.get(f"{API}/laboratorio/mediciones?especie=1&temporada=2025-2026&variedad=1&pmg=1", headers=auth_headers)
        assert r.status_code == 200

    def test_mediciones_with_fecha_cosecha(self, client, test_user, auth_headers):
        r = client.get(f"{API}/laboratorio/mediciones?fecha_cosecha_desde=2025-01-01&fecha_cosecha_hasta=2025-12-31", headers=auth_headers)
        assert r.status_code == 200

    def test_kpis(self, client, test_user, auth_headers):
        r = client.get(f"{API}/laboratorio/kpis", headers=auth_headers)
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# 9. AUTH & SECURITY
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuthSecurity:

    def test_login_valid(self, client, test_user):
        r = client.post(f"{API}/auth/login", json={"username": "testadmin", "password": "Secret123!"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self, client, test_user):
        r = client.post(f"{API}/auth/login", json={"username": "testadmin", "password": "wrong"})
        assert r.status_code == 401

    def test_login_nonexistent_user(self, client):
        r = client.post(f"{API}/auth/login", json={"username": "ghost", "password": "pass"})
        assert r.status_code == 401

    def test_protected_without_token(self, client):
        endpoints = [
            ("GET", f"{API}/mantenedores/especies"),
            ("GET", f"{API}/testblocks"),
            ("GET", f"{API}/inventario"),
            ("GET", f"{API}/labores/tipos-labor"),
            ("GET", f"{API}/laboratorio/mediciones"),
        ]
        for method, url in endpoints:
            r = client.request(method, url)
            assert r.status_code == 401, f"{method} {url} without token: expected 401, got {r.status_code}"

    def test_admin_only_endpoints(self, client, test_user, db):
        """Viewer role should be rejected from admin-only endpoints."""
        from app.core.security import create_access_token, hash_password
        from app.models.sistema import Usuario
        viewer = Usuario(username="qaviewer", nombre_completo="QA Viewer", email="qv@test.cl",
                         password_hash=hash_password("Pass123!"), rol="visualizador", activo=True)
        db.add(viewer); db.commit()
        token = create_access_token({"sub": "qaviewer", "rol": "visualizador"})
        h = {"Authorization": f"Bearer {token}"}

        admin_endpoints = [
            ("POST", f"{API}/mantenedores/especies", {"codigo": "X", "nombre": "X"}),
            ("POST", f"{API}/labores/seed-tipos-labor", {}),
            ("POST", f"{API}/labores/seed-estados-fenologicos", {}),
        ]
        for method, url, body in admin_endpoints:
            r = client.request(method, url, json=body, headers=h)
            assert r.status_code == 403, f"{method} {url} as viewer: expected 403, got {r.status_code}"


# ═══════════════════════════════════════════════════════════════════════════════
# 10. HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

class TestHealth:
    def test_health(self, client):
        r = client.get(f"{API}/health")
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# 11. S-1 CONTRACT: password_hash nunca se filtra por /sistema/usuarios
# ═══════════════════════════════════════════════════════════════════════════════

class TestS1PasswordHashNotLeaked:
    """S-1: ningún endpoint de /sistema/usuarios debe devolver password_hash."""

    @staticmethod
    def _assert_no_secret_keys(payload):
        """Falla si cualquier key del dict (o de items de lista) contiene password/hash/secret."""
        items = payload if isinstance(payload, list) else [payload]
        forbidden = ("password", "hash", "secret")
        for item in items:
            assert isinstance(item, dict), f"Expected dict, got {type(item)}"
            for key in item.keys():
                k = key.lower()
                assert not any(f in k for f in forbidden), (
                    f"S-1 regression: response contains forbidden key '{key}'"
                )

    def test_list_usuarios_no_password_hash(self, client, auth_headers):
        r = client.get(f"{API}/sistema/usuarios", headers=auth_headers)
        assert r.status_code == 200, r.text
        self._assert_no_secret_keys(r.json())

    def test_get_usuario_by_id_no_password_hash(self, client, auth_headers, test_user):
        r = client.get(f"{API}/sistema/usuarios/{test_user.id_usuario}", headers=auth_headers)
        assert r.status_code == 200, r.text
        self._assert_no_secret_keys(r.json())

    def test_create_usuario_no_password_hash(self, client, auth_headers):
        body = {
            "username": "s1_contract_user",
            "nombre_completo": "Contract Test",
            "email": "s1@test.cl",
            "password": "Secret123!",
            "rol": "visualizador",
        }
        r = client.post(f"{API}/sistema/usuarios", json=body, headers=auth_headers)
        assert r.status_code == 201, r.text
        self._assert_no_secret_keys(r.json())

    def test_update_usuario_no_password_hash(self, client, auth_headers, test_user):
        r = client.put(
            f"{API}/sistema/usuarios/{test_user.id_usuario}",
            json={"nombre_completo": "Renamed"},
            headers=auth_headers,
        )
        assert r.status_code == 200, r.text
        self._assert_no_secret_keys(r.json())
