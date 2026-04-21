"""Corrige meses fenológicos de Cerezo usando datos reales del MAESTRO CEREZAS.xlsx.

Datos observados en data/MAESTRO CEREZAS.xlsx (14157 evaluaciones de Garces):
  Aplicación dormex:   100% Julio
  Aplicación Erger:    100% Julio
  Inicio floración:    95% Agosto  |  5% Septiembre
  Plena floración:     49% Agosto  |  51% Septiembre
  Cosecha:             18% Oct     |  71% Nov     |  9% Dic     |  1% Feb

Los estados en BD de Cerezo (nomenclatura Fleckinger A-J + CER_COSECHA):
  1 A          Yema dormante      → BD dice Abr  → mantener (post-cosecha)
  2 B          Yema hinchada      → BD dice May  → Jul (dormex=Jul)
  3 C          Punta verde        → BD dice Jun  → Jul-Ago
  4 D          Botón blanco       → BD dice Jul  → Ago
  5 E          Floración          → BD dice Ago  → Ago-Sep
  6 F          Caída pétalos      → BD dice Sep  → Sep (ok)
  7 G          Cuaja              → BD dice Sep  → Sep-Oct
  8 H          Crecimiento fruto  → BD dice Oct  → Oct (ok)
  9 I          Envero             → BD dice Oct-Nov → Nov
 10 J          Madurez            → BD dice Nov  → Nov (ok)
 11 CER_COSECHA Cosecha           → BD dice Dic-Ene → Oct-Dic (real: Nov 71%)

Match por (id_especie=Cerezo, orden) para evitar depender del código.

Usage:
    python scripts/fix_fenologia_cerezo_maestro.py              # dry-run
    python scripts/fix_fenologia_cerezo_maestro.py --execute    # aplica
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
    f"DRIVER={{{_s.DB_DRIVER}}};"
    f"SERVER={_s.DB_SERVER};"
    f"DATABASE={_s.DB_NAME};"
    f"UID={_s.DB_USER};"
    f"PWD={_s.DB_PASSWORD};"
    "Encrypt=yes;TrustServerCertificate=no;"
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
                print(f"  Intento {i+1}/{max_attempts}: BD dormida. Esperando {delay}s...")
                time.sleep(delay)
    raise RuntimeError("BD no respondio")


# Mes orientativo esperado para Cerezo, match por orden (1..11)
# Formato: (mes_orientativo, mes_inicio, mes_fin)
CEREZO_MESES = {
    1:  ("Abr-Jun",  4,  6),    # Yema dormante (post-cosecha)
    2:  ("Jul",      7,  7),    # Yema hinchada (dormex Jul 100%)
    3:  ("Jul-Ago",  7,  8),    # Punta verde
    4:  ("Ago",      8,  8),    # Boton blanco
    5:  ("Ago-Sep",  8,  9),    # Floracion (ini 95% Ago; plena 49/51 Ago/Sep)
    6:  ("Sep",      9,  9),    # Caida petalos
    7:  ("Sep-Oct",  9, 10),    # Cuaja
    8:  ("Oct",     10, 10),    # Crecimiento fruto
    9:  ("Nov",     11, 11),    # Envero
    10: ("Nov",     11, 11),    # Madurez (cosecha 71% Nov)
    11: ("Oct-Dic", 10, 12),    # Cosecha (18% Oct, 71% Nov, 9% Dic)
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()

    _wake()
    with engine.begin() as conn:
        # Encontrar id_especie Cerezo (solo la principal, activo=1)
        row = conn.execute(
            text("SELECT TOP 1 id_especie FROM especies WHERE nombre = 'Cerezo' AND activo = 1 ORDER BY id_especie")
        ).first()
        if not row:
            print("ERROR: no existe especie 'Cerezo' activa en BD.")
            return 1
        id_especie = row[0]
        print(f"Especie Cerezo encontrada: id_especie={id_especie}")

        estados = conn.execute(
            text(
                "SELECT id_estado, codigo, nombre, orden, mes_orientativo, mes_inicio, mes_fin "
                "FROM estados_fenologicos WHERE id_especie = :e AND activo = 1 ORDER BY orden"
            ),
            {"e": id_especie},
        ).all()
        print(f"Estados actuales: {len(estados)}")

        cambios = []
        for id_est, cod, nom, orden, mes_orig, mes_ini, mes_fin in estados:
            if orden not in CEREZO_MESES:
                continue
            new_mes, new_ini, new_fin = CEREZO_MESES[orden]
            if (mes_orig, mes_ini, mes_fin) == (new_mes, new_ini, new_fin):
                continue
            cambios.append((id_est, orden, cod, nom, mes_orig, new_mes, (mes_ini, mes_fin), (new_ini, new_fin)))

        print(f"\nCambios propuestos: {len(cambios)}")
        print(f"{'Orden':>5}  {'Código':15s}  {'Nombre':25s}  {'Antes':12s}  ->  {'Nuevo':12s}")
        print("-" * 90)
        for id_est, orden, cod, nom, old_mes, new_mes, old_range, new_range in cambios:
            print(f"{orden:>5}  {cod:15s}  {(nom or '')[:25]:25s}  "
                  f"{str(old_mes)[:12]:12s}  ->  {new_mes:12s}  "
                  f"range {old_range} -> {new_range}")

        if not cambios:
            print("\nNada que actualizar.")
            return 0

        if not args.execute:
            print("\nDRY-RUN. Pasa --execute para aplicar.")
            return 0

        for id_est, orden, _, _, _, new_mes, _, (new_ini, new_fin) in cambios:
            conn.execute(
                text(
                    "UPDATE estados_fenologicos "
                    "SET mes_orientativo = :mes, mes_inicio = :ini, mes_fin = :fin "
                    "WHERE id_estado = :id"
                ),
                {"mes": new_mes, "ini": new_ini, "fin": new_fin, "id": id_est},
            )
        print(f"\nListo: {len(cambios)} registros actualizados.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
