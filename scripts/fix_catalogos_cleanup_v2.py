"""Cleanup v2: merge reales (no rename a -DUP) + normalizacion vigor.

Cubre bugs C-NEW-12..C-NEW-17:

  --colores-test     Elimina colores de test (COL_TEST_%, %ColorTest%).
  --colores-dups     MERGE real de colores duplicados:
                       redirige FKs del dup al keeper, luego borra dup.
                       FKs cubiertas: variedades.id_color_fruto / _pulpa / _cubrimiento.
                       Reglas de keeper:
                         * codigo canonico conocido (BICO, ROJO, NEGRA, AMAR) gana
                           sobre COH-xxx-DUPxx.
                         * si no, gana el id_color mas bajo.
  --portainjertos-dups  Merge MAX14 <- PI-010 (Maxma 14) redirigiendo FKs
                           en inventario_vivero, mediciones, testblocks,
                           posiciones_testblock, variedades_extra.
  --pmg-dups         Merge ZAIGER <- PMG-016 (Zaiger genetics 1) redirigiendo
                           FKs en variedades, testblocks, posiciones_testblock,
                           viveros, vivero_pmg, pmg_especies.
  --vigor-normalize  Normaliza portainjertos.vigor a enum:
                       muy_bajo | bajo | medio | alto | muy_alto | semi_vigoroso

Sin flags: dry-run de todo.

Uso:
    python scripts/fix_catalogos_cleanup_v2.py                     # dry-run all
    python scripts/fix_catalogos_cleanup_v2.py --all --execute     # aplica todo
"""
import argparse
import os
import sys
import time

_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
os.chdir(_BACKEND_DIR)
sys.path.insert(0, _BACKEND_DIR)

from sqlalchemy import text, create_engine  # noqa: E402
from app.core.config import get_settings  # noqa: E402

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
    for i in range(max_attempts):
        try:
            with engine.connect() as c:
                c.execute(text("SELECT 1"))
            if i > 0:
                print(f"  BD desperto tras {i} reintento(s)")
            return
        except Exception:
            if i < max_attempts - 1:
                print(f"  Intento {i+1}/{max_attempts}: BD dormida. Esperando {delay}s...")
                time.sleep(delay)
    raise RuntimeError(f"BD no respondio tras {max_attempts} intentos")


# ---------------------------------------------------------------------------
# Colores test
# ---------------------------------------------------------------------------

COLORES_TEST_PATTERNS = ["COL_TEST_%", "%ColorTest%", "%_TEST_%"]


def op_colores_test(conn, execute: bool) -> int:
    print("=== COLORES TEST ===")
    total = 0
    for pat in COLORES_TEST_PATTERNS:
        rows = conn.execute(
            text("SELECT id_color, codigo, nombre FROM colores WHERE (codigo LIKE :p OR nombre LIKE :p)"),
            {"p": pat},
        ).all()
        for r in rows:
            print(f"  id={r[0]}  codigo={r[1]}  nombre={r[2]}  (pattern={pat})")
            total += 1
            if execute:
                # Nullificar FKs primero para permitir el delete
                conn.execute(
                    text(
                        "UPDATE variedades SET id_color_fruto = NULL WHERE id_color_fruto = :id;"
                        "UPDATE variedades SET id_color_pulpa = NULL WHERE id_color_pulpa = :id;"
                        "UPDATE variedades SET id_color_cubrimiento = NULL WHERE id_color_cubrimiento = :id;"
                    ),
                    {"id": r[0]},
                )
                conn.execute(
                    text("DELETE FROM colores WHERE id_color = :id"),
                    {"id": r[0]},
                )
    if total == 0:
        print("  sin coincidencias")
    return total


# ---------------------------------------------------------------------------
# Colores -DUP merge
# ---------------------------------------------------------------------------

