"""DELETE quirúrgico de registros heredados de ValueData en audit_log.

Context: la BD adinf fue migrada desde valuedata. La tabla audit_log
contiene 159 registros con acciones del sistema anterior (cumplimiento
de contratistas/proveedores) que no existen en el código de Garces Fruit.

Este script identifica y elimina esos registros contaminados, dejando
audit_log listo para que el nuevo sistema empiece a loguear de cero.

SAFETY:
- Hace dry-run por defecto (solo cuenta).
- Para ejecutar el DELETE, pasar --execute.
- Muestra la lista de acciones afectadas antes de borrar.

Usage:
    python scripts/clean_audit_log_legacy.py              # dry-run
    python scripts/clean_audit_log_legacy.py --execute    # delete
"""
import argparse
import os
import sys

# Switch cwd to backend/ so pydantic-settings finds backend/.env
_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
os.chdir(_BACKEND_DIR)
sys.path.insert(0, _BACKEND_DIR)
from app.core.database import engine  # noqa: E402
from sqlalchemy import text  # noqa: E402

# Actions known to come from the ValueData legacy system
LEGACY_ACTIONS = [
    "APROBAR_PROVEEDOR",
    "RECHAZAR_PROVEEDOR",
    "REGISTRAR_PROVEEDOR",
    "BAJA_PROVEEDOR",
    "BLOQUEAR_PROVEEDOR",
    "DESBLOQUEAR_PROVEEDOR",
    "APROBAR_CONTRATISTA",
    "RECHAZAR_CONTRATISTA",
    "REGISTRAR_CONTRATISTA",
    "UPLOAD_SECCION",
    "EJECUTAR_SCORING",
    "OVERRIDE_SCORING",
    "RECHAZO_SII",
    "CARGAR_DB",
]

# Also: anything with contratista_rut set is legacy
# (Garces Fruit has no concept of contratista_rut)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually perform DELETE (default is dry-run).",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Truncate entire audit_log instead of selective delete.",
    )
    args = parser.parse_args()

    with engine.begin() as conn:
        # Show current state
        total = conn.execute(text("SELECT COUNT(*) FROM audit_log")).scalar()
        print(f"Total rows in audit_log: {total}")

        if total == 0:
            print("Table is empty. Nothing to do.")
            return 0

        # Breakdown by action
        print("\nBreakdown by accion:")
        rows = conn.execute(
            text("SELECT accion, COUNT(*) c FROM audit_log GROUP BY accion ORDER BY c DESC")
        ).all()
        for r in rows:
            marker = " [LEGACY]" if r[0] in LEGACY_ACTIONS else ""
            print(f"  {r[0]:30s} {r[1]:6d}{marker}")

        # Count of contratista_rut not null (legacy indicator)
        contratista_count = conn.execute(
            text("SELECT COUNT(*) FROM audit_log WHERE contratista_rut IS NOT NULL")
        ).scalar()
        print(f"\nRows with contratista_rut set (legacy indicator): {contratista_count}")

        if args.truncate:
            print("\n>>> MODE: TRUNCATE (all rows)")
            if args.execute:
                conn.execute(text("DELETE FROM audit_log"))
                print("DELETED all rows.")
            else:
                print("DRY-RUN: would DELETE all rows. Pass --execute to apply.")
        else:
            # Selective: legacy actions OR contratista_rut set
            placeholders = ",".join(f":a{i}" for i in range(len(LEGACY_ACTIONS)))
            params = {f"a{i}": a for i, a in enumerate(LEGACY_ACTIONS)}
            where = f"accion IN ({placeholders}) OR contratista_rut IS NOT NULL"

            to_delete = conn.execute(
                text(f"SELECT COUNT(*) FROM audit_log WHERE {where}"), params
            ).scalar()
            print(f"\n>>> MODE: SELECTIVE DELETE")
            print(f"Rows matching legacy criteria: {to_delete}")

            if args.execute:
                conn.execute(text(f"DELETE FROM audit_log WHERE {where}"), params)
                print(f"DELETED {to_delete} legacy rows.")
            else:
                print("DRY-RUN: pass --execute to apply the DELETE.")

        # Final state
        remaining = conn.execute(text("SELECT COUNT(*) FROM audit_log")).scalar()
        print(f"\nRows remaining: {remaining}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
