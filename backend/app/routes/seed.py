"""Seed demo data following the proper agronomic flow:
maestras -> inventario vivero -> testblocks -> posiciones -> alta plantas.
"""

from datetime import datetime, date
from app.core.utils import utcnow

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.sistema import Usuario
from app.models.maestras import (
    Especie, Portainjerto, Pmg, Vivero, Campo, Temporada, PmgEspecie, Cuartel,
)
from app.models.variedades import Variedad
from app.models.inventario import InventarioVivero, MovimientoInventario
from app.models.testblock import (
    TestBlock, PosicionTestBlock, Planta, HistorialPosicion,
)

router = APIRouter(prefix="/seed", tags=["Seed"])


# ---------------------------------------------------------------------------
# Master data definitions
# ---------------------------------------------------------------------------
ESPECIES_DATA = [
    {"codigo": "CER", "nombre": "Cerezo", "nombre_cientifico": "Prunus avium", "color_hex": "#DC2626"},
    {"codigo": "CIR", "nombre": "Ciruela", "nombre_cientifico": "Prunus domestica", "color_hex": "#7C3AED"},
    {"codigo": "NEC", "nombre": "Nectarina", "nombre_cientifico": "Prunus persica var. nucipersica", "color_hex": "#F59E0B"},
]

VARIEDADES_DATA = {
    "CER": [
        {"codigo": "CER-LAP", "nombre": "Lapins"},
        {"codigo": "CER-REG", "nombre": "Regina"},
        {"codigo": "CER-SAN", "nombre": "Santina"},
        {"codigo": "CER-SKE", "nombre": "Skeena"},
        {"codigo": "CER-SWE", "nombre": "Sweetheart"},
        {"codigo": "CER-RAI", "nombre": "Rainier"},
        {"codigo": "CER-KOR", "nombre": "Kordia"},
        {"codigo": "CER-STE", "nombre": "Stella"},
    ],
    "CIR": [
        {"codigo": "CIR-ANG", "nombre": "Angeleno"},
        {"codigo": "CIR-LAR", "nombre": "Larry Ann"},
        {"codigo": "CIR-BLA", "nombre": "Black Amber"},
        {"codigo": "CIR-FRI", "nombre": "Friar"},
        {"codigo": "CIR-FOR", "nombre": "Fortune"},
        {"codigo": "CIR-AUT", "nombre": "Autumn Giant"},
    ],
    "NEC": [
        {"codigo": "NEC-ARC", "nombre": "Arctic Star"},
        {"codigo": "NEC-AUG", "nombre": "August Fire"},
        {"codigo": "NEC-FAN", "nombre": "Fantasia"},
        {"codigo": "NEC-SUM", "nombre": "Summer Fire"},
        {"codigo": "NEC-RUB", "nombre": "Ruby Diamond"},
        {"codigo": "NEC-MAG", "nombre": "Magique"},
    ],
}

PORTAINJERTOS_DATA = [
    {"codigo": "MAX14", "nombre": "Maxma 14", "vigor": "semi-vigoroso", "especie": "Cerezo"},
    {"codigo": "GIS6", "nombre": "Gisela 6", "vigor": "semi-enanizante", "especie": "Cerezo"},
    {"codigo": "GARN", "nombre": "Garnem", "vigor": "vigoroso", "especie": "Nectarina,Ciruela"},
    {"codigo": "COLT", "nombre": "Colt", "vigor": "vigoroso", "especie": "Cerezo"},
    {"codigo": "NEMA", "nombre": "Nemaguard", "vigor": "vigoroso", "especie": "Nectarina,Ciruela"},
]

PMGS_DATA = [
    {"codigo": "IFG", "nombre": "IFG (International Fruit Genetics)", "pais_origen": "USA", "licenciante": "IFG"},
    {"codigo": "SMS", "nombre": "SMS (Sun Marketing Solutions)", "pais_origen": "Chile", "licenciante": "SMS"},
]

VIVEROS_DATA = [
    {"codigo": "VIV-SUR", "nombre": "Vivero Sur", "comuna": "Rancagua", "region": "O'Higgins"},
    {"codigo": "VIV-CEN", "nombre": "Vivero Central", "comuna": "Requinoa", "region": "O'Higgins"},
]

