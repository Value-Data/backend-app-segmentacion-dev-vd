"""Script para identificar y fusionar PMGs duplicados.

Duplicados conocidos (reportados por usuario):
- Cerasina / Peter Stoppel (y variantes al reves)
- Zaiger (multiples variantes: Zaiger 1, Zaiger Genetics, etc.)
- Bradford (multiples variantes: Bradford 1, Bradford 2, etc.)

Uso:
    # Modo dry-run (solo muestra lo que haria)
    python scripts/cleanup_pmg.py --dry-run

    # Ejecutar las fusiones
    python scripts/cleanup_pmg.py --execute

    # Listar PMGs actuales
    python scripts/cleanup_pmg.py --list
"""

import sys
import os

# Add parent to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import engine
from app.models.maestras import Pmg
from app.models.variedades import Variedad
from app.models.inventario import InventarioVivero
from app.models.maestras import PmgEspecie
from app.models.testblock import Planta


def get_db():
    with Session(engine) as db:
        yield db


def list_pmgs():
    """List all PMGs with their variedad count."""
    with Session(engine) as db:
        pmgs = db.query(Pmg).order_by(Pmg.nombre).all()
        print(f"\n{'ID':>4} | {'Codigo':<15} | {'Nombre':<50} | {'Activo':<6} | Variedades")
        print("-" * 100)
        for p in pmgs:
            var_count = db.query(Variedad).filter(Variedad.id_pmg == p.id_pmg).count()
            print(f"{p.id_pmg:>4} | {p.codigo or '-':<15} | {p.nombre or '-':<50} | {'Si' if p.activo else 'No':<6} | {var_count}")
        print(f"\nTotal: {len(pmgs)} PMGs")


def find_duplicates():
    """Identify potential duplicate PMGs by name similarity."""
    with Session(engine) as db:
        pmgs = db.query(Pmg).filter(Pmg.activo == True).order_by(Pmg.nombre).all()

        # Group by normalized name
        groups = {}
        for p in pmgs:
            name = (p.nombre or "").lower().strip()
            # Normalize: remove extra spaces, sort words for comparison
            words = sorted(name.split())
            key = " ".join(words)
            if key not in groups:
                groups[key] = []
            groups[key].append(p)

        # Also check for known patterns
        known_patterns = {
            "cerasina": [],
            "peter stoppel": [],
            "zaiger": [],
            "bradford": [],
        }

        for p in pmgs:
            name_lower = (p.nombre or "").lower()
            for pattern in known_patterns:
                if pattern in name_lower:
                    known_patterns[pattern].append(p)

        print("\n=== DUPLICADOS POR NOMBRE EXACTO (palabras reordenadas) ===")
        found = False
        for key, items in groups.items():
            if len(items) > 1:
                found = True
                print(f"\n  Grupo: '{key}'")
                for p in items:
                    var_count = db.query(Variedad).filter(Variedad.id_pmg == p.id_pmg).count()
                    print(f"    ID={p.id_pmg} | {p.nombre} | {var_count} variedades")
        if not found:
            print("  No se encontraron duplicados exactos.")

        print("\n=== DUPLICADOS POR PATRON CONOCIDO ===")
        for pattern, items in known_patterns.items():
            if len(items) > 1:
                print(f"\n  Patron: '{pattern}' ({len(items)} registros)")
                for p in items:
                    var_count = db.query(Variedad).filter(Variedad.id_pmg == p.id_pmg).count()
                    inv_count = db.query(InventarioVivero).filter(InventarioVivero.id_pmg == p.id_pmg).count()
                    print(f"    ID={p.id_pmg} | {p.nombre} | {var_count} vars, {inv_count} lotes")
            elif len(items) == 1:
                print(f"\n  Patron: '{pattern}' - solo 1 registro (ID={items[0].id_pmg}: {items[0].nombre}), no requiere merge")

        return known_patterns


