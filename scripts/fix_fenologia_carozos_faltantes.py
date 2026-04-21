"""Crea pautas fenológicas para Damasco, Paraguayo y Platerina (F-2).

QA F-2: "3 Carozos oficiales sin pauta fenológica configurada". Los
estados se basan en el seed Carozo genérico del backend (14 etapas),
adaptados con código por especie.

Fuente: backend/app/routes/labores.py → SEED_ESTADOS_FENOLOGICOS["Carozo"]
Meses: ya ajustados al hemisferio sur en el seed del backend.

Usage:
    python scripts/fix_fenologia_carozos_faltantes.py              # dry-run
    python scripts/fix_fenologia_carozos_faltantes.py --execute    # aplica
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
from app.routes.labores import SEED_ESTADOS_FENOLOGICOS, _parse_mes_range  # noqa: E402

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


# Use Carozo generic seed as template; derive codigo prefix from species name
ESPECIES_TARGET = [
    ("Damasco", "DAM"),
    ("Paraguayo", "PRG"),
    ("Platerina", "PLA"),
]

BASE_SEED = SEED_ESTADOS_FENOLOGICOS["Carozo"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()

    _wake()
    with engine.begin() as conn:
        to_insert = []
        for nombre, code_prefix in ESPECIES_TARGET:
            row = conn.execute(
                text("SELECT TOP 1 id_especie FROM especies WHERE nombre = :n AND activo = 1"),
                {"n": nombre},
            ).first()
            if not row:
                print(f"  SKIP {nombre}: especie no existe o inactiva")
                continue
            id_especie = row[0]

            existing = conn.execute(
                text("SELECT COUNT(*) FROM estados_fenologicos WHERE id_especie = :e AND activo = 1"),
                {"e": id_especie},
            ).scalar()
            if existing > 0:
                print(f"  SKIP {nombre}: ya tiene {existing} estados configurados")
                continue

            print(f"  {nombre} (id={id_especie}): {len(BASE_SEED)} estados a crear")
            for seed_item in BASE_SEED:
                # Reemplazar CAR_ por el prefijo especifico
                codigo = seed_item["codigo"].replace("CAR_", f"{code_prefix}_")
                mes = seed_item.get("mes_orientativo")
                mi, mf = _parse_mes_range(mes)
                to_insert.append({
                    "id_especie": id_especie,
                    "codigo": codigo,
                    "nombre": seed_item["nombre"],
                    "orden": seed_item["orden"],
                    "mes_orientativo": mes,
                    "mes_inicio": mi,
                    "mes_fin": mf,
                    "color_hex": seed_item.get("color_hex"),
                    "activo": True,
                })

        print(f"\nTotal estados a crear: {len(to_insert)}")

        if not to_insert:
            print("Nada que crear.")
            return 0

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar.")
            return 0

        for item in to_insert:
            conn.execute(
                text(
                    "INSERT INTO estados_fenologicos "
                    "(id_especie, codigo, nombre, orden, mes_orientativo, "
                    "mes_inicio, mes_fin, color_hex, activo) "
                    "VALUES (:id_especie, :codigo, :nombre, :orden, :mes_orientativo, "
                    ":mes_inicio, :mes_fin, :color_hex, :activo)"
                ),
                item,
            )
        print(f"Insertados: {len(to_insert)} estados fenológicos.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