CAMPOS_DATA = [
    {
        "codigo": "CAM-RAN", "nombre": "Campo Rancagua",
        "ubicacion": "Rancagua", "comuna": "Rancagua", "region": "O'Higgins",
    },
    {
        "codigo": "CAM-REQ", "nombre": "Campo Requinoa",
        "ubicacion": "Requinoa", "comuna": "Requinoa", "region": "O'Higgins",
    },
]

TEMPORADA_DATA = {
    "codigo": "2024-2025",
    "nombre": "Temporada 2024-2025",
    "fecha_inicio": date(2024, 9, 1),
    "fecha_fin": date(2025, 4, 30),
    "estado": "activa",
}

# TestBlock definitions: (codigo, nombre, campo_codigo, num_hileras, posiciones_por_hilera, especie_codigo)
TESTBLOCKS_DATA = [
    ("TB-CER-2024", "TB-CEREZO-2024", "CAM-RAN", 5, 8, "CER"),
    ("TB-CIR-2024", "TB-CIRUELA-2024", "CAM-REQ", 4, 6, "CIR"),
]


# ---------------------------------------------------------------------------
# Helper: find-or-create
# ---------------------------------------------------------------------------
def _find_or_create(db: Session, model, lookup_field: str, lookup_value, defaults: dict) -> tuple:
    """Return (instance, created_bool). Looks up by lookup_field=lookup_value."""
    obj = db.query(model).filter(getattr(model, lookup_field) == lookup_value).first()
    if obj:
        return obj, False
    obj = model(**{lookup_field: lookup_value, **defaults})
    db.add(obj)
    db.flush()
    return obj, True


