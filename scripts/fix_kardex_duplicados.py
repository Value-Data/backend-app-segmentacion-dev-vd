"""Elimina movimientos duplicados en movimientos_inventario (#I-28, #I-29).

QA:
  #I-28: Kardex muestra saltos de saldo raros.
  #I-29: Misma posición H12-P06 aparece duplicada en historial.

Causa: la migración inicial (CARGA_INICIAL) se ejecutó 3 veces.
Resultado: 279 grupos × 3 réplicas = 837 movimientos, de los cuales
558 son duplicados reales a borrar (manteniendo el más antiguo de
cada grupo).

Los saldos en BD son correctos (verificado: 0 inconsistencias en la
aritmética saldo_nuevo = saldo_anterior ± cantidad). La inconsistencia
visual del Kardex viene de ver 3 filas idénticas.

Match para duplicados:
  (id_inventario, id_planta, tipo, cantidad, fecha_movimiento::date, referencia_destino)

Se preserva el movimiento con menor id_movimiento (más antiguo).

Usage:
    python scripts/fix_kardex_duplicados.py             # dry-run
    python scripts/fix_kardex_duplicados.py --execute   # aplica
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


# CTE + DELETE works in SQL Server
DUP_CTE = """
WITH dups AS (
  SELECT id_movimiento,
         ROW_NUMBER() OVER (
           PARTITION BY id_inventario, ISNULL(id_planta, 0), tipo, cantidad,
                        CAST(fecha_movimiento AS DATE), ISNULL(referencia_destino, '')
           ORDER BY id_movimiento
         ) as rn
  FROM movimientos_inventario
)
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()

    _wake()
    with engine.begin() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM movimientos_inventario")).scalar()
        to_delete = conn.execute(
            text(DUP_CTE + "SELECT COUNT(*) FROM dups WHERE rn > 1")
        ).scalar()

        print(f"Total movimientos: {total}")
        print(f"A eliminar (duplicados, preservando el de menor id_movimiento): {to_delete}")
        print(f"Quedarían: {total - to_delete}")

        if to_delete == 0:
            print("Nada que limpiar.")
            return 0

        # Breakdown por tipo
        print("\nPor tipo de movimiento (duplicados):")
        rows = conn.execute(
            text(
                DUP_CTE
                + "SELECT mi.tipo, COUNT(*) FROM movimientos_inventario mi "
                "INNER JOIN dups d ON d.id_movimiento = mi.id_movimiento "
                "WHERE d.rn > 1 GROUP BY mi.tipo ORDER BY COUNT(*) DESC"
            )
        ).all()
        for r in rows:
            print(f"  {r[0]:20s}  {r[1]}")

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar.")
            return 0

        result = conn.execute(
            text(
                DUP_CTE
                + "DELETE FROM movimientos_inventario "
                "WHERE id_movimiento IN (SELECT id_movimiento FROM dups WHERE rn > 1)"
            )
        )
        print(f"\nEliminados: {result.rowcount} movimientos duplicados")

    return 0


if __name__ == "__main__":
    sys.exit(main())
