"""Cleanup de catálogos según QA report (Módulo 2 y bugs #75, #77, #78, #79, C-CAM-1, C-TMP-1).

Operaciones disponibles (todas dry-run por default, usar --execute para aplicar):

  --tildes       Agrega tildes a nombres: Espana→España, Tarapaca→Tarapacá,
                 Valparaiso→Valparaíso, Biobio→Biobío, Nuble→Ñuble,
                 Araucania→Araucanía, OHiggins→O'Higgins (paises, regiones, comunas).
  --test-data    Desactiva (activo=0) registros de test: nombres con "Test",
                 "Prueba", "Import Masivo", "_TEST_", "E2E", "TI-PI", "2BAD31"
                 en especies, campos, temporadas, portainjertos, variedades.
  --estados-final Marca es_final=1 en estados_planta con código/nombre:
                 baja, cosechada, arrancada, descartada, muerta, eliminada.
  --colores-dups Lista duplicados en `colores` por codigo; preserva el de menor id_color.
  --origenes-vs-paises  Lista orígenes cuyo nombre coincide con una fila de paises;
                 los desactiva si es_pais=True (inferencia por nombre exacto).

Without flags: dry-run de TODAS las operaciones juntas (solo muestra qué haría).

Usage:
    python scripts/fix_catalogos_cleanup.py                         # dry-run all
    python scripts/fix_catalogos_cleanup.py --tildes --execute      # aplica solo tildes
    python scripts/fix_catalogos_cleanup.py --all --execute         # aplica todo
"""
import argparse
import os
import sys

_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
os.chdir(_BACKEND_DIR)
sys.path.insert(0, _BACKEND_DIR)
from sqlalchemy import text, create_engine  # noqa: E402
from app.core.config import get_settings  # noqa: E402

# Rebuild engine with larger timeout to survive Azure serverless cold starts.
_s = get_settings()
_cs = (
    f"DRIVER={{{_s.DB_DRIVER}}};"
    f"SERVER={_s.DB_SERVER};"
    f"DATABASE={_s.DB_NAME};"
    f"UID={_s.DB_USER};"
    f"PWD={_s.DB_PASSWORD};"
    "Encrypt=yes;TrustServerCertificate=no;"
    "Connection Timeout=120;"
)
engine = create_engine(
    f"mssql+pyodbc:///?odbc_connect={_cs}",
    pool_pre_ping=True,
)


def _wake_db(max_attempts: int = 8, delay: int = 15):
    """Try to wake the Azure DB; serverless can take 1-2 min to resume."""
    import time
    for i in range(max_attempts):
        try:
            with engine.connect() as c:
                c.execute(text("SELECT 1"))
            if i > 0:
                print(f"  BD despertó tras {i} reintento(s)")
            return
        except Exception:
            if i < max_attempts - 1:
                print(f"  Intento {i+1}/{max_attempts}: BD dormida. Esperando {delay}s...")
                time.sleep(delay)
    raise RuntimeError(f"BD no respondió tras {max_attempts} intentos")


# -----------------------------------------------------------------------------
# Tildes
# -----------------------------------------------------------------------------

TILDES_PAISES = [
    ("Espana", "España"),
    ("Peru", "Perú"),
    ("Mexico", "México"),
    ("Japon", "Japón"),
]
TILDES_REGIONES = [
    ("Arica y Parinacota", "Arica y Parinacota"),  # ya ok
    ("Tarapaca", "Tarapacá"),
    ("Antofagasta", "Antofagasta"),  # ya ok
    ("Atacama", "Atacama"),  # ya ok
    ("Coquimbo", "Coquimbo"),  # ya ok
    ("Valparaiso", "Valparaíso"),
    ("Metropolitana", "Metropolitana"),  # ya ok
    ("OHiggins", "O'Higgins"),
    ("O Higgins", "O'Higgins"),
    ("Maule", "Maule"),  # ya ok
    ("Nuble", "Ñuble"),
    ("Biobio", "Biobío"),
    ("Bio Bio", "Biobío"),
    ("La Araucania", "La Araucanía"),
    ("Araucania", "La Araucanía"),
    ("Los Rios", "Los Ríos"),
    ("Los Lagos", "Los Lagos"),  # ya ok
    ("Aysen", "Aysén"),
    ("Magallanes", "Magallanes"),  # ya ok
]


def op_tildes(conn, execute: bool) -> int:
    print("=== TILDES ===")
    total = 0
    for tabla, pares in [("paises", TILDES_PAISES), ("regiones", TILDES_REGIONES)]:
        for old, new in pares:
            if old == new:
                continue
            count = conn.execute(
                text(f"SELECT COUNT(*) FROM {tabla} WHERE nombre = :old"),
                {"old": old},
            ).scalar()
            if count:
                print(f"  {tabla}: {count} filas  '{old}' -> '{new}'")
                total += count
                if execute:
                    conn.execute(
                        text(f"UPDATE {tabla} SET nombre = :new WHERE nombre = :old"),
                        {"new": new, "old": old},
                    )
    if total == 0:
        print("  sin cambios")
    return total


# -----------------------------------------------------------------------------
# Data test
# -----------------------------------------------------------------------------

TEST_PATTERNS = ["%_TEST_%", "%E2E%", "%2BAD31%", "%Prueba%", "%Import Masivo%", "Test%", "%TI-PI%"]

TEST_TABLES = [
    ("especies", "nombre", "id_especie"),
    ("campos", "nombre", "id_campo"),
    ("temporadas", "nombre", "id_temporada"),
    ("temporadas", "codigo", "id_temporada"),
    ("portainjertos", "codigo", "id_portainjerto"),
    ("variedades", "codigo", "id_variedad"),
]


