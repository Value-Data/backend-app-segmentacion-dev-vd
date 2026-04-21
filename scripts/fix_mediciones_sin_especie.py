"""Rellena id_especie en mediciones_laboratorio infiriendo de la variedad.

Bug QA #6: 81 mediciones aparecen con "(Sin especie)" en el análisis.
Bug QA #7: Cerezo desaparece de los tabs de análisis (probable misma causa:
           mediciones de cerezo tienen id_especie=NULL, caen al bucket sin especie).

Fix: para cada medición con id_especie IS NULL, setear el id_especie
correspondiente a su variedad vía variedades.id_especie.

Usage:
    python scripts/fix_mediciones_sin_especie.py              # dry-run
    python scripts/fix_mediciones_sin_especie.py --execute    # apply
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
    args = parser.parse_args()

    with engine.begin() as conn:
        total_sin_especie = conn.execute(
            text("SELECT COUNT(*) FROM mediciones_laboratorio WHERE id_especie IS NULL")
        ).scalar()
        print(f"Mediciones con id_especie NULL: {total_sin_especie}")

        if total_sin_especie == 0:
            print("Nada que corregir.")
            return 0

        # Cuántas se pueden inferir desde variedad
        can_fix = conn.execute(
            text(
                "SELECT COUNT(*) FROM mediciones_laboratorio m "
                "INNER JOIN variedades v ON v.id_variedad = m.id_variedad "
                "WHERE m.id_especie IS NULL AND v.id_especie IS NOT NULL"
            )
        ).scalar()
        print(f"Inferibles desde variedad.id_especie: {can_fix}")
        print(f"Quedarán sin especie (variedad huérfana o sin especie): {total_sin_especie - can_fix}")

        # Breakdown by species that would get backfilled
        print("\nEspecies que recibirían registros backfilleados:")
        rows = conn.execute(
            text(
                "SELECT e.nombre, COUNT(*) c "
                "FROM mediciones_laboratorio m "
                "INNER JOIN variedades v ON v.id_variedad = m.id_variedad "
                "INNER JOIN especies e ON e.id_especie = v.id_especie "
                "WHERE m.id_especie IS NULL "
                "GROUP BY e.nombre ORDER BY c DESC"
            )
        ).all()
        for r in rows:
            print(f"  {r[0]:20s} {r[1]:5d}")

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar.")
            return 0

        result = conn.execute(
            text(
                "UPDATE m SET id_especie = v.id_especie "
                "FROM mediciones_laboratorio m "
                "INNER JOIN variedades v ON v.id_variedad = m.id_variedad "
                "WHERE m.id_especie IS NULL AND v.id_especie IS NOT NULL"
            )
        )
        print(f"\nActualizados: {result.rowcount}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
