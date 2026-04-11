"""Validacion post-migracion: conteos origen vs destino."""
import pyodbc
import sys
from config import SOURCE_CONN, DEST_CONN, MIGRATION_ORDER


def validate():
    src = pyodbc.connect(SOURCE_CONN)
    dst = pyodbc.connect(DEST_CONN)
    src_cur = src.cursor()
    dst_cur = dst.cursor()

    print(f"{'Tabla':<35} {'Origen':>8} {'Destino':>8} {'Estado':>8}")
    print("-" * 65)

    all_ok = True
    total_src = 0
    total_dst = 0

    for table in MIGRATION_ORDER:
        try:
            src_cur.execute(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
                "WHERE TABLE_NAME = ?", table
            )
            if src_cur.fetchone()[0] == 0:
                print(f"{table:<35} {'N/A':>8} {'N/A':>8} {'SKIP':>8}")
                continue

            src_cur.execute(f"SELECT COUNT(*) FROM [{table}]")
            src_count = src_cur.fetchone()[0]
            total_src += src_count

            dst_cur.execute(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
                "WHERE TABLE_NAME = ?", table
            )
            if dst_cur.fetchone()[0] == 0:
                print(f"{table:<35} {src_count:>8} {'N/A':>8} {'MISS':>8}")
                if src_count > 0:
                    all_ok = False
                continue

            dst_cur.execute(f"SELECT COUNT(*) FROM [{table}]")
            dst_count = dst_cur.fetchone()[0]
            total_dst += dst_count

            ok = src_count == dst_count
            status = "OK" if ok else "DIFF"
            if not ok:
                all_ok = False

            print(f"{table:<35} {src_count:>8} {dst_count:>8} {status:>8}")

        except Exception as e:
            print(f"{table:<35} {'ERR':>8} {'ERR':>8} {str(e)[:20]}")
            all_ok = False

    print("-" * 65)
    print(f"{'TOTAL':<35} {total_src:>8} {total_dst:>8}")
    print()

    if all_ok:
        print("VALIDACION EXITOSA - Todos los conteos coinciden")
    else:
        print("VALIDACION CON DIFERENCIAS - Revisar tablas marcadas DIFF/MISS")

    src.close()
    dst.close()
    return all_ok


if __name__ == "__main__":
    ok = validate()
    sys.exit(0 if ok else 1)