# Mapeo: codigo_canonico_preferido -> lista de sinonimos
COLOR_CANONICAL = {
    "BICO": ["COH-001-DUP25"],
    "NEGRA": ["COH-002-DUP26"],  # no canonical -> rename
    "AMAR": ["COH-003-DUP29"],
    "ROJO": ["COH-003"],
}


def _find_color(conn, codigo: str):
    row = conn.execute(
        text("SELECT id_color, codigo, nombre FROM colores WHERE codigo = :c"),
        {"c": codigo},
    ).first()
    return row


def _merge_color(conn, keeper_id: int, dup_id: int, execute: bool):
    """Redirige FKs de dup_id -> keeper_id en variedades, luego borra dup."""
    for col in ("id_color_fruto", "id_color_pulpa", "id_color_cubrimiento"):
        count = conn.execute(
            text(f"SELECT COUNT(*) FROM variedades WHERE {col} = :dup"),
            {"dup": dup_id},
        ).scalar()
        if count:
            print(f"    variedades.{col}: {count} filas -> redirigir a id={keeper_id}")
            if execute:
                conn.execute(
                    text(f"UPDATE variedades SET {col} = :keep WHERE {col} = :dup"),
                    {"keep": keeper_id, "dup": dup_id},
                )
    if execute:
        conn.execute(text("DELETE FROM colores WHERE id_color = :id"), {"id": dup_id})


def op_colores_dups(conn, execute: bool) -> int:
    print("=== COLORES -DUP MERGE ===")
    total = 0
    for canon_code, dup_codes in COLOR_CANONICAL.items():
        keeper = _find_color(conn, canon_code)
        if not keeper:
            # No existe canonical. Si hay un solo dup, renombrarlo al canonical (no merge).
            existing_dups = [c for c in dup_codes if _find_color(conn, c)]
            if len(existing_dups) == 1:
                dup = _find_color(conn, existing_dups[0])
                dup_id, _, dup_name = dup
                print(f"  RENAME: '{existing_dups[0]}' (id={dup_id}, '{dup_name}') -> codigo='{canon_code}'")
                if execute:
                    conn.execute(
                        text("UPDATE colores SET codigo = :new WHERE id_color = :id"),
                        {"new": canon_code, "id": dup_id},
                    )
                total += 1
            else:
                print(f"  [skip] canonical '{canon_code}' no existe y hay {len(existing_dups)} dups -> requiere decision manual")
            continue
        keeper_id, _, keeper_name = keeper
        for dup_code in dup_codes:
            dup = _find_color(conn, dup_code)
            if not dup:
                continue
            dup_id, _, dup_name = dup
            if dup_id == keeper_id:
                continue
            print(f"  MERGE: keeper='{canon_code}' (id={keeper_id}, '{keeper_name}')  <-  dup='{dup_code}' (id={dup_id}, '{dup_name}')")
            _merge_color(conn, keeper_id, dup_id, execute)
            total += 1
    if total == 0:
        print("  sin merges")
    return total


# ---------------------------------------------------------------------------
# Portainjertos merge (MAX14 <- PI-010)
# ---------------------------------------------------------------------------

PORTAINJERTO_MERGES = [
    # (canonical, dup)
    ("MAX14", "PI-010"),
]

PORTAINJERTO_FK_TABLES = [
    # (tabla, columna)
    ("inventario_vivero", "id_portainjerto"),
    ("mediciones_laboratorio", "id_portainjerto"),
    ("posiciones_testblock", "id_portainjerto"),
    ("plantas", "id_portainjerto"),
    ("portainjerto_especies", "id_portainjerto"),
    ("bitacora_portainjertos", "id_portainjerto"),
]


def _find_portainjerto(conn, codigo: str):
    return conn.execute(
        text("SELECT id_portainjerto, codigo, nombre FROM portainjertos WHERE codigo = :c"),
        {"c": codigo},
    ).first()


