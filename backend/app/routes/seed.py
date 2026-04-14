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
    {"codigo": "CAR", "nombre": "Carozo", "nombre_cientifico": "Prunus spp.", "color_hex": "#E67E22"},
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


@router.post("/seed-susceptibilidades", tags=["Seed"])
def seed_susceptibilidades(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Seed susceptibilidades por especie — Cherry Plum, Nectarines, Duraznos."""
    from app.models.maestras import Susceptibilidad

    especies_db = {e.codigo: e.id_especie for e in db.query(Especie).all()}
    id_cir = especies_db.get("CIR") or especies_db.get("CER")
    id_cer = especies_db.get("CER")
    id_nec = especies_db.get("NEC")
    id_dur = especies_db.get("DUR")

    data = [
        ("CIR-DAH-001","Partidura","Cracking","Daños y Heridas",1,id_cir),
        ("CIR-DAH-002","Herida abierta","Open wound","Daños y Heridas",2,id_cir),
        ("CIR-DAH-003","Daño mecánico","Mechanical damage","Daños y Heridas",3,id_cir),
        ("CIR-DAH-004","Desgarro peduncular","Peduncular tear","Daños y Heridas",4,id_cir),
        ("CIR-DAH-005","Mancha roce","Friction stain","Daños y Heridas",5,id_cir),
        ("CIR-PUB-001","Machucón","Bruising","Pudriciones y Blando",6,id_cir),
        ("CIR-PUB-002","Pudrición","Decay","Pudriciones y Blando",7,id_cir),
        ("CIR-PUB-003","Zona blanda","Soft area","Pudriciones y Blando",8,id_cir),
        ("CIR-PUB-004","Fruto blando","Soft fruit","Pudriciones y Blando",9,id_cir),
        ("CIR-PUB-005","Deshidratado","Dehydrated","Pudriciones y Blando",10,id_cir),
        ("CIR-CAL-001","Falta de color","Lack of color","Calidad",11,id_cir),
        ("CIR-CAL-002","Fruto verde","Green fruit","Calidad",12,id_cir),
        ("CIR-CAL-003","Herida cicatrizada","Healed wound","Calidad",13,id_cir),
        ("CIR-CAL-004","Russet","Russet","Calidad",14,id_cir),
        ("CIR-CAL-005","Virosis","Viral disease","Calidad",15,id_cir),
        ("NEC-CAL-001","Falta de color","Lack of color","Calidad",1,id_nec),
        ("NEC-CAL-002","Fruta verde","Green fruit","Calidad",2,id_nec),
        ("NEC-CAL-003","Fruto deforme","Deformed","Calidad",3,id_nec),
        ("NEC-CAL-004","Herida cicatrizada","Healed wound","Calidad",4,id_nec),
        ("NEC-CAL-005","Trips","Thrips damage","Calidad",5,id_nec),
        ("NEC-CAL-006","Daño escama","Scale damage","Calidad",6,id_nec),
        ("NEC-CAL-007","Craquelado","Sugar spot","Calidad",7,id_nec),
        ("NEC-CAL-008","Russet","Russet","Calidad",8,id_nec),
        ("NEC-CAL-009","Ramaleo","Ramaleo","Calidad",9,id_nec),
        ("NEC-CAL-010","Gomosis","Gomosis","Calidad",10,id_nec),
        ("NEC-CAL-011","Inking","Inking","Calidad",11,id_nec),
        ("NEC-CAL-012","Golpe sol","Sunstroke","Calidad",12,id_nec),
        ("NEC-CON-001","Partidura","Cracking","Condición",13,id_nec),
        ("NEC-CON-002","Herida abierta","Open wound","Condición",14,id_nec),
        ("NEC-CON-003","Daño mecánico","Mechanical damage","Condición",15,id_nec),
        ("NEC-CON-004","Carozo partido","Split pit","Condición",16,id_nec),
        ("NEC-CON-005","Desgarro peduncular","Peduncular tear","Condición",17,id_nec),
        ("NEC-CON-006","Quemado de sol","Sunburned","Condición",18,id_nec),
        ("NEC-CON-007","Daño polilla","Moth damage","Condición",19,id_nec),
        ("NEC-CON-008","Machucón","Bruising","Condición",20,id_nec),
        ("NEC-CON-009","Pudrición","Decay","Condición",21,id_nec),
        ("NEC-CON-010","Zona blanda","Soft area","Condición",22,id_nec),
        ("NEC-CON-011","Fruto blando","Soft fruit","Condición",23,id_nec),
        ("NEC-CON-012","Deshidratado","Dehydrated","Condición",24,id_nec),
        ("DUR-CAL-001","Falta de color","Lack of color","Calidad",1,id_dur),
        ("DUR-CAL-002","Fruta verde","Green fruit","Calidad",2,id_dur),
        ("DUR-CAL-003","Fruto deforme","Deformed","Calidad",3,id_dur),
        ("DUR-CAL-004","Herida cicatrizada","Healed wound","Calidad",4,id_dur),
        ("DUR-CAL-005","Trips","Thrips damage","Calidad",5,id_dur),
        ("DUR-CAL-006","Daño escama","Scale damage","Calidad",6,id_dur),
        ("DUR-CAL-007","Craquelado","Sugar spot","Calidad",7,id_dur),
        ("DUR-CAL-008","Russet","Russet","Calidad",8,id_dur),
        ("DUR-CAL-009","Ramaleo","Ramaleo","Calidad",9,id_dur),
        ("DUR-CAL-010","Gomosis","Gomosis","Calidad",10,id_dur),
        ("DUR-CAL-011","Inking","Inking","Calidad",11,id_dur),
        ("DUR-CAL-012","Golpe sol","Sunstroke","Calidad",12,id_dur),
        ("DUR-CON-001","Partidura","Cracking","Condición",13,id_dur),
        ("DUR-CON-002","Herida abierta","Open wound","Condición",14,id_dur),
        ("DUR-CON-003","Daño mecánico","Mechanical damage","Condición",15,id_dur),
        ("DUR-CON-004","Carozo partido","Split pit","Condición",16,id_dur),
        ("DUR-CON-005","Desgarro peduncular","Peduncular tear","Condición",17,id_dur),
        ("DUR-CON-006","Quemado de sol","Sunburned","Condición",18,id_dur),
        ("DUR-CON-007","Daño polilla","Moth damage","Condición",19,id_dur),
        ("DUR-CON-008","Machucón","Bruising","Condición",20,id_dur),
        ("DUR-CON-009","Pudrición","Decay","Condición",21,id_dur),
        ("DUR-CON-010","Zona blanda","Soft area","Condición",22,id_dur),
        ("DUR-CON-011","Fruto blando","Soft fruit","Condición",23,id_dur),
        ("DUR-CON-012","Deshidratado","Dehydrated","Condición",24,id_dur),
        # Cerezo (CER) — 26 susceptibilidades
        ("CER-PYS-001","Partidura estilar","Bottom crack","Partiduras y Suturas",1,id_cer),
        ("CER-PYS-002","Partidura de agua","Lateral crack","Partiduras y Suturas",2,id_cer),
        ("CER-PYS-003","Sutura","Suture","Partiduras y Suturas",3,id_cer),
        ("CER-PYS-004","Media luna","Half moon crack","Partiduras y Suturas",4,id_cer),
        ("CER-DAH-001","Pitting","Pitting","Daños y Heridas",5,id_cer),
        ("CER-DAH-002","Machucón","Bruising","Daños y Heridas",6,id_cer),
        ("CER-DAH-003","Herida abierta","Open wound","Daños y Heridas",7,id_cer),
        ("CER-PUD-001","Mancha parda","Brown spot","Pudriciones",8,id_cer),
        ("CER-PUD-002","Pudrición parda","Brown rot","Pudriciones",9,id_cer),
        ("CER-PUD-003","Pudrición negra","Black rot","Pudriciones",10,id_cer),
        ("CER-PUD-004","Daño de pájaro","Bird damage","Pudriciones",11,id_cer),
        ("CER-PUD-005","Larvas","Worms","Pudriciones",12,id_cer),
        ("CER-PUD-006","Fruto blando","Soft fruit","Pudriciones",13,id_cer),
        ("CER-DES-001","Piel de lagarto","Lizard skin","Deshidrataciones",14,id_cer),
        ("CER-DES-002","Fruto deshidratado","Dehydrated fruit","Deshidrataciones",15,id_cer),
        ("CER-DES-003","Pedicelo deshidratado","Dehydrated stem","Deshidrataciones",16,id_cer),
        ("CER-CAL-001","Manchas","Stains","Defectos de Calidad",17,id_cer),
        ("CER-CAL-002","Daño de trips","Thrips damage","Defectos de Calidad",18,id_cer),
        ("CER-CAL-003","Daño de escama","Scale damage","Defectos de Calidad",19,id_cer),
        ("CER-CAL-004","Virosis","Viral disease","Defectos de Calidad",20,id_cer),
        ("CER-CAL-005","Hijuelo","Spur","Defectos de Calidad",21,id_cer),
        ("CER-CAL-006","Fruto doble","Twin fruit","Defectos de Calidad",22,id_cer),
        ("CER-CAL-007","Sin pedicelo","Stemless","Defectos de Calidad",23,id_cer),
        ("CER-CAL-008","Falta color","Lack of color","Defectos de Calidad",24,id_cer),
        ("CER-AMA-001","Manchas (amarillas)","Stains (yellow)","Cerezas Amarillas",25,id_cer),
        ("CER-AMA-002","Machucón (amarillas)","Bruising (yellow)","Cerezas Amarillas",26,id_cer),
    ]

    created = updated = 0
    for codigo, nombre, nombre_en, grupo, orden, id_esp in data:
        existing = db.query(Susceptibilidad).filter(Susceptibilidad.codigo == codigo).first()
        if existing:
            existing.nombre = nombre
            existing.nombre_en = nombre_en
            existing.grupo = grupo
            existing.orden = orden
            existing.id_especie = id_esp
            existing.activo = True
            updated += 1
        else:
            db.add(Susceptibilidad(
                codigo=codigo, nombre=nombre, nombre_en=nombre_en,
                grupo=grupo, orden=orden, id_especie=id_esp, activo=True,
            ))
            created += 1

    deactivated = 0
    for s in db.query(Susceptibilidad).filter(Susceptibilidad.activo == True).all():
        if not any(s.codigo.startswith(p) for p in ("CIR-", "NEC-", "DUR-")):
            s.activo = False
            deactivated += 1

    db.commit()
    return {"created": created, "updated": updated, "deactivated": deactivated,
            "species": {"CIR": id_cir, "NEC": id_nec, "DUR": id_dur}}


@router.post("/seed-maestros", tags=["Seed"])
def seed_maestros(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Seed maestros: 5 especies, 13 PMG, 7 portainjertos, 211 variedades."""
    from app.models.maestras import Pmg, Portainjerto
    from app.models.variedades import Variedad

    summary = {"especies": 0, "pmg": 0, "portainjertos": 0, "variedades": 0}

    # 1. Especies
    esp_data = [("CIR", "Ciruela"), ("NEC", "Nectarín"), ("DUR", "Durazno"), ("DAM", "Damasco"), ("PAR", "Paraguayo")]
    for codigo, nombre in esp_data:
        if not db.query(Especie).filter(Especie.codigo == codigo).first():
            db.add(Especie(codigo=codigo, nombre=nombre, activo=True))
            summary["especies"] += 1
    db.flush()

    # 2. PMG
    pmg_names = ["ANFIC", "Ben-Dor Fruits", "Bradford", "Consorcio", "CRA", "Culdevco",
                 "Garces", "Maillar", "Pepe Perez", "Provedo", "PSB", "Universidad de Chile", "Zaiger"]
    for nombre in pmg_names:
        if not db.query(Pmg).filter(Pmg.nombre == nombre).first():
            db.add(Pmg(nombre=nombre, activo=True))
            summary["pmg"] += 1
    db.flush()

    # 3. Portainjertos
    pi_data = [("GXN","GXN"),("NEMAGUARD","Nemaguard"),("NOGA","Noga"),("NOGA-GXN","Noga/GXN"),
               ("NOGA-NEMAGUARD","Noga/Nemaguard"),("H41","H41"),("H43","H43")]
    for codigo, nombre in pi_data:
        if not db.query(Portainjerto).filter(Portainjerto.codigo == codigo).first():
            db.add(Portainjerto(codigo=codigo, nombre=nombre, activo=True))
            summary["portainjertos"] += 1
    db.flush()

    # Resolve IDs
    esp_map = {e.codigo: e.id_especie for e in db.query(Especie).all()}
    pmg_map = {p.nombre: p.id_pmg for p in db.query(Pmg).all()}

    # 4. Variedades
    variedades = [
        # Ciruela (151)
        ("CIR-001","05-158","CIR","Ben-Dor Fruits"),("CIR-002","1A18","CIR","Universidad de Chile"),
        ("CIR-003","2B19","CIR","Universidad de Chile"),("CIR-004","43A54","CIR","Universidad de Chile"),
        ("CIR-005","43A60","CIR","Universidad de Chile"),("CIR-006","7A85","CIR","Universidad de Chile"),
        ("CIR-007","7B37","CIR","Universidad de Chile"),("CIR-008","7B81","CIR","Universidad de Chile"),
        ("CIR-009","A5-192","CIR","Ben-Dor Fruits"),("CIR-010","African Delight","CIR","Culdevco"),
        ("CIR-011","Amitai","CIR","Ben-Dor Fruits"),("CIR-012","Autumn Pride","CIR",None),
        ("CIR-013","B39-2","CIR","Ben-Dor Fruits"),("CIR-014","Big Sun","CIR","Ben-Dor Fruits"),
        ("CIR-015","CI-1001","CIR","Bradford"),("CIR-016","CI-1002","CIR","Bradford"),
        ("CIR-017","CI-1003","CIR","Bradford"),("CIR-018","CI-1006","CIR","Bradford"),
        ("CIR-019","CI-1007","CIR","Bradford"),("CIR-020","CI-1010","CIR","Bradford"),
        ("CIR-021","CI-158","CIR","Zaiger"),("CIR-022","CI-181","CIR","Zaiger"),
        ("CIR-023","CI-227","CIR","Zaiger"),("CIR-024","CI-233","CIR","Zaiger"),
        ("CIR-025","CI-336","CIR","Zaiger"),("CIR-026","CI-358","CIR","Zaiger"),
        ("CIR-027","CI-359","CIR","Zaiger"),("CIR-028","CI-393","CIR","Zaiger"),
        ("CIR-029","CI-399","CIR","Zaiger"),("CIR-030","CI-403","CIR","Zaiger"),
        ("CIR-031","CI-454","CIR","Zaiger"),("CIR-032","CI-459","CIR","Zaiger"),
        ("CIR-033","CI-464","CIR","Zaiger"),("CIR-034","CI-465","CIR","Zaiger"),
        ("CIR-035","CI-466","CIR","Zaiger"),("CIR-036","CI-467","CIR","Zaiger"),
        ("CIR-037","CI-469","CIR","Zaiger"),("CIR-038","CI-471","CIR","Zaiger"),
        ("CIR-039","CI-473","CIR","Zaiger"),("CIR-040","CI-474","CIR","Zaiger"),
        ("CIR-041","CI-475","CIR","Zaiger"),("CIR-042","CI-481","CIR","Zaiger"),
        ("CIR-043","CI-483","CIR","Zaiger"),("CIR-044","CI-484","CIR","Zaiger"),
        ("CIR-045","CI-485","CIR","Zaiger"),("CIR-046","CI-486","CIR","Zaiger"),
        ("CIR-047","CI-492","CIR","Zaiger"),("CIR-048","CI-496","CIR","Zaiger"),
        ("CIR-049","CI-497","CIR","Zaiger"),("CIR-050","CI-502","CIR","Zaiger"),
        ("CIR-051","CI-503","CIR","Zaiger"),("CIR-052","CI-506","CIR","Zaiger"),
        ("CIR-053","CI-507","CIR","Zaiger"),("CIR-054","CI-509","CIR","Zaiger"),
        ("CIR-055","CI-522","CIR","Zaiger"),("CIR-056","CI-526","CIR","Zaiger"),
        ("CIR-057","CI-534","CIR","Zaiger"),("CIR-058","CI-535","CIR","Zaiger"),
        ("CIR-059","CI-541","CIR","Zaiger"),("CIR-060","CI-550","CIR","Zaiger"),
        ("CIR-061","CI-553","CIR","Zaiger"),("CIR-062","CI-554","CIR","Zaiger"),
        ("CIR-063","CI-555","CIR","Zaiger"),("CIR-064","CI-596","CIR","Zaiger"),
        ("CIR-065","CI-597","CIR","Zaiger"),("CIR-066","CI-602","CIR","Zaiger"),
        ("CIR-067","CI-608","CIR","Zaiger"),("CIR-068","CI-609","CIR","Zaiger"),
        ("CIR-069","CI-618","CIR","Zaiger"),("CIR-070","CI-619","CIR","Zaiger"),
        ("CIR-071","CI-620","CIR","Zaiger"),("CIR-072","CI-621","CIR","Zaiger"),
        ("CIR-073","CI-623","CIR","Zaiger"),("CIR-074","CI-626","CIR","Zaiger"),
        ("CIR-075","CI-627","CIR","Zaiger"),("CIR-076","CI-630","CIR","Zaiger"),
        ("CIR-077","CI-634","CIR","Zaiger"),("CIR-078","CI-640","CIR","Zaiger"),
        ("CIR-079","CI-659","CIR","Zaiger"),("CIR-080","CI-660","CIR","Zaiger"),
        ("CIR-081","CI-662","CIR","Zaiger"),("CIR-082","CI-663","CIR","Zaiger"),
        ("CIR-083","CI-668","CIR",None),("CIR-084","CI-670","CIR","Zaiger"),
        ("CIR-085","CI-671","CIR","Zaiger"),("CIR-086","CI-678","CIR","Zaiger"),
        ("CIR-087","CI-687","CIR","Zaiger"),("CIR-088","CI-701","CIR","Zaiger"),
        ("CIR-089","CI-730","CIR","Zaiger"),("CIR-090","CI-732","CIR","Zaiger"),
        ("CIR-091","CI-733","CIR","Zaiger"),("CIR-092","CI-740","CIR","Zaiger"),
        ("CIR-093","CI-741","CIR","Zaiger"),("CIR-094","CI-742","CIR","Zaiger"),
        ("CIR-095","CI-743","CIR","Zaiger"),("CIR-096","CI-744","CIR","Zaiger"),
        ("CIR-097","CI-745","CIR","Zaiger"),("CIR-098","CI-752","CIR","Zaiger"),
        ("CIR-099","CI-753","CIR","Zaiger"),("CIR-100","CI-765","CIR","Zaiger"),
        ("CIR-101","CI-768","CIR","Zaiger"),("CIR-102","CI-777","CIR","Zaiger"),
        ("CIR-103","CI-787","CIR","Zaiger"),("CIR-104","CI-790","CIR","Zaiger"),
        ("CIR-105","CI-793","CIR","Zaiger"),("CIR-106","CI-794","CIR","Bradford"),
        ("CIR-107","CI-795","CIR","Zaiger"),("CIR-108","CI-799","CIR","Zaiger"),
        ("CIR-109","CI-800","CIR","Zaiger"),("CIR-110","CI-812","CIR","Zaiger"),
        ("CIR-111","CI-814","CIR","Zaiger"),("CIR-112","CI-818","CIR","Zaiger"),
        ("CIR-113","CI-821","CIR","Zaiger"),("CIR-114","CI-858","CIR","Bradford"),
        ("CIR-115","CI-873","CIR",None),("CIR-116","CI-895","CIR",None),
        ("CIR-117","CI-971","CIR","Bradford"),("CIR-118","CI-976","CIR",None),
        ("CIR-119","CI-978","CIR","Bradford"),("CIR-120","CI-984","CIR","Bradford"),
        ("CIR-121","CI-989","CIR",None),("CIR-122","CI-990","CIR",None),
        ("CIR-123","CI-998","CIR","Bradford"),("CIR-124","CI-NN 1494","CIR",None),
        ("CIR-125","CI-PEPE PEREZ","CIR","Pepe Perez"),
        ("CIR-126","Deep Purple","CIR","Ben-Dor Fruits"),("CIR-127","D'agen","CIR",None),
        ("CIR-128","Flavor Punch","CIR",None),("CIR-129","I4-43","CIR","Ben-Dor Fruits"),
        ("CIR-130","I6-81","CIR","Ben-Dor Fruits"),("CIR-131","Latemoon","CIR","Ben-Dor Fruits"),
        ("CIR-132","M20-22","CIR","Ben-Dor Fruits"),("CIR-133","Mirrel","CIR","Ben-Dor Fruits"),
        ("CIR-134","N7-92","CIR","Ben-Dor Fruits"),("CIR-135","NADIA","CIR","ANFIC"),
        ("CIR-136","OZI","CIR","Ben-Dor Fruits"),("CIR-137","Red Diamond","CIR","Ben-Dor Fruits"),
        ("CIR-138","Red Granade","CIR",None),("CIR-139","S102-1","CIR","Ben-Dor Fruits"),
        ("CIR-140","S102-42","CIR","Ben-Dor Fruits"),("CIR-141","Silver Red","CIR","Ben-Dor Fruits"),
        ("CIR-142","Sunset Delight","CIR","Zaiger"),("CIR-143","Sweet Delight","CIR","Zaiger"),
        ("CIR-144","Sweet Mary","CIR","Zaiger"),("CIR-145","Sweet Pekeetah","CIR","Universidad de Chile"),
        ("CIR-146","T1-80","CIR","Ben-Dor Fruits"),("CIR-147","T6-21","CIR","Ben-Dor Fruits"),
        ("CIR-148","Tamara","CIR","Ben-Dor Fruits"),("CIR-149","V11-8","CIR","Ben-Dor Fruits"),
        ("CIR-150","V13-27","CIR","Ben-Dor Fruits"),("CIR-151","VARDIT","CIR","Ben-Dor Fruits"),
        # Nectarin (49)
        ("NEC-001","17A59","NEC","Universidad de Chile"),("NEC-002","18P108","NEC","Universidad de Chile"),
        ("NEC-003","18P53","NEC","Universidad de Chile"),("NEC-004","18P61","NEC","Universidad de Chile"),
        ("NEC-005","18P69","NEC","Universidad de Chile"),("NEC-006","23P2","NEC","Universidad de Chile"),
        ("NEC-007","Andesneccinco","NEC","Universidad de Chile"),("NEC-008","Andesneccuatro","NEC","Universidad de Chile"),
        ("NEC-009","Boreal","NEC","PSB"),("NEC-010","Bright pearl","NEC","Bradford"),
        ("NEC-011","Claris","NEC",None),("NEC-012","Clariss","NEC","PSB"),
        ("NEC-013","Extreme 303","NEC","Provedo"),("NEC-014","Garcica","NEC","PSB"),
        ("NEC-015","Gardeta","NEC","PSB"),("NEC-016","Garofa","NEC","PSB"),
        ("NEC-017","Gartairo","NEC","PSB"),("NEC-018","Isi White","NEC",None),
        ("NEC-019","Kinolea","NEC","PSB"),("NEC-020","Luciana","NEC","PSB"),
        ("NEC-021","M10","NEC","Pepe Perez"),("NEC-022","M11","NEC","Pepe Perez"),
        ("NEC-023","M13","NEC","Pepe Perez"),("NEC-024","M14","NEC","Pepe Perez"),
        ("NEC-025","M15","NEC","Pepe Perez"),("NEC-026","M16","NEC","Pepe Perez"),
        ("NEC-027","M20","NEC","Pepe Perez"),("NEC-028","M7","NEC","Pepe Perez"),
        ("NEC-029","M8","NEC","Pepe Perez"),("NEC-030","M9","NEC","Pepe Perez"),
        ("NEC-031","Magique","NEC","Maillar"),("NEC-032","N1","NEC","Consorcio"),
        ("NEC-033","N5","NEC","Consorcio"),("NEC-034","N7","NEC","Consorcio"),
        ("NEC-035","NE-484","NEC","Zaiger"),("NEC-036","NE-757","NEC",None),
        ("NEC-037","NE-772","NEC","Bradford"),("NEC-038","NE-901","NEC","Zaiger"),
        ("NEC-039","NE-904","NEC","Zaiger"),("NEC-040","NE-918","NEC","Bradford"),
        ("NEC-041","Nectarin Amarillo","NEC","Garces"),("NEC-042","Perlicius V","NEC","Bradford"),
        ("NEC-043","PRO 712","NEC","Provedo"),("NEC-044","Spring Bright","NEC",None),
        ("NEC-045","Spring red","NEC",None),("NEC-046","Tiffany","NEC","PSB"),
        ("NEC-047","Venus","NEC","CRA"),("NEC-048","White Angel","NEC",None),
        ("NEC-049","Zee Glo","NEC",None),
        # Durazno (9)
        ("DUR-001","14A81","DUR","Universidad de Chile"),("DUR-002","28P89","DUR","Universidad de Chile"),
        ("DUR-003","8B181","DUR","Universidad de Chile"),("DUR-004","Carla","DUR","PSB"),
        ("DUR-005","D15","DUR","Consorcio"),("DUR-006","D3","DUR","Consorcio"),
        ("DUR-007","DU-649","DUR","Zaiger"),("DUR-008","DU-665","DUR","Bradford"),
        ("DUR-009","Zee lady","DUR","Zaiger"),
        # Damasco (1) + Paraguayo (1)
        ("DAM-001","Tiger","DAM","Ben-Dor Fruits"),
        ("PAR-001","Samantha","PAR","PSB"),
    ]

    for codigo, nombre, esp_codigo, pmg_nombre in variedades:
        if not db.query(Variedad).filter(Variedad.codigo == codigo).first():
            db.add(Variedad(
                codigo=codigo, nombre=nombre,
                id_especie=esp_map.get(esp_codigo),
                id_pmg=pmg_map.get(pmg_nombre) if pmg_nombre else None,
                activo=True,
            ))
            summary["variedades"] += 1

    db.commit()
    return {"status": "ok", "summary": summary}


@router.post("/seed-complementarios", tags=["Seed"])
def seed_complementarios(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Seed complementary masters: campos, colores, origenes, temporadas, estados fenologicos."""
    from app.models.maestras import (
        Campo, Color, Origen, Temporada, EstadoFenologico,
    )
    summary = {}

    # 1. Campos
    campos_data = [
        ("CAM-001","Almahue","Campo"),("CAM-002","El Parque","Campo"),("CAM-003","El Retorno","Campo"),
        ("CAM-004","Gape","Campo"),("CAM-005","Huaico","Campo"),("CAM-006","La Estación","Campo"),
        ("CAM-007","La Lajuela","Campo"),("CAM-008","María Pinto","Campo"),("CAM-009","Nave","Campo"),
        ("CAM-010","Plantel Madre","Plantel"),("CAM-011","Productor","Externo"),
        ("CAM-012","Productor ANA","Externo"),("CAM-013","Rinconada Maipú","Campo"),
        ("CAM-014","Santa Margarita","Campo"),("CAM-015","Servando","Campo"),
        ("CAM-016","Vivero Requinoa","Vivero"),("CAM-017","Zolezi","Campo"),
    ]
    c = 0
    for codigo, nombre, tipo in campos_data:
        if not db.query(Campo).filter(Campo.codigo == codigo).first():
            db.add(Campo(codigo=codigo, nombre=nombre, ubicacion=tipo, activo=True))
            c += 1
    summary["campos"] = c

    # 2. Colores
    colores_data = [
        ("COL-001","Amarilla","Yellow","#FFD700"),("COL-002","Anaranjada","Orange","#FF8C00"),
        ("COL-003","Blanca","White","#FFFFF0"),("COL-004","Roja","Red","#DC143C"),
        ("COL-005","Morada-Roja","Purple-Red","#8B0000"),("COL-006","Roja (Beterraga)","Beetroot Red","#8B0045"),
        ("COL-007","Damasco","Apricot","#FBCEB1"),("COL-008","Verde","Green","#228B22"),
        ("COL-009","Amarilla-Verde","Yellow-Green","#9ACD32"),("COL-010","Bicolor","Bicolor",None),
        ("COL-011","Negra","Black","#2F0033"),("COL-012","Rosada","Pink","#FF69B4"),
    ]
    c = 0
    for codigo, nombre, nombre_en, hex_color in colores_data:
        if not db.query(Color).filter(Color.codigo == codigo).first():
            db.add(Color(codigo=codigo, nombre=nombre, tipo="fruto", color_hex=hex_color, activo=True))
            c += 1
    summary["colores"] = c

    # 3. Origenes / Paises
    origenes_data = [
        ("CL","Chile","América del Sur"),("US","Estados Unidos","América del Norte"),
        ("IL","Israel","Medio Oriente"),("ES","España","Europa"),("FR","Francia","Europa"),
        ("IT","Italia","Europa"),("ZA","Sudáfrica","África"),("AU","Australia","Oceanía"),
        ("BR","Brasil","América del Sur"),("AR","Argentina","América del Sur"),
        ("DE","Alemania","Europa"),("CN","China","Asia"),("JP","Japón","Asia"),
        ("NZ","Nueva Zelanda","Oceanía"),("TR","Turquía","Europa/Asia"),
        ("PT","Portugal","Europa"),("GR","Grecia","Europa"),("PE","Perú","América del Sur"),
        ("MX","México","América del Norte"),("UY","Uruguay","América del Sur"),
    ]
    c = 0
    for codigo, nombre, region in origenes_data:
        if not db.query(Origen).filter(Origen.codigo == codigo).first():
            db.add(Origen(codigo=codigo, nombre=nombre, pais=nombre, tipo=region, activo=True))
            c += 1
    summary["origenes"] = c

    # 4. Temporadas
    temp_data = [
        ("2016-2017",2016,2017),("2017-2018",2017,2018),("2018-2019",2018,2019),
        ("2019-2020",2019,2020),("2020-2021",2020,2021),("2021-2022",2021,2022),
        ("2022-2023",2022,2023),("2023-2024",2023,2024),("2024-2025",2024,2025),("2025-2026",2025,2026),
    ]
    c = 0
    for codigo, ai, af in temp_data:
        if not db.query(Temporada).filter(Temporada.codigo == codigo).first():
            db.add(Temporada(codigo=codigo, anio_inicio=ai, anio_fin=af, activo=True))
            c += 1
    summary["temporadas"] = c

    # 5. Estados fenologicos — skip if already seeded (40+ exist with id_especie)
    summary["estados_fenologicos"] = "ya existentes (40+)"

    db.commit()
    return {"status": "ok", "summary": summary}