# ---------------------------------------------------------------------------
# Main seed endpoint
# ---------------------------------------------------------------------------
@router.post("/demo")
def seed_demo(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Populate demo data following the agronomic flow. Idempotent: skips existing rows."""

    summary = {
        "especies": {"created": 0, "skipped": 0},
        "variedades": {"created": 0, "skipped": 0},
        "portainjertos": {"created": 0, "skipped": 0},
        "pmg": {"created": 0, "skipped": 0},
        "viveros": {"created": 0, "skipped": 0},
        "campos": {"created": 0, "skipped": 0},
        "temporadas": {"created": 0, "skipped": 0},
        "inventario_vivero": {"created": 0, "skipped": 0},
        "testblocks": {"created": 0, "skipped": 0},
        "posiciones": {"created": 0, "skipped": 0},
        "plantas": {"created": 0, "skipped": 0},
        "movimientos": {"created": 0},
    }

    usuario = user.username

    # ── 1. Especies ───────────────────────────────────────────────────────
    especie_map: dict[str, Especie] = {}
    for edata in ESPECIES_DATA:
        esp, created = _find_or_create(
            db, Especie, "codigo", edata["codigo"],
            {
                "nombre": edata["nombre"],
                "nombre_cientifico": edata["nombre_cientifico"],
                "color_hex": edata["color_hex"],
                "usuario_creacion": usuario,
            },
        )
        especie_map[edata["codigo"]] = esp
        summary["especies"]["created" if created else "skipped"] += 1

    # ── 2. Portainjertos ──────────────────────────────────────────────────
    pi_map: dict[str, Portainjerto] = {}
    for pdata in PORTAINJERTOS_DATA:
        pi, created = _find_or_create(
            db, Portainjerto, "codigo", pdata["codigo"],
            {
                "nombre": pdata["nombre"],
                "vigor": pdata["vigor"],
                "especie": pdata["especie"],
                "usuario_creacion": usuario,
            },
        )
        pi_map[pdata["codigo"]] = pi
        summary["portainjertos"]["created" if created else "skipped"] += 1

    # ── 3. PMGs ───────────────────────────────────────────────────────────
    pmg_map: dict[str, Pmg] = {}
    for pmgdata in PMGS_DATA:
        pmg, created = _find_or_create(
            db, Pmg, "codigo", pmgdata["codigo"],
            {
                "nombre": pmgdata["nombre"],
                "pais_origen": pmgdata["pais_origen"],
                "licenciante": pmgdata["licenciante"],
                "usuario_creacion": usuario,
            },
        )
        pmg_map[pmgdata["codigo"]] = pmg
        summary["pmg"]["created" if created else "skipped"] += 1

    # Link PMG<->Especie (all PMGs apply to all especies for demo)
    for pmg_code, pmg_obj in pmg_map.items():
        for esp_code, esp_obj in especie_map.items():
            exists = (
                db.query(PmgEspecie)
                .filter(PmgEspecie.id_pmg == pmg_obj.id_pmg, PmgEspecie.id_especie == esp_obj.id_especie)
                .first()
            )
            if not exists:
                db.add(PmgEspecie(id_pmg=pmg_obj.id_pmg, id_especie=esp_obj.id_especie))

    # ── 4. Viveros ────────────────────────────────────────────────────────
    vivero_map: dict[str, Vivero] = {}
    for vdata in VIVEROS_DATA:
        viv, created = _find_or_create(
            db, Vivero, "codigo", vdata["codigo"],
            {
                "nombre": vdata["nombre"],
                "comuna": vdata["comuna"],
                "region": vdata["region"],
                "usuario_creacion": usuario,
            },
        )
        vivero_map[vdata["codigo"]] = viv
        summary["viveros"]["created" if created else "skipped"] += 1

    # ── 5. Campos ─────────────────────────────────────────────────────────
    campo_map: dict[str, Campo] = {}
    for cdata in CAMPOS_DATA:
        campo, created = _find_or_create(
            db, Campo, "codigo", cdata["codigo"],
            {
                "nombre": cdata["nombre"],
                "ubicacion": cdata["ubicacion"],
                "comuna": cdata["comuna"],
                "region": cdata["region"],
                "usuario_creacion": usuario,
            },
        )
        campo_map[cdata["codigo"]] = campo
        summary["campos"]["created" if created else "skipped"] += 1

    # ── 6. Temporada ──────────────────────────────────────────────────────
    temp, created = _find_or_create(
        db, Temporada, "codigo", TEMPORADA_DATA["codigo"],
        {
            "nombre": TEMPORADA_DATA["nombre"],
            "fecha_inicio": TEMPORADA_DATA["fecha_inicio"],
            "fecha_fin": TEMPORADA_DATA["fecha_fin"],
            "estado": TEMPORADA_DATA["estado"],
        },
    )
    summary["temporadas"]["created" if created else "skipped"] += 1

    # ── 7. Variedades ─────────────────────────────────────────────────────
    # Assign first PMG as default for the demo
    default_pmg = pmg_map.get("IFG")
    variedad_map: dict[str, Variedad] = {}  # codigo -> Variedad
    for esp_code, vars_list in VARIEDADES_DATA.items():
        esp_obj = especie_map.get(esp_code)
        if not esp_obj:
            continue
        for vd in vars_list:
            var, created = _find_or_create(
                db, Variedad, "codigo", vd["codigo"],
                {
                    "nombre": vd["nombre"],
                    "id_especie": esp_obj.id_especie,
                    "id_pmg": default_pmg.id_pmg if default_pmg else None,
                    "usuario_creacion": usuario,
                },
            )
            variedad_map[vd["codigo"]] = var
            summary["variedades"]["created" if created else "skipped"] += 1

    db.flush()

    # ── 8. Inventario vivero (one lot per variedad, qty=20) ───────────────
    # Assign portainjertos to species for inventory lots:
    #   Cerezo  -> Maxma 14, Gisela 6 (alternate)
    #   Ciruela -> Garnem, Nemaguard (alternate)
    #   Nectarina -> Garnem, Nemaguard (alternate)
    PI_BY_ESPECIE = {
        "CER": ["MAX14", "GIS6"],
        "CIR": ["GARN", "NEMA"],
        "NEC": ["GARN", "NEMA"],
    }

    default_vivero = vivero_map.get("VIV-SUR")
    lote_map: dict[str, InventarioVivero] = {}  # variedad codigo -> lote

    for esp_code, vars_list in VARIEDADES_DATA.items():
        esp_obj = especie_map.get(esp_code)
        pi_codes = PI_BY_ESPECIE.get(esp_code, [])
        if not esp_obj:
            continue
        for idx, vd in enumerate(vars_list):
            var_obj = variedad_map.get(vd["codigo"])
            if not var_obj:
                continue

            lote_codigo = f"LOT-{vd['codigo']}-2024"
            existing_lote = (
                db.query(InventarioVivero)
                .filter(InventarioVivero.codigo_lote == lote_codigo)
                .first()
            )
            if existing_lote:
                lote_map[vd["codigo"]] = existing_lote
                summary["inventario_vivero"]["skipped"] += 1
                continue

            # Alternate portainjertos for variety within its species
            pi_code = pi_codes[idx % len(pi_codes)] if pi_codes else None
            pi_obj = pi_map.get(pi_code) if pi_code else None

            lote = InventarioVivero(
                codigo_lote=lote_codigo,
                id_variedad=var_obj.id_variedad,
                id_portainjerto=pi_obj.id_portainjerto if pi_obj else None,
                id_vivero=default_vivero.id_vivero if default_vivero else None,
                id_especie=esp_obj.id_especie,
                id_pmg=default_pmg.id_pmg if default_pmg else None,
                tipo_planta="planta",
                cantidad_inicial=20,
                cantidad_actual=20,
                cantidad_minima=2,
                fecha_ingreso=date(2024, 8, 15),
                ano_plantacion=2024,
                estado="disponible",
                observaciones=f"Lote demo {vd['nombre']}",
            )
            db.add(lote)
            db.flush()
            lote_map[vd["codigo"]] = lote
            summary["inventario_vivero"]["created"] += 1

    db.flush()

    # ── 9. TestBlocks ─────────────────────────────────────────────────────
    tb_objs: list[tuple[TestBlock, str, int, int]] = []  # (tb, especie_code, hileras, pos_per_hilera)

    for tb_codigo, tb_nombre, campo_cod, n_hileras, pos_per_h, esp_cod in TESTBLOCKS_DATA:
        campo_obj = campo_map.get(campo_cod)
        if not campo_obj:
            continue

        existing_tb = db.query(TestBlock).filter(TestBlock.codigo == tb_codigo).first()
        if existing_tb:
            # Find or create cuartel for existing testblock
            cuartel_cod = f"CUA-{tb_codigo}"
            cuartel, _ = _find_or_create(
                db, Cuartel, "codigo", cuartel_cod,
                {
                    "nombre": f"Cuartel {tb_nombre}",
                    "id_campo": campo_obj.id_campo,
                    "num_hileras": n_hileras,
                    "pos_por_hilera": pos_per_h,
                    "es_testblock": True,
                },
            )
            tb_objs.append((existing_tb, esp_cod, n_hileras, pos_per_h, cuartel))
            summary["testblocks"]["skipped"] += 1
            continue

        # Create a cuartel for this testblock (posiciones require id_cuartel NOT NULL)
        cuartel_cod = f"CUA-{tb_codigo}"
        cuartel, _ = _find_or_create(
            db, Cuartel, "codigo", cuartel_cod,
            {
                "nombre": f"Cuartel {tb_nombre}",
                "id_campo": campo_obj.id_campo,
                "num_hileras": n_hileras,
                "pos_por_hilera": pos_per_h,
                "es_testblock": True,
            },
        )

        tb = TestBlock(
            codigo=tb_codigo,
            nombre=tb_nombre,
            id_campo=campo_obj.id_campo,
            id_cuartel=cuartel.id_cuartel,
            num_hileras=n_hileras,
            posiciones_por_hilera=pos_per_h,
            total_posiciones=n_hileras * pos_per_h,
            estado="activo",
            temporada_inicio="2024-2025",
            notas=f"TestBlock demo para {esp_cod}",
        )
        db.add(tb)
        db.flush()
        tb_objs.append((tb, esp_cod, n_hileras, pos_per_h, cuartel))
        summary["testblocks"]["created"] += 1

    # ── 10. Posiciones ────────────────────────────────────────────────────
    for tb, esp_code, n_hileras, pos_per_h, cuartel in tb_objs:
        for hi in range(1, n_hileras + 1):
            for pi in range(1, pos_per_h + 1):
                cod = f"{tb.codigo}-H{hi:02d}-P{pi:02d}"
                exists = (
                    db.query(PosicionTestBlock)
                    .filter(PosicionTestBlock.codigo_unico == cod)
                    .first()
                )
                if exists:
                    summary["posiciones"]["skipped"] += 1
                    continue

                pos = PosicionTestBlock(
                    codigo_unico=cod,
                    id_cuartel=cuartel.id_cuartel,
                    id_testblock=tb.id_testblock,
                    hilera=hi,
                    posicion=pi,
                    estado="vacia",
                )
                db.add(pos)
                summary["posiciones"]["created"] += 1

    db.flush()

    # ── 11. Alta de plantas (plant from inventory into positions) ─────────
    #
    # For each testblock we iterate positions row by row.
    # We cycle through the variedades of the matching species and
    # alternate portainjertos, exactly mirroring the inventory lots.
    # Each planta creation:
    #   - creates Planta record
    #   - updates PosicionTestBlock to estado="alta"
    #   - decrements InventarioVivero.cantidad_actual
    #   - creates MovimientoInventario
    #   - creates HistorialPosicion

    for tb, esp_code, n_hileras, pos_per_h, cuartel in tb_objs:
        vars_for_esp = VARIEDADES_DATA.get(esp_code, [])
        if not vars_for_esp:
            continue

        # Gather positions for this testblock that are still empty
        posiciones = (
            db.query(PosicionTestBlock)
            .filter(
                PosicionTestBlock.id_testblock == tb.id_testblock,
                PosicionTestBlock.estado == "vacia",
            )
            .order_by(PosicionTestBlock.hilera, PosicionTestBlock.posicion)
            .all()
        )

        for idx, pos in enumerate(posiciones):
            # Cycle through variedades for this species
            var_data = vars_for_esp[idx % len(vars_for_esp)]
            var_obj = variedad_map.get(var_data["codigo"])
            lote = lote_map.get(var_data["codigo"])

            if not var_obj or not lote:
                continue

            # Check stock available
            if lote.cantidad_actual <= 0:
                continue

            # Create Planta
            planta = Planta(
                codigo=pos.codigo_unico,
                id_posicion=pos.id_posicion,
                id_variedad=var_obj.id_variedad,
                id_portainjerto=lote.id_portainjerto,
                id_especie=lote.id_especie,
                id_pmg=lote.id_pmg,
                id_lote_origen=lote.id_inventario,
                condicion="EN_EVALUACION",
                activa=True,
                fecha_alta=utcnow(),
                ano_plantacion=2024,
                usuario_creacion=usuario,
            )
            db.add(planta)
            db.flush()

            # Update posicion
            pos.estado = "alta"
            pos.id_variedad = var_obj.id_variedad
            pos.id_portainjerto = lote.id_portainjerto
            pos.id_pmg = lote.id_pmg
            pos.id_lote = lote.id_inventario
            pos.fecha_alta = utcnow()
            pos.fecha_plantacion = utcnow()
            pos.usuario_alta = usuario
            pos.fecha_modificacion = utcnow()

            # Decrement inventory
            saldo_anterior = lote.cantidad_actual
            lote.cantidad_actual -= 1
            if lote.cantidad_actual <= 0:
                lote.estado = "agotado"
            lote.fecha_modificacion = utcnow()

            # Register movimiento
            mov = MovimientoInventario(
                id_inventario=lote.id_inventario,
                id_planta=planta.id_planta,
                tipo="PLANTACION",
                cantidad=1,
                saldo_anterior=saldo_anterior,
                saldo_nuevo=lote.cantidad_actual,
                motivo="Alta planta - seed demo",
                referencia_destino=pos.codigo_unico,
                usuario=usuario,
            )
            db.add(mov)
            summary["movimientos"]["created"] += 1

            # Historial
            hist = HistorialPosicion(
                id_posicion=pos.id_posicion,
                id_planta=planta.id_planta,
                accion="alta",
                estado_anterior="vacia",
                estado_nuevo="alta",
                usuario=usuario,
            )
            db.add(hist)

            summary["plantas"]["created"] += 1

    # ── Commit everything ─────────────────────────────────────────────────
    db.commit()

    return {
        "status": "ok",
        "message": "Seed demo completado",
        "summary": summary,
    }
