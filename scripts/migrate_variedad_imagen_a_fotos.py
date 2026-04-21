"""Migra el campo legacy `variedades.imagen` (base64) a la tabla `variedades_fotos`.

Bug QA #14: el tab "Fotos" dice "0" aunque se ve una imagen grande en el detalle
de la variedad. Causa: la imagen viene del campo legacy `variedades.imagen`
(base64 en la tabla variedades) y no de la tabla `variedades_fotos` nueva.

Este script:
  - Busca todas las variedades con `imagen` no vacío.
  - Si la variedad NO tiene aún ninguna VariedadFoto, crea una con `es_principal=True`
    y los bytes del campo legacy decodificados a data binaria.
  - Opcionalmente limpia `variedades.imagen = NULL` después (con --clear-legacy).

Usage:
    python scripts/migrate_variedad_imagen_a_fotos.py              # dry-run
    python scripts/migrate_variedad_imagen_a_fotos.py --execute    # aplica
    python scripts/migrate_variedad_imagen_a_fotos.py --execute --clear-legacy
"""
import argparse
import base64
import os
import sys

_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
os.chdir(_BACKEND_DIR)
sys.path.insert(0, _BACKEND_DIR)
from sqlalchemy import text  # noqa: E402
from app.core.database import engine  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    parser.add_argument(
        "--clear-legacy",
        action="store_true",
        help="After migrating, set variedades.imagen = NULL (safe: VariedadFoto already holds the data).",
    )
    args = parser.parse_args()

    with engine.begin() as conn:
        variedades = conn.execute(
            text(
                "SELECT id_variedad, nombre, imagen FROM variedades "
                "WHERE imagen IS NOT NULL AND LEN(imagen) > 0"
            )
        ).all()
        print(f"Variedades con imagen legacy: {len(variedades)}")

        candidates = []
        for v in variedades:
            existing = conn.execute(
                text("SELECT COUNT(*) FROM variedades_fotos WHERE id_variedad = :id"),
                {"id": v[0]},
            ).scalar()
            if existing == 0:
                candidates.append(v)
            else:
                print(f"  skip id={v[0]} '{v[1]}' — ya tiene {existing} foto(s) en tabla nueva")

        print(f"\nA migrar: {len(candidates)}")
        for v in candidates[:10]:
            size = len(v[2] or "")
            print(f"  id={v[0]:5d}  '{v[1][:40]:40s}'  base64_len={size}")
        if len(candidates) > 10:
            print(f"  ... and {len(candidates) - 10} more")

        if not candidates:
            print("\nNada que migrar.")
            return 0

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar.")
            return 0

        migrated = 0
        failed = []
        for v in candidates:
            id_v, nombre, imagen_b64 = v
            try:
                data_bytes = base64.b64decode(imagen_b64)
            except Exception as e:
                failed.append((id_v, nombre, str(e)))
                continue
            conn.execute(
                text(
                    "INSERT INTO variedades_fotos "
                    "(id_variedad, filename, filepath, content_type, data, "
                    " descripcion, es_principal, fecha_creacion) "
                    "VALUES (:id, :fn, 'db', 'image/jpeg', :data, "
                    " 'Migrado desde campo legacy imagen', 1, GETDATE())"
                ),
                {
                    "id": id_v,
                    "fn": f"legacy_{id_v}.jpg",
                    "data": data_bytes,
                },
            )
            migrated += 1

        print(f"\nMigrados: {migrated}")
        if failed:
            print(f"Fallidos: {len(failed)}")
            for f in failed[:5]:
                print(f"  id={f[0]} '{f[1]}'  error={f[2]}")

        if args.clear_legacy:
            ids = [c[0] for c in candidates[:migrated]]
            if ids:
                placeholders = ",".join(f":id{i}" for i in range(len(ids)))
                params = {f"id{i}": v for i, v in enumerate(ids)}
                conn.execute(
                    text(f"UPDATE variedades SET imagen = NULL WHERE id_variedad IN ({placeholders})"),
                    params,
                )
                print(f"Limpiado variedades.imagen en {len(ids)} filas.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
