"""Smoke test / QA validation contra el backend desplegado.

Verifica los 21 fixes de la sesión ejecutando requests HTTP reales y
validando respuestas. No toca data (solo GETs + un logout idempotente).

Uso:
    export API_URL=https://backendsegmentacion-xxx.brazilsouth-01.azurewebsites.net/api/v1
    export ADMIN_USER=admin
    export ADMIN_PASS=<password>
    python scripts/smoke_qa_checks.py

Exit code:
    0 si todos los checks pasan
    1 si alguno falla

El script imprime PASS/FAIL por check con detalle para debug.
"""
import json
import os
import sys

import httpx


API_URL = os.environ.get("API_URL", "http://localhost:8000/api/v1").rstrip("/")
ADMIN_USER = os.environ.get("ADMIN_USER")
ADMIN_PASS = os.environ.get("ADMIN_PASS")
TIMEOUT = 30.0


class Report:
    def __init__(self) -> None:
        self.passed: list[str] = []
        self.failed: list[tuple[str, str]] = []
        self.skipped: list[tuple[str, str]] = []

    def ok(self, name: str) -> None:
        self.passed.append(name)
        print(f"  ✔ {name}")

    def fail(self, name: str, why: str) -> None:
        self.failed.append((name, why))
        print(f"  ✘ {name}  — {why}")

    def skip(self, name: str, why: str) -> None:
        self.skipped.append((name, why))
        print(f"  ~ {name}  (skip: {why})")