def merge_pmgs(source_id: int, target_id: int, db: Session, dry_run: bool = True):
    """Merge source PMG into target: move all FK references, deactivate source."""
    source = db.get(Pmg, source_id)
    target = db.get(Pmg, target_id)

    if not source or not target:
        print(f"  ERROR: PMG {source_id} o {target_id} no encontrado")
        return

    # Count references
    var_count = db.query(Variedad).filter(Variedad.id_pmg == source_id).count()
    inv_count = db.query(InventarioVivero).filter(InventarioVivero.id_pmg == source_id).count()
    pe_count = db.query(PmgEspecie).filter(PmgEspecie.id_pmg == source_id).count()
    pl_count = db.query(Planta).filter(Planta.id_pmg == source_id).count()

    total = var_count + inv_count + pe_count + pl_count
    action = "DRY-RUN" if dry_run else "EJECUTANDO"

    print(f"\n  [{action}] Fusionar '{source.nombre}' (ID={source_id}) -> '{target.nombre}' (ID={target_id})")
    print(f"    Variedades a mover: {var_count}")
    print(f"    Lotes inventario a mover: {inv_count}")
    print(f"    Asociaciones especie a mover: {pe_count}")
    print(f"    Plantas a mover: {pl_count}")
    print(f"    Total referencias: {total}")

    if not dry_run:
        # Move variedades
        for v in db.query(Variedad).filter(Variedad.id_pmg == source_id).all():
            v.id_pmg = target_id
        # Move inventario
        for inv in db.query(InventarioVivero).filter(InventarioVivero.id_pmg == source_id).all():
            inv.id_pmg = target_id
        # Move pmg_especies (check for duplicates first)
        existing_especies = {pe.id_especie for pe in db.query(PmgEspecie).filter(PmgEspecie.id_pmg == target_id).all()}
        for pe in db.query(PmgEspecie).filter(PmgEspecie.id_pmg == source_id).all():
            if pe.id_especie in existing_especies:
                db.delete(pe)  # Duplicate, just remove
            else:
                pe.id_pmg = target_id
        # Move plantas
        for pl in db.query(Planta).filter(Planta.id_pmg == source_id).all():
            pl.id_pmg = target_id
        # Deactivate source
        source.activo = False
        db.commit()
        print(f"    COMPLETADO: {total} referencias movidas, PMG {source_id} desactivado")


def execute_known_merges(dry_run: bool = True):
    """Execute merges for known duplicate patterns."""
    with Session(engine) as db:
        pmgs = db.query(Pmg).filter(Pmg.activo == True).all()
        pmg_by_name = {(p.nombre or "").lower(): p for p in pmgs}

        print(f"\n{'='*60}")
        print(f"{'DRY-RUN' if dry_run else 'EJECUTANDO'} - Fusiones de PMGs conocidos")
        print(f"{'='*60}")

        # Find Zaiger variants -> merge into the one with most variedades
        zaiger_pmgs = [p for p in pmgs if "zaiger" in (p.nombre or "").lower()]
        if len(zaiger_pmgs) > 1:
            # Keep the one with most variedades
            zaiger_pmgs.sort(
                key=lambda p: db.query(Variedad).filter(Variedad.id_pmg == p.id_pmg).count(),
                reverse=True,
            )
            target = zaiger_pmgs[0]
            print(f"\nZaiger: conservar '{target.nombre}' (ID={target.id_pmg})")
            for source in zaiger_pmgs[1:]:
                merge_pmgs(source.id_pmg, target.id_pmg, db, dry_run)

        # Find Bradford variants
        bradford_pmgs = [p for p in pmgs if "bradford" in (p.nombre or "").lower()]
        if len(bradford_pmgs) > 1:
            bradford_pmgs.sort(
                key=lambda p: db.query(Variedad).filter(Variedad.id_pmg == p.id_pmg).count(),
                reverse=True,
            )
            target = bradford_pmgs[0]
            print(f"\nBradford: conservar '{target.nombre}' (ID={target.id_pmg})")
            for source in bradford_pmgs[1:]:
                merge_pmgs(source.id_pmg, target.id_pmg, db, dry_run)

        # Find Cerasina / Peter Stoppel variants
        cerasina_pmgs = [
            p for p in pmgs
            if "cerasina" in (p.nombre or "").lower() or "peter stoppel" in (p.nombre or "").lower()
        ]
        if len(cerasina_pmgs) > 1:
            cerasina_pmgs.sort(
                key=lambda p: db.query(Variedad).filter(Variedad.id_pmg == p.id_pmg).count(),
                reverse=True,
            )
            target = cerasina_pmgs[0]
            print(f"\nCerasina/Peter Stoppel: conservar '{target.nombre}' (ID={target.id_pmg})")
            for source in cerasina_pmgs[1:]:
                merge_pmgs(source.id_pmg, target.id_pmg, db, dry_run)

        if dry_run:
            print(f"\n{'='*60}")
            print("Esto fue un DRY-RUN. Para ejecutar, use: --execute")
            print(f"{'='*60}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Limpiar PMGs duplicados")
    parser.add_argument("--list", action="store_true", help="Listar todos los PMGs")
    parser.add_argument("--dry-run", action="store_true", help="Mostrar que haria sin ejecutar")
    parser.add_argument("--execute", action="store_true", help="Ejecutar las fusiones")
    parser.add_argument("--find", action="store_true", help="Buscar duplicados")
    args = parser.parse_args()

    if args.list:
        list_pmgs()
    elif args.find:
        find_duplicates()
    elif args.execute:
        execute_known_merges(dry_run=False)
    elif args.dry_run:
        find_duplicates()
        execute_known_merges(dry_run=True)
    else:
        parser.print_help()