def op_portainjertos_dups(conn, execute: bool) -> int:
    print("=== PORTAINJERTOS MERGE ===")
    total = 0
    for canon_code, dup_code in PORTAINJERTO_MERGES:
        keeper = _find_portainjerto(conn, canon_code)
        dup = _find_portainjerto(conn, dup_code)
        if not keeper or not dup:
            print(f"  [skip] {canon_code}/{dup_code} no existe(n)")
            continue
        keeper_id, _, keeper_name = keeper
        dup_id, _, dup_name = dup
        print(f"  MERGE: keeper='{canon_code}' (id={keeper_id}, '{keeper_name}')  <-  dup='{dup_code}' (id={dup_id}, '{dup_name}')")
        for tabla, col in PORTAINJERTO_FK_TABLES:
            try:
                count = conn.execute(
                    text(f"SELECT COUNT(*) FROM {tabla} WHERE {col} = :dup"),
                    {"dup": dup_id},
                ).scalar()
            except Exception as e:
                print(f"    [warn] tabla {tabla} no existe o columna faltante: {e}")
                continue
            if count:
                print(f"    {tabla}.{col}: {count} filas -> redirigir a id={keeper_id}")
                if execute:
                    conn.execute(
                        text(f"UPDATE {tabla} SET {col} = :keep WHERE {col} = :dup"),
                        {"keep": keeper_id, "dup": dup_id},
                    )
        if execute:
            conn.execute(
                text("DELETE FROM portainjertos WHERE id_portainjerto = :id"),
                {"id": dup_id},
            )
        total += 1
    if total == 0:
        print("  sin merges")
    return total


# ---------------------------------------------------------------------------
# PMG merge (ZAIGER <- PMG-016)
# ---------------------------------------------------------------------------

PMG_MERGES = [
    ("ZAIGER", "PMG-016"),
]

PMG_FK_TABLES = [
    ("variedades", "id_pmg"),
    ("posiciones_testblock", "id_pmg"),
    ("inventario_vivero", "id_pmg"),
    ("viveros", "id_pmg"),
    ("vivero_pmg", "id_pmg"),
    ("pmg_especies", "id_pmg"),
]


def _find_pmg(conn, codigo: str):
    return conn.execute(
        text("SELECT id_pmg, codigo, nombre FROM pmg WHERE codigo = :c"),
        {"c": codigo},
    ).first()


def op_pmg_dups(conn, execute: bool) -> int:
    print("=== PMG MERGE ===")
    total = 0
    for canon_code, dup_code in PMG_MERGES:
        keeper = _find_pmg(conn, canon_code)
        dup = _find_pmg(conn, dup_code)
        if not keeper or not dup:
            print(f"  [skip] {canon_code}/{dup_code} no existe(n)")
            continue
        keeper_id, _, keeper_name = keeper
        dup_id, _, dup_name = dup
        print(f"  MERGE: keeper='{canon_code}' (id={keeper_id}, '{keeper_name}')  <-  dup='{dup_code}' (id={dup_id}, '{dup_name}')")
        for tabla, col in PMG_FK_TABLES:
            try:
                count = conn.execute(
                    text(f"SELECT COUNT(*) FROM {tabla} WHERE {col} = :dup"),
                    {"dup": dup_id},
                ).scalar()
            except Exception as e:
                print(f"    [warn] tabla {tabla} no existe o columna faltante: {e}")
                continue
            if count:
                print(f"    {tabla}.{col}: {count} filas -> redirigir a id={keeper_id}")
                if execute:
                    # Evitar violar unique (id_pmg, id_especie) en pmg_especies:
                    # primero eliminar duplicados que colisionarian
                    if tabla == "pmg_especies":
                        conn.execute(
                            text(
                                "DELETE FROM pmg_especies "
                                "WHERE id_pmg = :dup "
                                "AND id_especie IN (SELECT id_especie FROM pmg_especies WHERE id_pmg = :keep)"
                            ),
                            {"keep": keeper_id, "dup": dup_id},
                        )
                    conn.execute(
                        text(f"UPDATE {tabla} SET {col} = :keep WHERE {col} = :dup"),
                        {"keep": keeper_id, "dup": dup_id},
                    )
        if execute:
            conn.execute(
                text("DELETE FROM pmg WHERE id_pmg = :id"),
                {"id": dup_id},
            )
        total += 1
    if total == 0:
        print("  sin merges")
    return total


