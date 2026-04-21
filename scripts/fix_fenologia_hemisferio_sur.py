"""Corrige meses de estados_fenologicos al hemisferio sur (Chile).

Bug QA #5: el ciclo fenológico cargado en BD corresponde a hemisferio norte
(Cerezo floración = Ago en Chile, NO Abr/May). El SEED del backend ya tiene
valores correctos (Sep-Nov para Cerezo Plena Flor) pero el endpoint de seed
no sobreescribe mes_orientativo si ya existe un valor.

Este script sincroniza forzosamente los `mes_orientativo` en la BD con los
valores del SEED_ESTADOS_FENOLOGICOS del backend (backend/app/routes/labores.py).

Match por `codigo` (ej. CER_FLOR_PLENA) dentro de cada especie.

Usage:
    python scripts/fix_fenologia_hemisferio_sur.py              # dry-run
    python scripts/fix_fenologia_hemisferio_sur.py --execute    # apply
"""
import argparse
import os
import sys

_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
os.chdir(_BACKEND_DIR)
sys.path.insert(0, _BACKEND_DIR)
from sqlalchemy import text  # noqa: E402
from app.core.database import engine  # noqa: E402
from app.routes.labores import SEED_ESTADOS_FENOLOGICOS, _parse_mes_range  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()

    with engine.begin() as conn:
        species = conn.execute(
            text("SELECT id_especie, nombre FROM especies")
        ).all()
        species_by_name = {row[1]: row[0] for row in species}

        changes = []
        not_found_species = []
        not_found_codigo = []

        for especie_nombre, estados in SEED_ESTADOS_FENOLOGICOS.items():
            sp_id = species_by_name.get(especie_nombre)
            if not sp_id:
                not_found_species.append(especie_nombre)
                continue

            for seed_item in estados:
                codigo = seed_item["codigo"]
                new_mes = seed_item.get("mes_orientativo")
                new_ini, new_fin = _parse_mes_range(new_mes)

                row = conn.execute(
                    text(
                        "SELECT id_estado, mes_orientativo, mes_inicio, mes_fin "
                        "FROM estados_fenologicos "
                        "WHERE id_especie = :sp AND codigo = :c"
                    ),
                    {"sp": sp_id, "c": codigo},
                ).first()

                if not row:
                    not_found_codigo.append(f"{especie_nombre}/{codigo}")
                    continue

                id_estado, old_mes, old_ini, old_fin = row
                if (old_mes, old_ini, old_fin) == (new_mes, new_ini, new_fin):
                    continue

                changes.append(
                    {
                        "id_estado": id_estado,
                        "especie": especie_nombre,
                        "codigo": codigo,
                        "old_mes": old_mes,
                        "new_mes": new_mes,
                        "old_range": (old_ini, old_fin),
                        "new_range": (new_ini, new_fin),
                    }
                )

        print(f"Especies sin datos en BD: {not_found_species or 'ninguna'}")
        print(f"Códigos sin registro en BD: {len(not_found_codigo)}")
        if not_found_codigo[:5]:
            for c in not_found_codigo[:5]:
                print(f"  - {c}")

        print(f"\nCambios propuestos: {len(changes)}")
        for c in changes[:30]:
            print(
                f"  [{c['especie']:10s}] {c['codigo']:20s} "
                f"'{c['old_mes']}' -> '{c['new_mes']}'  "
                f"range {c['old_range']} -> {c['new_range']}"
            )
        if len(changes) > 30:
            print(f"  ... and {len(changes) - 30} more")

        if not changes:
            print("\nNo hay cambios que aplicar.")
            return 0

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar.")
            return 0

        print("\nAplicando cambios...")
        for c in changes:
            conn.execute(
                text(
                    "UPDATE estados_fenologicos "
                    "SET mes_orientativo = :mes, mes_inicio = :ini, mes_fin = :fin "
                    "WHERE id_estado = :id"
                ),
                {
                    "mes": c["new_mes"],
                    "ini": c["new_range"][0],
                    "fin": c["new_range"][1],
                    "id": c["id_estado"],
                },
            )
        print(f"Listo: {len(changes)} registros actualizados.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
