"""Limpieza de data inyectada por QA en prod.

Bugs cubiertos (del reporte QA consolidado):
  - SUS-9 cleanup: variedades_susceptibilidades id_vs IN (20, 21) — Tamara
  - Variedades de prueba con codigo matching %-TEST-% | %-QA-% | CIR-TAMARA-H41
  - Polinizantes huérfanos (padre y/o hija no existe)
  - Bitácora huérfana (variedad padre no existe)

Diseño de seguridad:
  - DRY-RUN por default. Sólo imprime el inventario de lo que se borraría.
  - Con --execute aplica los DELETE en una única transacción.
  - DELETEs de baja blast-radius se ejecutan directamente:
      * variedades_susceptibilidades (id_vs fijo 20, 21)
      * polinizantes/bitácora huérfanos (sin padre viva)
  - Variedades de prueba NO se borran automáticamente — sólo se listan
    junto con sus FKs (mediciones, inventario, posiciones). El operador
    humano decide caso por caso con SQL manual después de ver el reporte.

Usage:
    python scripts/cleanup_qa_data.py              # dry-run (imprime)
    python scripts/cleanup_qa_data.py --execute    # aplica (tx atómica)
"""
import argparse
import os
import sys

_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
os.chdir(_BACKEND_DIR)
sys.path.insert(0, _BACKEND_DIR)

from sqlalchemy import text  # noqa: E402
from app.core.database import engine  # noqa: E402


# IDs conocidos de QA inyección (reporte SUS-9). Si estos IDs ya no están,
# el script no falla — reporta "0 filas" y sigue.
SUS_IDS_TO_DELETE: list[int] = [20, 21]

# Patrones de codigo para variedades sospechosas de ser data de prueba.
# NOTA: sólo se LISTAN, no se borran. Un DELETE de variedades puede
# romper FKs (mediciones, posiciones, inventario) y perder data real.
VARIEDAD_CODIGO_PATTERNS: list[str] = [
    "CIR-TAMARA-H41",   # exact, duplicada en reporte
]
VARIEDAD_CODIGO_LIKE: list[str] = [
    "%-TEST-%",
    "%-QA-%",
]


def preview(conn) -> dict:
    """Inventario de lo que se borraría. No modifica."""
    out: dict = {}

    # --- (1) variedades_susceptibilidades id_vs in list -------------------
    if SUS_IDS_TO_DELETE:
        rows = conn.execute(
            text(
                "SELECT id_vs, id_variedad, id_suscept, nivel "
                "FROM variedades_susceptibilidades "
                "WHERE id_vs IN :ids"
            ).bindparams(ids=tuple(SUS_IDS_TO_DELETE)),
        ).all()
        out["variedades_susceptibilidades"] = [
            {"id_vs": r[0], "id_variedad": r[1], "id_suscept": r[2], "nivel": r[3]}
            for r in rows
        ]

    # --- (2) polinizantes huérfanos (padre o hija no existe) --------------
    pol_orphans = conn.execute(
        text(
            "SELECT p.id, p.id_variedad, p.polinizante_variedad_id, p.polinizante_nombre "
            "FROM variedades_polinizantes p "
            "LEFT JOIN variedades vp ON vp.id_variedad = p.id_variedad "
            "LEFT JOIN variedades vh "
            "  ON vh.id_variedad = p.polinizante_variedad_id "
            "WHERE vp.id_variedad IS NULL "
            "   OR (p.polinizante_variedad_id IS NOT NULL AND vh.id_variedad IS NULL)"
        ),
    ).all()
    out["polinizantes_huerfanos"] = [
        {"id": r[0], "id_variedad": r[1],
         "polinizante_variedad_id": r[2], "polinizante_nombre": r[3]}
        for r in pol_orphans
    ]

    # --- (3) bitácora huérfana --------------------------------------------
    bit_orphans = conn.execute(
        text(
            "SELECT b.id_entrada, b.id_variedad, b.titulo "
            "FROM bitacora_variedades b "
            "LEFT JOIN variedades v ON v.id_variedad = b.id_variedad "
            "WHERE v.id_variedad IS NULL"
        ),
    ).all()
    out["bitacora_huerfana"] = [
        {"id_entrada": r[0], "id_variedad": r[1], "titulo": r[2]}
        for r in bit_orphans
    ]

    # --- (4) variedades sospechosas (LISTAR, no borrar) -------------------
    where_parts = []
    params: dict = {}
    for i, code in enumerate(VARIEDAD_CODIGO_PATTERNS):
        key = f"exact_{i}"
        where_parts.append(f"codigo = :{key}")
        params[key] = code
    for i, pat in enumerate(VARIEDAD_CODIGO_LIKE):
        key = f"like_{i}"
        where_parts.append(f"codigo LIKE :{key}")
        params[key] = pat
    where_clause = " OR ".join(where_parts) if where_parts else "1=0"

    suspects = conn.execute(
        text(
            f"SELECT id_variedad, codigo, nombre, activo FROM variedades "
            f"WHERE {where_clause}"
        ),
        params,
    ).all()

    # Para cada sospechosa, cuenta referencias.
    suspect_details = []
    for id_var, codigo, nombre, activo in suspects:
        refs = {}
        for table, col in [
            ("plantas", "id_variedad"),
            ("posiciones_testblock", "id_variedad"),
            ("inventario_vivero", "id_variedad"),
            ("mediciones_laboratorio", "id_variedad"),
            ("variedades_polinizantes", "id_variedad"),
            ("variedades_polinizantes", "polinizante_variedad_id"),
            ("variedades_susceptibilidades", "id_variedad"),
            ("bitacora_variedades", "id_variedad"),
        ]:
            count = conn.execute(
                text(f"SELECT COUNT(1) FROM {table} WHERE {col} = :v"),
                {"v": id_var},
            ).scalar()
            if count:
                refs[f"{table}.{col}"] = count
        suspect_details.append({
            "id_variedad": id_var, "codigo": codigo, "nombre": nombre,
            "activo": activo, "referencias": refs,
        })
    out["variedades_sospechosas"] = suspect_details

    return out