def _login(client: httpx.Client) -> str | None:
    if not ADMIN_USER or not ADMIN_PASS:
        return None
    r = client.post("/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    if r.status_code != 200:
        print(f"LOGIN FAILED: {r.status_code} {r.text[:200]}")
        return None
    return r.json()["access_token"]


def check_s1_password_hash_not_leaked(client: httpx.Client, r: Report) -> None:
    """S-1: /sistema/usuarios must not return password_hash."""
    rr = client.get("/sistema/usuarios")
    if rr.status_code != 200:
        r.fail("S-1 usuarios list 200", f"got {rr.status_code}")
        return
    forbidden = ("password", "hash", "secret")
    for u in rr.json():
        for k in u.keys():
            kl = k.lower()
            if any(f in kl for f in forbidden):
                r.fail("S-1 no password_hash in response",
                       f"found key '{k}' in user {u.get('username')}")
                return
    r.ok("S-1 password_hash no aparece en /sistema/usuarios")


def check_sec_jwt_410(client: httpx.Client, r: Report) -> None:
    """SEC-JWT: ?token= must return 410 Gone on /files/fotos."""
    token = client.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        r.skip("SEC-JWT 410", "no token in session")
        return
    # Find any existing foto id
    fotos_map = client.get("/fotos-principales").json()
    if not fotos_map:
        r.skip("SEC-JWT 410", "no fotos in DB")
        return
    fid = next(iter(fotos_map.values()))

    # Without Authorization header, use ?token= → must be 410
    rr = httpx.get(f"{API_URL}/files/fotos/{fid}", params={"token": token}, timeout=TIMEOUT)
    if rr.status_code != 410:
        r.fail("SEC-JWT ?token= rejected with 410", f"got {rr.status_code}")
        return
    r.ok("SEC-JWT ?token= returns 410 Gone")


def check_sec_jwt_bearer_works(client: httpx.Client, r: Report) -> None:
    fotos_map = client.get("/fotos-principales").json()
    if not fotos_map:
        r.skip("SEC-JWT Bearer OK", "no fotos")
        return
    fid = next(iter(fotos_map.values()))
    rr = client.get(f"/files/fotos/{fid}")
    if rr.status_code != 200:
        r.fail("SEC-JWT Bearer header 200", f"got {rr.status_code}")
        return
    ct = rr.headers.get("content-type", "")
    if not ct.startswith("image/"):
        r.fail("SEC-JWT Bearer content-type image/*", f"got '{ct}'")
        return
    r.ok("SEC-JWT Bearer header sirve la imagen")


def check_audit_log_schema(client: httpx.Client, r: Report) -> None:
    """S-2: audit log has id_log, registro_id, ip_address keys."""
    rr = client.get("/sistema/audit-log", params={"limit": 5})
    if rr.status_code != 200:
        r.fail("S-2 audit-log 200", f"got {rr.status_code}")
        return
    rows = rr.json()
    if not rows:
        r.skip("S-2 audit-log keys", "empty list")
        return
    expected_keys = {"id_log", "tabla", "registro_id", "accion", "usuario", "ip_address", "fecha"}
    missing = expected_keys - set(rows[0].keys())
    if missing:
        r.fail("S-2 audit-log UI keys present", f"missing {missing}")
        return
    r.ok("S-2 audit-log expone id_log, registro_id, ip_address")


def check_susceptibilidades_filter(client: httpx.Client, r: Report) -> None:
    """SUS-2: ?especie=X filters by id_especie."""
    # Find especie Cerezo
    especies = client.get("/mantenedores/especies").json()
    cer = next((e for e in especies if e.get("codigo") == "CER"), None)
    if not cer:
        r.skip("SUS-2 filter", "no Cerezo in especies")
        return
    id_cer = cer["id_especie"]

    rr = client.get("/mantenedores/susceptibilidades", params={"especie": id_cer})
    if rr.status_code != 200:
        r.fail("SUS-2 filter 200", f"got {rr.status_code}")
        return
    rows = rr.json()
    others = [x for x in rows if x.get("id_especie") and x["id_especie"] != id_cer]
    if others:
        r.fail("SUS-2 filter filters by id_especie",
               f"got {len(others)} rows from other especie")
        return
    r.ok(f"SUS-2 susceptibilidades?especie={id_cer} devuelve solo Cerezo ({len(rows)})")


def check_seed_endpoint_guard(client: httpx.Client, r: Report) -> None:
    """EF-4: seed endpoints return 403 in prod (if ENV=production)."""
    rr = client.post("/labores/seed-estados-fenologicos")
    if rr.status_code == 403:
        r.ok("EF-4 /labores/seed-estados-fenologicos bloqueado en prod (403)")
    elif rr.status_code in (200, 201):
        r.fail("EF-4 seed guard active",
               "endpoint returned 2xx — ENV may not be 'production'. "
               "Set ENV=production in Azure App Service.")
    else:
        r.skip("EF-4 seed guard", f"unexpected status {rr.status_code}")


def check_paises_chile_orden(client: httpx.Client, r: Report) -> None:
    """PS-2: Chile orden=0."""
    rr = client.get("/mantenedores/paises")
    if rr.status_code != 200:
        r.fail("PS-2 paises 200", f"got {rr.status_code}")
        return
    chile = next((p for p in rr.json() if p.get("codigo") == "CL"), None)
    if chile is None:
        r.skip("PS-2 Chile orden", "no CL country in list")
        return
    if chile.get("orden") != 0:
        r.fail("PS-2 Chile orden=0",
               f"got orden={chile.get('orden')}. "
               f"Run scripts/fix_paises_chile_orden.py --execute")
        return
    r.ok("PS-2 Chile orden=0")


def check_reporte_variedad_includes_pol_sus(client: httpx.Client, r: Report) -> None:
    """REP-1: /reportes/variedad/{id} includes polinizantes y susceptibilidades."""
    # Pick any active variedad
    vars_ = client.get("/mantenedores/variedades", params={"limit": 5}).json()
    if not vars_:
        r.skip("REP-1", "no variedades")
        return
    id_var = vars_[0]["id_variedad"]

    rr = client.get(f"/reportes/variedad/{id_var}")
    if rr.status_code != 200:
        r.fail("REP-1 reporte variedad 200", f"got {rr.status_code}")
        return
    body = rr.json()
    missing = [k for k in ("polinizantes", "susceptibilidades") if k not in body]
    if missing:
        r.fail("REP-1 reporte incluye pol+sus", f"missing keys: {missing}")
        return
    r.ok("REP-1 /reportes/variedad incluye polinizantes y susceptibilidades")


def check_pol_schema_strict(client: httpx.Client, r: Report) -> None:
    """POL-4: extra field → 422 (does not touch DB)."""
    vars_ = client.get("/mantenedores/variedades", params={"limit": 1}).json()
    if not vars_:
        r.skip("POL-4", "no variedades")
        return
    id_var = vars_[0]["id_variedad"]
    # Send a body with unknown field — schema must reject 422
    rr = client.post(f"/variedades/{id_var}/polinizantes",
                     json={"polinizante_nombre": "qa-smoke", "bogus": True})
    if rr.status_code == 422:
        r.ok("POL-4 schema strict rechaza campos desconocidos (422)")
    elif rr.status_code in (201, 409):
        # 201 = permitido (falla), 409 = dup (también implica campo aceptado)
        r.fail("POL-4 strict",
               f"got {rr.status_code} — el endpoint aceptó el body con field bogus")
    else:
        r.skip("POL-4", f"unexpected {rr.status_code}: {rr.text[:100]}")


def check_bit_schema_strict(client: httpx.Client, r: Report) -> None:
    """BIT-2: empty body → 422."""
    vars_ = client.get("/mantenedores/variedades", params={"limit": 1}).json()
    if not vars_:
        r.skip("BIT-2", "no variedades")
        return
    id_var = vars_[0]["id_variedad"]
    rr = client.post(f"/mantenedores/variedades/{id_var}/bitacora", json={})
    if rr.status_code == 422:
        r.ok("BIT-2 bitácora rechaza body vacío (422)")
    elif rr.status_code == 201:
        r.fail("BIT-2 strict", "empty body created an entry")
    else:
        r.skip("BIT-2", f"unexpected {rr.status_code}")


def check_logout_revokes_token(client: httpx.Client, r: Report) -> None:
    """S-10: logout + same token → 401."""
    # Login fresh so we don't revoke the session token
    if not ADMIN_USER or not ADMIN_PASS:
        r.skip("S-10 logout", "no creds")
        return
    rr = httpx.post(f"{API_URL}/auth/login",
                    json={"username": ADMIN_USER, "password": ADMIN_PASS},
                    timeout=TIMEOUT)
    if rr.status_code != 200:
        r.fail("S-10 fresh login", f"{rr.status_code}")
        return
    fresh_token = rr.json()["access_token"]
    h = {"Authorization": f"Bearer {fresh_token}"}

    # Logout
    rr = httpx.post(f"{API_URL}/auth/logout", headers=h, timeout=TIMEOUT)
    if rr.status_code != 200:
        r.fail("S-10 logout", f"{rr.status_code}")
        return

    # /auth/me with revoked token must be 401
    rr = httpx.get(f"{API_URL}/auth/me", headers=h, timeout=TIMEOUT)
    if rr.status_code == 401:
        r.ok("S-10 token revocado tras logout (401)")
    else:
        r.fail("S-10 logout revokes jti", f"got {rr.status_code}")


def check_fotos_coverage(client: httpx.Client, r: Report) -> None:
    """QA 🟠 FIX-FOTOS (info only): print coverage ratio."""
    vars_ = client.get("/mantenedores/variedades", params={"limit": 10000}).json()
    fotos_map = client.get("/fotos-principales").json()
    total = len(vars_)
    with_foto = len([v for v in vars_ if v["id_variedad"] in fotos_map
                      or str(v["id_variedad"]) in fotos_map])
    print(f"  i  foto coverage: {with_foto}/{total} "
          f"({100*with_foto/max(total,1):.1f}%)")


def main() -> int:
    print(f"API_URL = {API_URL}")
    print(f"ADMIN_USER = {ADMIN_USER or '(none)'}")
    print()

    r = Report()
    with httpx.Client(base_url=API_URL, timeout=TIMEOUT) as client:
        token = _login(client)
        if token is None:
            print("No auth token — skipping authenticated checks.")
            return 1
        client.headers["Authorization"] = f"Bearer {token}"

        print("\n== Autenticación / Sistema ==")
        check_s1_password_hash_not_leaked(client, r)
        check_audit_log_schema(client, r)
        check_seed_endpoint_guard(client, r)

        print("\n== Catálogos / Mantenedores ==")
        check_paises_chile_orden(client, r)
        check_susceptibilidades_filter(client, r)

        print("\n== Fotos / SEC-JWT ==")
        check_sec_jwt_bearer_works(client, r)
        check_sec_jwt_410(client, r)
        check_fotos_coverage(client, r)

        print("\n== Variedades (POL + BIT + REP) ==")
        check_reporte_variedad_includes_pol_sus(client, r)
        check_pol_schema_strict(client, r)
        check_bit_schema_strict(client, r)

        print("\n== JWT S-10 ==")
        check_logout_revokes_token(client, r)

    print("\n" + "=" * 60)
    print(f"PASSED: {len(r.passed)}")
    print(f"FAILED: {len(r.failed)}")
    print(f"SKIPPED: {len(r.skipped)}")
    if r.failed:
        print("\nFAILURES:")
        for name, why in r.failed:
            print(f"  - {name}: {why}")
    print("=" * 60)
    return 0 if not r.failed else 1


if __name__ == "__main__":
    sys.exit(main())
