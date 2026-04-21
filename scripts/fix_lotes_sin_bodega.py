"""Asigna una bodega default a los lotes huérfanos.

Bug QA #17: 280 de 281 lotes están en el tab 'Sin Bodega', solo 1 en
'Bodega Principal'. Problema de migración que dejó id_bodega NULL.

Fix: asignar todos los lotes con id_bodega NULL a una bodega default
(la primera activa, o 'Bodega Principal' si existe).

Usage:
    python scripts/fix_lotes_sin_bodega.py                       # dry-run
    python scripts/fix_lotes_sin_bodega.py --execute             # apply using first active bodega
    python scripts/fix_lotes_sin_bodega.py --execute --bodega 5  # apply using specific id_bodega
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from sqlalchemy import text  # noqa: E402
from app.core.database import engine  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--bodega", type=int, help="id_bodega to assign (default: first active)")
    args = parser.parse_args()

    with engine.begin() as conn:
        total_sin_bodega = conn.execute(
            text("SELECT COUNT(*) FROM inventario_vivero WHERE id_bodega IS NULL")
        ).scalar()
        total = conn.execute(text("SELECT COUNT(*) FROM inventario_vivero")).scalar()
        print(f"Lotes sin bodega: {total_sin_bodega} / {total}")

        print("\nBodegas disponibles:")
        bodegas = conn.execute(
            text(
                "SELECT id_bodega, nombre, activo FROM bodegas ORDER BY id_bodega"
            )
        ).all()
        for b in bodegas:
            print(f"  id={b[0]:3d}  {b[1]:30s}  activo={b[2]}")

        if total_sin_bodega == 0:
            print("\nNada que corregir.")
            return 0

        # Pick target bodega
        if args.bodega:
            target_id = args.bodega
            target_name = conn.execute(
                text("SELECT nombre FROM bodegas WHERE id_bodega = :id"),
                {"id": args.bodega},
            ).scalar()
            if target_name is None:
                print(f"\nERROR: bodega id={args.bodega} no existe.")
                return 1
        else:
            # Prefer "Bodega Principal" if exists
            target = conn.execute(
                text(
                    "SELECT TOP 1 id_bodega, nombre FROM bodegas "
                    "WHERE activo = 1 AND nombre LIKE 'Bodega Principal%' "
                    "ORDER BY id_bodega"
                )
            ).first()
            if not target:
                target = conn.execute(
                    text(
                        "SELECT TOP 1 id_bodega, nombre FROM bodegas "
                        "WHERE activo = 1 ORDER BY id_bodega"
                    )
                ).first()
            if not target:
                print("\nERROR: no hay bodegas activas.")
                return 1
            target_id, target_name = target

        print(f"\n>>> Target: id={target_id}  nombre='{target_name}'")
        print(f">>> Reasignaría {total_sin_bodega} lotes a esta bodega.")

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar.")
            return 0

        result = conn.execute(
            text(
                "UPDATE inventario_vivero SET id_bodega = :bid "
                "WHERE id_bodega IS NULL"
            ),
            {"bid": target_id},
        )
        print(f"\nActualizados: {result.rowcount} lotes asignados a '{target_name}'.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