def op_test_data(conn, execute: bool) -> int:
    print("=== DATA TEST ===")
    total = 0
    for tabla, campo, id_col in TEST_TABLES:
        for pat in TEST_PATTERNS:
            rows = conn.execute(
                text(f"SELECT {id_col}, {campo} FROM {tabla} WHERE {campo} LIKE :pat AND activo = 1"),
                {"pat": pat},
            ).all()
            if rows:
                print(f"  {tabla}.{campo} LIKE '{pat}': {len(rows)} filas")
                for r in rows[:5]:
                    print(f"    id={r[0]}  {campo}='{r[1]}'")
                if len(rows) > 5:
                    print(f"    ...and {len(rows) - 5} more")
                total += len(rows)
                if execute:
                    conn.execute(
                        text(f"UPDATE {tabla} SET activo = 0 WHERE {campo} LIKE :pat AND activo = 1"),
                        {"pat": pat},
                    )
    if total == 0:
        print("  sin cambios")
    return total


# -----------------------------------------------------------------------------
# Estados Planta Es Final (#77)
# -----------------------------------------------------------------------------

ESTADOS_FINALES = ["baja", "cosechada", "arrancada", "descartada", "muerta", "eliminada"]


def op_estados_final(conn, execute: bool) -> int:
    print("=== ESTADOS PLANTA es_final ===")
    estados = conn.execute(
        text("SELECT id_estado, codigo, nombre, es_final FROM estados_planta WHERE activo = 1")
    ).all()
    to_update = []
    for r in estados:
        id_est, cod, nom, es_fin = r
        should_be_final = any(
            k in (cod or "").lower() or k in (nom or "").lower()
            for k in ESTADOS_FINALES
        )
        current = bool(es_fin)
        if should_be_final and not current:
            to_update.append((id_est, nom, True))
    print(f"  A marcar es_final=1: {len(to_update)}")
    for id_est, nom, _ in to_update:
        print(f"    id={id_est}  '{nom}'")
    if execute:
        for id_est, _, _ in to_update:
            conn.execute(
                text("UPDATE estados_planta SET es_final = 1 WHERE id_estado = :id"),
                {"id": id_est},
            )
    return len(to_update)


# -----------------------------------------------------------------------------
# Colores duplicados (#75)
# -----------------------------------------------------------------------------


def op_colores_dups(conn, execute: bool) -> int:
    print("=== COLORES DUPLICADOS ===")
    all_rows = conn.execute(
        text("SELECT id_color, codigo, nombre FROM colores ORDER BY codigo, id_color")
    ).all()
    by_code = {}
    for r in all_rows:
        by_code.setdefault(r[1], []).append(r)
    dups = {k: v for k, v in by_code.items() if len(v) > 1}
    if not dups:
        print("  sin duplicados")
        return 0
    total_to_rename = 0
    for cod, rows in dups.items():
        print(f"  codigo='{cod}' tiene {len(rows)} filas:")
        for r in rows:
            print(f"    id={r[0]}  nombre={r[2]}")
        # Rename all but the first (lowest id)
        keep = rows[0]
        for dup in rows[1:]:
            new_code = f"{cod}-DUP{dup[0]}"
            print(f"    → id={dup[0]} recibira codigo='{new_code}' (el keeper es id={keep[0]})")
            total_to_rename += 1
            if execute:
                conn.execute(
                    text("UPDATE colores SET codigo = :new WHERE id_color = :id"),
                    {"new": new_code, "id": dup[0]},
                )
    return total_to_rename


# -----------------------------------------------------------------------------
# Orígenes vs Países (#78)
# -----------------------------------------------------------------------------


def op_origenes_vs_paises(conn, execute: bool) -> int:
    print("=== ORÍGENES contaminados con PAÍSES ===")
    paises_names = {r[0].strip().lower() for r in conn.execute(
        text("SELECT nombre FROM paises WHERE activo = 1")
    ).all()}
    origenes = conn.execute(
        text("SELECT id_origen, codigo, nombre FROM origenes WHERE activo = 1")
    ).all()
    matches = [(r[0], r[1], r[2]) for r in origenes if r[2] and r[2].strip().lower() in paises_names]
    print(f"  Orígenes cuyo nombre coincide con un país activo: {len(matches)}")
    for m in matches:
        print(f"    id={m[0]}  codigo={m[1]}  nombre={m[2]}")
    if execute:
        for m in matches:
            conn.execute(
                text("UPDATE origenes SET activo = 0 WHERE id_origen = :id"),
                {"id": m[0]},
            )
    return len(matches)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--tildes", action="store_true")
    parser.add_argument("--test-data", action="store_true")
    parser.add_argument("--estados-final", action="store_true")
    parser.add_argument("--colores-dups", action="store_true")
    parser.add_argument("--origenes-vs-paises", action="store_true")
    args = parser.parse_args()

    any_flag = args.all or args.tildes or args.test_data or args.estados_final \
        or args.colores_dups or args.origenes_vs_paises
    if not any_flag:
        # No flags → run all as dry-run
        args.all = True

    _wake_db()
    with engine.begin() as conn:
        total = 0
        if args.all or args.tildes:
            total += op_tildes(conn, args.execute)
            print()
        if args.all or args.test_data:
            total += op_test_data(conn, args.execute)
            print()
        if args.all or args.estados_final:
            total += op_estados_final(conn, args.execute)
            print()
        if args.all or args.colores_dups:
            total += op_colores_dups(conn, args.execute)
            print()
        if args.all or args.origenes_vs_paises:
            total += op_origenes_vs_paises(conn, args.execute)
            print()

        print(f"=== TOTAL: {total} cambios")
        if not args.execute:
            print("DRY-RUN. Pasa --execute para aplicar.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
