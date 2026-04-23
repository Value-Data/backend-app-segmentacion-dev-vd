"""Corrige el orden de países para que Chile (país base del cliente) sea orden=0.

Bug QA #PS-2: Chile estaba en orden=1. Los usuarios ven primero Alemania/Argentina
porque el mantenedor se ordena ASC por `orden`. Chile debe salir primero.

También aplica tildes (Perú, España, Sudáfrica, Japón, México) que el seed
originalmente cargó sin caracteres no-ASCII (bug QA #PS-1 / tildes).

Usage:
    python scripts/fix_paises_chile_orden.py              # dry-run
    python scripts/fix_paises_chile_orden.py --execute    # apply
"""
import argparse
import os
import sys

_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
os.chdir(_BACKEND_DIR)
sys.path.insert(0, _BACKEND_DIR)
from sqlalchemy import text  # noqa: E402
from app.core.database import engine  # noqa: E402


# Debe reflejar el PAISES canónico en backend/app/routes/seed_geo.py (CL=0).
CANONICAL = {
    "CL": ("Chile", 0),
    "AR": ("Argentina", 1),
    "BR": ("Brasil", 2),
    "PE": ("Perú", 3),
    "US": ("Estados Unidos", 4),
    "ES": ("España", 5),
    "AU": ("Australia", 6),
    "NZ": ("Nueva Zelanda", 7),
    "ZA": ("Sudáfrica", 8),
    "IT": ("Italia", 9),
    "FR": ("Francia", 10),
    "CN": ("China", 11),
    "JP": ("Japón", 12),
    "MX": ("México", 13),
    "CO": ("Colombia", 14),
    "UY": ("Uruguay", 15),
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()

    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT id_pais, codigo, nombre, orden FROM paises WHERE activo = 1")
        ).all()

        changes = []
        for id_pais, codigo, nombre, orden in rows:
            canon = CANONICAL.get(codigo)
            if not canon:
                continue
            nuevo_nombre, nuevo_orden = canon
            if nombre != nuevo_nombre or orden != nuevo_orden:
                changes.append({
                    "id_pais": id_pais,
                    "codigo": codigo,
                    "old": (nombre, orden),
                    "new": (nuevo_nombre, nuevo_orden),
                })

        print(f"Cambios propuestos: {len(changes)}")
        for c in changes:
            print(
                f"  {c['codigo']:2s}  '{c['old'][0]}' (orden {c['old'][1]})  "
                f"->  '{c['new'][0]}' (orden {c['new'][1]})"
            )

        if not changes:
            print("Todos los países ya coinciden con el canónico.")
            return 0

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar.")
            return 0

        for c in changes:
            conn.execute(
                text(
                    "UPDATE paises SET nombre = :n, orden = :o, "
                    "fecha_modificacion = SYSUTCDATETIME(), "
                    "usuario_modificacion = 'script/fix_paises_chile_orden' "
                    "WHERE id_pais = :id"
                ),
                {"n": c["new"][0], "o": c["new"][1], "id": c["id_pais"]},
            )
        print(f"Listo: {len(changes)} países actualizados.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