# ---------------------------------------------------------------------------
# Vigor normalize
# ---------------------------------------------------------------------------

VIGOR_MAP = {
    # (raw lower/strip) -> enum
    "muy bajo": "muy_bajo",
    "muy_bajo": "muy_bajo",
    "bajo": "bajo",
    "medio": "medio",
    "normal": "medio",
    "medio-alto": "alto",
    "medio alto": "alto",
    "alto": "alto",
    "muy alto": "muy_alto",
    "muy_alto": "muy_alto",
    "semi vigoroso": "semi_vigoroso",
    "semi-vigoroso": "semi_vigoroso",
    "semi_vigoroso": "semi_vigoroso",
    "vigoroso": "alto",
}


def op_vigor_normalize(conn, execute: bool) -> int:
    print("=== VIGOR NORMALIZE (portainjertos) ===")
    rows = conn.execute(
        text("SELECT id_portainjerto, codigo, nombre, vigor FROM portainjertos WHERE vigor IS NOT NULL")
    ).all()
    changes = []
    unmapped = []
    for r in rows:
        id_, cod, nom, vig = r
        key = (vig or "").strip().lower()
        if not key:
            continue
        mapped = VIGOR_MAP.get(key)
        if mapped is None:
            unmapped.append((id_, cod, nom, vig))
            continue
        if mapped != vig:
            changes.append((id_, cod, nom, vig, mapped))
    print(f"  A normalizar: {len(changes)}")
    for id_, cod, nom, old, new in changes[:20]:
        print(f"    id={id_}  {cod:<8}  '{old}' -> '{new}'")
    if len(changes) > 20:
        print(f"    ...and {len(changes)-20} more")
    if unmapped:
        print(f"  UNMAPPED (revisar manualmente): {len(unmapped)}")
        for id_, cod, nom, v in unmapped:
            print(f"    id={id_}  {cod:<8}  '{nom}'  vigor='{v}'")
    if execute:
        for id_, _, _, _, new in changes:
            conn.execute(
                text("UPDATE portainjertos SET vigor = :v WHERE id_portainjerto = :id"),
                {"v": new, "id": id_},
            )
    return len(changes)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--colores-test", action="store_true")
    parser.add_argument("--colores-dups", action="store_true")
    parser.add_argument("--portainjertos-dups", action="store_true")
    parser.add_argument("--pmg-dups", action="store_true")
    parser.add_argument("--vigor-normalize", action="store_true")
    args = parser.parse_args()

    any_flag = (
        args.all
        or args.colores_test
        or args.colores_dups
        or args.portainjertos_dups
        or args.pmg_dups
        or args.vigor_normalize
    )
    if not any_flag:
        args.all = True

    _wake_db()
    with engine.begin() as conn:
        total = 0
        if args.all or args.colores_test:
            total += op_colores_test(conn, args.execute)
            print()
        if args.all or args.colores_dups:
            total += op_colores_dups(conn, args.execute)
            print()
        if args.all or args.portainjertos_dups:
            total += op_portainjertos_dups(conn, args.execute)
            print()
        if args.all or args.pmg_dups:
            total += op_pmg_dups(conn, args.execute)
            print()
        if args.all or args.vigor_normalize:
            total += op_vigor_normalize(conn, args.execute)
            print()

        print(f"=== TOTAL: {total} cambios")
        if not args.execute:
            print("DRY-RUN. Pasa --execute para aplicar.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
