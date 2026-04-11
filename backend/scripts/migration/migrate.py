"""Orquestador de migracion SQL Server Azure -> SQL Server Azure (adinf).

Uso:
    export DB_SOURCE_USER="..."
    export DB_SOURCE_PASS="..."
    export DB_DEST_PASS="..."
    python migrate.py
"""
import pyodbc
import sys
import time
from config import SOURCE_CONN, DEST_CONN, BATCH_SIZE, MIGRATION_ORDER, TABLE_PK


def get_columns(cursor, table_name):
    """Obtiene lista de columnas de una tabla (sin duplicados)."""
    cursor.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
        table_name,
    )
    seen = set()
    cols = []
    for row in cursor.fetchall():
        if row.COLUMN_NAME not in seen:
            cols.append(row.COLUMN_NAME)
            seen.add(row.COLUMN_NAME)
    return cols


def table_exists(cursor, table_name):
    """Verifica si una tabla existe en el destino."""
    cursor.execute(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
        "WHERE TABLE_NAME = ? AND TABLE_TYPE = 'BASE TABLE'",
        table_name,
    )
    return cursor.fetchone()[0] > 0


def has_identity(cursor, table_name):
    """Verifica si la tabla tiene columna IDENTITY."""
    cursor.execute(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_NAME = ? AND COLUMNPROPERTY("
        "OBJECT_ID(TABLE_SCHEMA + '.' + TABLE_NAME), "
        "COLUMN_NAME, 'IsIdentity') = 1",
        table_name,
    )
    return cursor.fetchone()[0] > 0


def migrate_table(src_conn, dst_conn, table):
    """Migra una tabla completa con IDENTITY_INSERT."""
    src_cur = src_conn.cursor()
    dst_cur = dst_conn.cursor()

    # Verificar que la tabla existe en origen
    if not table_exists(src_cur, table):
        print(f"  [{table}] NO EXISTE en origen - saltando")
        return -1

    # Verificar que la tabla existe en destino
    if not table_exists(dst_cur, table):
        print(f"  [{table}] NO EXISTE en destino - saltando")
        return -1

    # Obtener columnas del origen y destino
    src_columns = get_columns(src_cur, table)
    dst_columns = get_columns(dst_cur, table)

    # Usar solo columnas que existen en ambos lados
    common_columns = [c for c in src_columns if c in dst_columns]
    if not common_columns:
        print(f"  [{table}] Sin columnas en comun - saltando")
        return -1

    col_list = ", ".join(f"[{c}]" for c in common_columns)
    placeholders = ", ".join("?" for _ in common_columns)

    # Contar registros en origen
    src_cur.execute(f"SELECT COUNT(*) FROM [{table}]")
    total = src_cur.fetchone()[0]

    if total == 0:
        print(f"  [{table}] 0 registros - saltando")
        return 0

    # Verificar si destino ya tiene datos
    dst_cur.execute(f"SELECT COUNT(*) FROM [{table}]")
    dst_count = dst_cur.fetchone()[0]
    if dst_count > 0:
        print(f"  [{table}] destino ya tiene {dst_count} registros - saltando")
        return -2

    # Activar IDENTITY_INSERT si la tabla tiene identity
    identity = has_identity(dst_cur, table)
    if identity:
        dst_cur.execute(f"SET IDENTITY_INSERT [{table}] ON")

    try:
        # Leer y escribir en batches
        src_cur.execute(f"SELECT {col_list} FROM [{table}]")
        migrated = 0
        batch = []

        for row in src_cur:
            batch.append(tuple(row))
            if len(batch) >= BATCH_SIZE:
                dst_cur.executemany(
                    f"INSERT INTO [{table}] ({col_list}) VALUES ({placeholders})",
                    batch,
                )
                migrated += len(batch)
                batch = []
                print(f"  [{table}] {migrated}/{total}...", end="\r")

        # Ultimo batch
        if batch:
            dst_cur.executemany(
                f"INSERT INTO [{table}] ({col_list}) VALUES ({placeholders})",
                batch,
            )
            migrated += len(batch)

        dst_conn.commit()
        print(f"  [{table}] {migrated}/{total} OK              ")
        return migrated
    finally:
        # SIEMPRE desactivar IDENTITY_INSERT para no bloquear otras tablas
        if identity:
            try:
                dst_cur.execute(f"SET IDENTITY_INSERT [{table}] OFF")
                dst_conn.commit()
            except:
                pass


def reseed_identity(dst_conn):
    """Reseed IDENTITY en todas las tablas del destino."""
    print("\nReseeding IDENTITY columns...")
    cur = dst_conn.cursor()
    for table, pk in TABLE_PK.items():
        try:
            if not table_exists(cur, table):
                continue
            if not has_identity(cur, table):
                continue
            cur.execute(f"SELECT ISNULL(MAX([{pk}]), 0) FROM [{table}]")
            max_id = cur.fetchone()[0]
            if max_id > 0:
                cur.execute(f"DBCC CHECKIDENT('{table}', RESEED, {max_id})")
                dst_conn.commit()
        except Exception as e:
            print(f"  [RESEED WARNING] {table}: {e}")
    print("  Reseed completado.")


def main():
    print("=" * 60)
    print("MIGRACION SQL Server Azure -> SQL Server Azure (adinf)")
    print("Garces Fruit - Segmentacion Nuevas Especies")
    print("=" * 60)

    # Validar variables de entorno
    import os
    missing = []
    for var in ["DB_SOURCE_USER", "DB_SOURCE_PASS", "DB_DEST_PASS"]:
        if not os.environ.get(var):
            missing.append(var)
    if missing:
        print(f"\nERROR: Variables de entorno faltantes: {', '.join(missing)}")
        print("Configuralas antes de ejecutar:")
        for v in missing:
            print(f'  export {v}="..."')
        sys.exit(1)

    # Conectar
    print("\nConectando a origen (valuedata)...", end=" ")
    try:
        src = pyodbc.connect(SOURCE_CONN)
        print("OK")
    except Exception as e:
        print(f"FALLO\n  {e}")
        sys.exit(1)

    print("Conectando a destino (adinf)...", end=" ")
    try:
        dst = pyodbc.connect(DEST_CONN)
        dst.autocommit = False
        print("OK")
    except Exception as e:
        print(f"FALLO\n  {e}")
        sys.exit(1)

    # Migrar
    print(f"\nMigrando {len(MIGRATION_ORDER)} tablas...\n")
    results = {}
    errors = []
    skipped = []
    t0 = time.time()

    for table in MIGRATION_ORDER:
        try:
            count = migrate_table(src, dst, table)
            if count == -1:
                skipped.append(table)
            elif count == -2:
                skipped.append(f"{table} (ya tiene datos)")
            else:
                results[table] = count
        except Exception as e:
            msg = str(e).split("\n")[0]
            print(f"  [ERROR] {table}: {msg}")
            errors.append((table, msg))
            try:
                dst.rollback()
            except:
                pass

    elapsed = time.time() - t0

    # Reseed IDENTITY
    if results:
        reseed_identity(dst)

    # Resumen
    print("\n" + "=" * 60)
    print("RESUMEN DE MIGRACION")
    print("=" * 60)
    total_rows = sum(results.values())
    print(f"Tablas migradas:  {len(results)}/{len(MIGRATION_ORDER)}")
    print(f"Tablas saltadas:  {len(skipped)}")
    print(f"Total registros:  {total_rows:,}")
    print(f"Tiempo:           {elapsed:.1f}s")

    if skipped:
        print(f"\nSALTADAS ({len(skipped)}):")
        for s in skipped:
            print(f"  - {s}")

    if errors:
        print(f"\nERRORES ({len(errors)}):")
        for t, e in errors:
            print(f"  - {t}: {e}")

    src.close()
    dst.close()

    if errors:
        print("\nMigracion completada CON ERRORES.")
        sys.exit(1)
    else:
        print("\nMigracion completada exitosamente.")


if __name__ == "__main__":
    main()
