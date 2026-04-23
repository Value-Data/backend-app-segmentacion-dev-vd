"""Backfill de `usuario_creacion` NULL en tablas de mantenedores.

Bug QA MT-1 residual: ~80% de las filas de mantenedores tienen
`usuario_creacion = NULL` porque fueron insertadas por scripts de seed
antiguos (scripts/load_data.py, import_maestro_carozos.py, seed de la
app anterior) sin pasar el usuario.

No hay forma de recuperar el usuario real post-hoc, así que las marcamos
como `'legacy-import'` para:
  - distinguirlas de filas creadas por el sistema nuevo
  - cerrar el "80% null" reportado por QA
  - dar coherencia al dashboard de auditoría

También pobla `fecha_creacion` con `SYSUTCDATETIME()` si está NULL
(algunas filas legacy también perdieron la fecha).

Usage:
    python scripts/backfill_usuario_creacion.py              # dry-run
    python scripts/backfill_usuario_creacion.py --execute    # aplica
"""
import argparse
import os
import sys

_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
os.chdir(_BACKEND_DIR)
sys.path.insert(0, _BACKEND_DIR)

from sqlalchemy import text  # noqa: E402
from app.core.database import engine  # noqa: E402


# Tablas que tienen la columna `usuario_creacion` en modelo o vía ALTER
# idempotente en lifespan() (Pase 2). El script verifica en runtime que
# la columna exista antes de tocar la tabla — así no falla en entornos
# donde la columna aún no se migró.
TABLES = [
    "paises", "regiones", "comunas", "campos", "cuarteles",
    "especies", "portainjertos", "pmg", "origenes", "viveros",
    "colores", "susceptibilidades", "tipos_labor", "estados_planta",
    "estados_fenologicos", "temporadas", "bodegas", "catalogos",
    "centros_costo", "marcos_plantacion", "variedades",
    "variedades_polinizantes",
]

LEGACY_MARKER = "legacy-import"


def _has_column(conn, table: str, col: str) -> bool:
    """Check if `col` exists on `table` (SQL Server)."""
    result = conn.execute(
        text("SELECT COL_LENGTH(:t, :c)"),
        {"t": table, "c": col},
    ).scalar()
    return result is not None


def preview(conn) -> dict:
    summary = {}
    for tbl in TABLES:
        if not _has_column(conn, tbl, "usuario_creacion"):
            summary[tbl] = {"skip": "no column", "null_count": None}
            continue
        null_count = conn.execute(
            text(f"SELECT COUNT(1) FROM {tbl} WHERE usuario_creacion IS NULL")
        ).scalar()
        fecha_null = 0
        if _has_column(conn, tbl, "fecha_creacion"):
            fecha_null = conn.execute(
                text(f"SELECT COUNT(1) FROM {tbl} WHERE fecha_creacion IS NULL")
            ).scalar()
        summary[tbl] = {"null_count": null_count, "fecha_null": fecha_null}
    return summary


def execute(conn) -> dict:
    totals = {}
    for tbl in TABLES:
        if not _has_column(conn, tbl, "usuario_creacion"):
            totals[tbl] = "skipped (no column)"
            continue

        # usuario_creacion
        res = conn.execute(
            text(
                f"UPDATE {tbl} SET usuario_creacion = :marker "
                "WHERE usuario_creacion IS NULL"
            ),
            {"marker": LEGACY_MARKER},
        )
        usu_rows = res.rowcount or 0

        # fecha_creacion (if missing)
        fecha_rows = 0
        if _has_column(conn, tbl, "fecha_creacion"):
            res = conn.execute(
                text(
                    f"UPDATE {tbl} SET fecha_creacion = SYSUTCDATETIME() "
                    "WHERE fecha_creacion IS NULL"
                )
            )
            fecha_rows = res.rowcount or 0

        totals[tbl] = {"usuario_creacion": usu_rows, "fecha_creacion": fecha_rows}
    return totals


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()

    with engine.begin() as conn:
        p = preview(conn)
        print("\n" + "=" * 60)
        print("BACKFILL usuario_creacion / fecha_creacion — PREVIEW")
        print("=" * 60)
        total_usu = 0
        total_fecha = 0
        for tbl, info in p.items():
            if "skip" in info:
                print(f"  {tbl:30s} [skip: {info['skip']}]")
                continue
            u = info["null_count"] or 0
            f = info["fecha_null"] or 0
            total_usu += u
            total_fecha += f
            marker = " *" if u or f else "  "
            print(f"  {marker}{tbl:28s} usuario_null={u:>6}  fecha_null={f:>6}")
        print("=" * 60)
        print(f"  TOTAL usuario_creacion NULL: {total_usu}")
        print(f"  TOTAL fecha_creacion   NULL: {total_fecha}")

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar.")
            return 0

        print(f"\nMarcando usuario_creacion NULL → '{LEGACY_MARKER}' y "
              f"fecha NULL → SYSUTCDATETIME()...")
        totals = execute(conn)
        for tbl, t in totals.items():
            if isinstance(t, str):
                print(f"  {tbl}: {t}")
            else:
                print(f"  {tbl:30s} usuario={t['usuario_creacion']:>6}  "
                      f"fecha={t['fecha_creacion']:>6}")
        print("\nListo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