def _print_preview(p: dict) -> None:
    print("\n" + "=" * 72)
    print("CLEANUP QA DATA — INVENTARIO")
    print("=" * 72)

    sus = p.get("variedades_susceptibilidades", [])
    print(f"\n[1] variedades_susceptibilidades a borrar: {len(sus)}")
    for r in sus:
        print(f"     id_vs={r['id_vs']}  id_variedad={r['id_variedad']}  "
              f"id_suscept={r['id_suscept']}  nivel={r['nivel']}")

    pol = p.get("polinizantes_huerfanos", [])
    print(f"\n[2] polinizantes huérfanos a borrar: {len(pol)}")
    for r in pol[:20]:
        print(f"     id={r['id']}  id_variedad={r['id_variedad']}  "
              f"pol_vid={r['polinizante_variedad_id']}  pol_nom={r['polinizante_nombre']}")
    if len(pol) > 20:
        print(f"     ... y {len(pol) - 20} más")

    bit = p.get("bitacora_huerfana", [])
    print(f"\n[3] bitácora huérfana a borrar: {len(bit)}")
    for r in bit[:20]:
        print(f"     id_entrada={r['id_entrada']}  id_variedad={r['id_variedad']}  "
              f"titulo={r['titulo']}")
    if len(bit) > 20:
        print(f"     ... y {len(bit) - 20} más")

    sus_v = p.get("variedades_sospechosas", [])
    print(f"\n[4] variedades sospechosas (LISTADO, no se borran): {len(sus_v)}")
    for r in sus_v:
        refs_str = ", ".join(f"{k}={v}" for k, v in r["referencias"].items())
        print(f"     id={r['id_variedad']}  codigo={r['codigo']!r}  "
              f"nombre={r['nombre']!r}  activo={r['activo']}")
        if refs_str:
            print(f"         refs: {refs_str}")
        else:
            print(f"         refs: (ninguna — candidato seguro para DELETE manual)")

    print("\n" + "=" * 72)


def execute(conn) -> dict:
    """Aplica los DELETE de baja blast-radius. Todo en la misma tx del caller."""
    totals = {"variedades_susceptibilidades": 0,
              "polinizantes_huerfanos": 0,
              "bitacora_huerfana": 0}

    if SUS_IDS_TO_DELETE:
        res = conn.execute(
            text(
                "DELETE FROM variedades_susceptibilidades "
                "WHERE id_vs IN :ids"
            ).bindparams(ids=tuple(SUS_IDS_TO_DELETE)),
        )
        totals["variedades_susceptibilidades"] = res.rowcount or 0

    res = conn.execute(
        text(
            "DELETE FROM variedades_polinizantes "
            "WHERE id IN ("
            "  SELECT p.id FROM variedades_polinizantes p "
            "  LEFT JOIN variedades vp ON vp.id_variedad = p.id_variedad "
            "  LEFT JOIN variedades vh ON vh.id_variedad = p.polinizante_variedad_id "
            "  WHERE vp.id_variedad IS NULL "
            "     OR (p.polinizante_variedad_id IS NOT NULL AND vh.id_variedad IS NULL)"
            ")"
        ),
    )
    totals["polinizantes_huerfanos"] = res.rowcount or 0

    res = conn.execute(
        text(
            "DELETE FROM bitacora_variedades "
            "WHERE id_entrada IN ("
            "  SELECT b.id_entrada FROM bitacora_variedades b "
            "  LEFT JOIN variedades v ON v.id_variedad = b.id_variedad "
            "  WHERE v.id_variedad IS NULL"
            ")"
        ),
    )
    totals["bitacora_huerfana"] = res.rowcount or 0

    return totals


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true",
                        help="Aplica los DELETEs. Sin este flag, sólo dry-run.")
    args = parser.parse_args()

    with engine.begin() as conn:
        p = preview(conn)
        _print_preview(p)

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar los DELETEs de [1]/[2]/[3].")
            print("NOTA: [4] (variedades sospechosas) nunca se borra desde este script.")
            return 0

        print("\nAplicando DELETEs en transacción atómica...")
        totals = execute(conn)
        for k, v in totals.items():
            print(f"  {k}: {v} filas borradas")

    return 0


if __name__ == "__main__":
    sys.exit(main())
