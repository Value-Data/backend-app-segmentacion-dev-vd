"""Deduplica campos con nombre equivalente (TB-9, TB-10).

QA TB-9: El dropdown /testblocks tiene 56 opciones con duplicados x2-x3
(El Retorno x3, Plantel Madre x3, etc).
QA TB-10: Mismo nombre con/sin tildes (La Estación vs La Estacion).

Estrategia:
  1. Normalizar nombre (lowercase + sin tildes + trim) para agrupar.
  2. Dentro de cada grupo, elegir el CANÓNICO:
     a. Si hay uno con nombre que tiene tildes (España/Ñ/etc), prefiere ese.
     b. Si hay uno con testblocks activos, prefiere ese.
     c. Si no, prefiere el de menor id_campo.
  3. Mover todos los testblocks de los duplicados al canónico.
  4. Renombrar el canónico con la forma correcta (con tildes).
  5. Desactivar (activo=0) los duplicados.

Nombres con tildes correctos aplicados:
  "Sta Margarita"     -> "Santa Margarita"
  "Maria Pinto"       -> "María Pinto"
  "La Estacion"       -> "La Estación"
  "Rinconada Maipu"   -> "Rinconada Maipú"

Usage:
    python scripts/fix_campos_dedup.py              # dry-run
    python scripts/fix_campos_dedup.py --execute    # apply
"""
import argparse
import os
import sys
import time
import unicodedata

_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
os.chdir(_BACKEND_DIR)
sys.path.insert(0, _BACKEND_DIR)
from sqlalchemy import text, create_engine  # noqa: E402
from app.core.config import get_settings  # noqa: E402

_s = get_settings()
_cs = (
    f"DRIVER={{{_s.DB_DRIVER}}};SERVER={_s.DB_SERVER};DATABASE={_s.DB_NAME};"
    f"UID={_s.DB_USER};PWD={_s.DB_PASSWORD};Encrypt=yes;TrustServerCertificate=no;"
    "Connection Timeout=120;"
)
engine = create_engine(f"mssql+pyodbc:///?odbc_connect={_cs}", pool_pre_ping=True)


def _wake(max_attempts=8, delay=15):
    for i in range(max_attempts):
        try:
            with engine.connect() as c:
                c.execute(text("SELECT 1"))
            return
        except Exception:
            if i < max_attempts - 1:
                time.sleep(delay)
    raise RuntimeError("BD no respondio")


def _norm(s: str) -> str:
    if not s:
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower().strip())
        if unicodedata.category(c) != "Mn"
    )


def _has_tilde(s: str) -> bool:
    return any(c in s for c in "áéíóúÁÉÍÓÚñÑ")


# Canonical name overrides: some abbreviations need expansion even though
# they normalize to something different.
CANONICAL_OVERRIDES = {
    "sta margarita": "Santa Margarita",
    "maria pinto": "María Pinto",
    "la estacion": "La Estación",
    "rinconada maipu": "Rinconada Maipú",
    "ohiggins": "O'Higgins",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()

    _wake()
    with engine.begin() as conn:
        # Load all active campos
        campos = conn.execute(
            text("SELECT id_campo, nombre FROM campos WHERE activo = 1 ORDER BY nombre")
        ).all()

        # Count TBs per campo (activo)
        tbs = conn.execute(
            text(
                "SELECT id_campo, COUNT(*) FROM testblocks WHERE activo = 1 GROUP BY id_campo"
            )
        ).all()
        tb_count = {r[0]: r[1] for r in tbs}

        groups: dict[str, list[tuple[int, str]]] = {}
        for id_c, nom in campos:
            if not nom:
                continue
            groups.setdefault(_norm(nom), []).append((id_c, nom))

        dups = {k: v for k, v in groups.items() if len(v) > 1}
        print(f"Grupos duplicados: {len(dups)}")

        plan = []  # (keeper_id, keeper_name_final, losers_ids, affected_tbs)
        for key, items in dups.items():
            # Canonical name: override if present; else prefer a version with tildes; else first
            canonical_name = CANONICAL_OVERRIDES.get(key)
            if not canonical_name:
                with_tildes = [n for _, n in items if _has_tilde(n)]
                canonical_name = with_tildes[0] if with_tildes else items[0][1]

            # Keeper: first one with testblocks activos; else lowest id
            sorted_by_tbs = sorted(items, key=lambda x: (-tb_count.get(x[0], 0), x[0]))
            keeper_id = sorted_by_tbs[0][0]
            losers = [i for i, _ in items if i != keeper_id]
            affected = sum(tb_count.get(i, 0) for i in losers)
            plan.append((keeper_id, canonical_name, losers, affected))

        for keeper_id, canonical, losers, affected in plan:
            print(f"  {canonical!r} keeper=id{keeper_id}  losers={losers}  TBs a mover={affected}")

        total_tbs_to_move = sum(p[3] for p in plan)
        total_losers = sum(len(p[2]) for p in plan)
        print(f"\nTotal: TBs a reasignar={total_tbs_to_move}, campos a desactivar={total_losers}")

        if not plan:
            print("Nada que deduplicar.")
            return 0

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar.")
            return 0

        tb_updates = 0
        campo_updates = 0
        for keeper_id, canonical, losers, _ in plan:
            # Move TBs
            for loser_id in losers:
                r = conn.execute(
                    text("UPDATE testblocks SET id_campo = :k WHERE id_campo = :l"),
                    {"k": keeper_id, "l": loser_id},
                )
                tb_updates += r.rowcount
            # Rename keeper to canonical
            conn.execute(
                text("UPDATE campos SET nombre = :n WHERE id_campo = :id"),
                {"n": canonical, "id": keeper_id},
            )
            campo_updates += 1
            # Deactivate losers
            for loser_id in losers:
                conn.execute(
                    text("UPDATE campos SET activo = 0 WHERE id_campo = :id"),
                    {"id": loser_id},
                )
                campo_updates += 1

        print(f"\nListo: TestBlocks movidos={tb_updates}, campos actualizados/desactivados={campo_updates}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
