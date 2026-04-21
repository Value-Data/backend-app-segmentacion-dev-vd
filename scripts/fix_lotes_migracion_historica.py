"""Corrige estado de lotes de migración agotados (#I-6).

QA #I-6: "Stock Total 15 con 2 lotes activos y 279 agotados — datos
MIGRACION_EXCEL fantasma en prod".

Los 279 lotes de migración tienen `cantidad_actual=0` pero `estado='plantado'`
(inconsistencia). El estado correcto cuando cantidad=0 es `agotado`.

Fix: UPDATE estado='agotado' para alinear con la semántica. El frontend
ya tiene filtro KPI "activos"/"agotados" — al cambiar el estado, el usuario
puede seleccionar "activos" para ver solo los 2 lotes reales.

Usage:
    python scripts/fix_lotes_migracion_historica.py           # dry-run
    python scripts/fix_lotes_migracion_historica.py --execute # aplica
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
            if i > 0:
                print(f"  BD desperto tras {i} reintento(s)")
            return
        except Exception:
            if i < max_attempts - 1:
                time.sleep(delay)
    raise RuntimeError("BD no respondio")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()

    _wake()
    with engine.begin() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM inventario_vivero")).scalar()
        print(f"Total lotes: {total}")

        # Distribución actual de estados
        print("\nEstados actuales:")
        for r in conn.execute(
            text("SELECT estado, COUNT(*) FROM inventario_vivero GROUP BY estado ORDER BY COUNT(*) DESC")
        ).all():
            print(f"  {r[0]:20s}  {r[1]}")

        # Candidatos: migración con stock=0 y estado plantado
        candidatos = conn.execute(
            text(
                "SELECT COUNT(*) FROM inventario_vivero "
                "WHERE cantidad_actual = 0 "
                "AND observaciones LIKE 'Migración:%' "
                "AND estado = 'plantado'"
            )
        ).scalar()
        print(f"\nA cambiar estado plantado -> agotado: {candidatos}")

        if candidatos == 0:
            print("Nada que corregir.")
            return 0

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar.")
            return 0

        result = conn.execute(
            text(
                "UPDATE inventario_vivero SET estado = 'agotado' "
                "WHERE cantidad_actual = 0 "
                "AND observaciones LIKE 'Migración:%' "
                "AND estado = 'plantado'"
            )
        )
        print(f"\nActualizados: {result.rowcount} lotes con estado='agotado'")

    return 0


if __name__ == "__main__":
    sys.exit(main())
