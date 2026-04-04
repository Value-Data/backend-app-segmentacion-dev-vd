"""Seed regiones and comunas de Chile.

Creates the tables if they don't exist, then inserts all 16 regiones
and 346 comunas. Idempotent: skips rows that already exist.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.sistema import Usuario
from app.models.maestras import Pais, Region, Comuna

router = APIRouter(prefix="/seed", tags=["Seed"])


# ---------------------------------------------------------------------------
# Paises relevantes para el sistema (ISO 3166-1 alpha-2)
# ---------------------------------------------------------------------------
PAISES = [
    {"codigo": "CL", "nombre": "Chile",           "nombre_en": "Chile",           "orden": 1},
    {"codigo": "AR", "nombre": "Argentina",        "nombre_en": "Argentina",       "orden": 2},
    {"codigo": "BR", "nombre": "Brasil",           "nombre_en": "Brazil",          "orden": 3},
    {"codigo": "PE", "nombre": "Peru",             "nombre_en": "Peru",            "orden": 4},
    {"codigo": "US", "nombre": "Estados Unidos",   "nombre_en": "United States",   "orden": 5},
    {"codigo": "ES", "nombre": "Espana",           "nombre_en": "Spain",           "orden": 6},
    {"codigo": "AU", "nombre": "Australia",         "nombre_en": "Australia",       "orden": 7},
    {"codigo": "NZ", "nombre": "Nueva Zelanda",    "nombre_en": "New Zealand",     "orden": 8},
    {"codigo": "ZA", "nombre": "Sudafrica",        "nombre_en": "South Africa",    "orden": 9},
    {"codigo": "IT", "nombre": "Italia",           "nombre_en": "Italy",           "orden": 10},
    {"codigo": "FR", "nombre": "Francia",          "nombre_en": "France",          "orden": 11},
    {"codigo": "CN", "nombre": "China",            "nombre_en": "China",           "orden": 12},
    {"codigo": "JP", "nombre": "Japon",            "nombre_en": "Japan",           "orden": 13},
    {"codigo": "MX", "nombre": "Mexico",           "nombre_en": "Mexico",          "orden": 14},
    {"codigo": "CO", "nombre": "Colombia",         "nombre_en": "Colombia",        "orden": 15},
    {"codigo": "UY", "nombre": "Uruguay",          "nombre_en": "Uruguay",         "orden": 16},
]


# ---------------------------------------------------------------------------
# Chile's 16 regiones (north to south)
# ---------------------------------------------------------------------------
REGIONES = [
    {"codigo": "XV",  "nombre": "Arica y Parinacota",                  "numero": 15, "orden": 1},
    {"codigo": "I",   "nombre": "Tarapaca",                            "numero": 1,  "orden": 2},
    {"codigo": "II",  "nombre": "Antofagasta",                         "numero": 2,  "orden": 3},
    {"codigo": "III", "nombre": "Atacama",                             "numero": 3,  "orden": 4},
    {"codigo": "IV",  "nombre": "Coquimbo",                            "numero": 4,  "orden": 5},
    {"codigo": "V",   "nombre": "Valparaiso",                          "numero": 5,  "orden": 6},
    {"codigo": "RM",  "nombre": "Metropolitana de Santiago",           "numero": 13, "orden": 7},
    {"codigo": "VI",  "nombre": "Libertador General Bernardo O'Higgins", "numero": 6, "orden": 8},
    {"codigo": "VII", "nombre": "Maule",                               "numero": 7,  "orden": 9},
    {"codigo": "XVI", "nombre": "Nuble",                               "numero": 16, "orden": 10},
    {"codigo": "VIII","nombre": "Biobio",                              "numero": 8,  "orden": 11},
    {"codigo": "IX",  "nombre": "La Araucania",                        "numero": 9,  "orden": 12},
    {"codigo": "XIV", "nombre": "Los Rios",                            "numero": 14, "orden": 13},
    {"codigo": "X",   "nombre": "Los Lagos",                           "numero": 10, "orden": 14},
    {"codigo": "XI",  "nombre": "Aysen del Gral. Carlos Ibanez del Campo", "numero": 11, "orden": 15},
    {"codigo": "XII", "nombre": "Magallanes y de la Antartica Chilena","numero": 12, "orden": 16},
]

# ---------------------------------------------------------------------------
# Comunas grouped by region codigo
# Agricultural zones (IV, V, RM, VI, VII, XVI, VIII) have ALL comunas
# ---------------------------------------------------------------------------
COMUNAS_POR_REGION: dict[str, list[str]] = {
    # ── XV  Arica y Parinacota ──
    "XV": [
        "Arica", "Camarones", "General Lagos", "Putre",
    ],
    # ── I  Tarapaca ──
    "I": [
        "Iquique", "Alto Hospicio", "Camina", "Colchane", "Huara",
        "Pica", "Pozo Almonte",
    ],
    # ── II  Antofagasta ──
    "II": [
        "Antofagasta", "Calama", "Mejillones", "Sierra Gorda",
        "Taltal", "Tocopilla", "Maria Elena", "Ollague", "San Pedro de Atacama",
    ],
    # ── III  Atacama ──
    "III": [
        "Copiapo", "Caldera", "Tierra Amarilla", "Vallenar", "Freirina",
        "Huasco", "Alto del Carmen", "Chanaral", "Diego de Almagro",
    ],
    # ── IV  Coquimbo (full: agricultural zone) ──
    "IV": [
        "La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paihuano",
        "Vicuna", "Illapel", "Canela", "Los Vilos", "Salamanca",
        "Ovalle", "Combarbala", "Monte Patria", "Punitaqui", "Rio Hurtado",
    ],
    # ── V  Valparaiso (full: agricultural zone) ──
    "V": [
        "Valparaiso", "Vina del Mar", "Concon", "Quintero", "Puchuncavi",
        "Casablanca", "Juan Fernandez", "Isla de Pascua",
        "San Antonio", "Algarrobo", "Cartagena", "El Quisco", "El Tabo",
        "Santo Domingo",
        "Quillota", "Calera", "Hijuelas", "La Cruz", "Nogales",
        "San Felipe", "Catemu", "Llay Llay", "Panquehue", "Putaendo",
        "Santa Maria",
        "Los Andes", "Calle Larga", "Rinconada", "San Esteban",
        "Limache", "Olmue",
        "Quilpue", "Villa Alemana",
        "Petorca", "Cabildo", "La Ligua", "Papudo", "Zapallar",
    ],
    # ── RM  Metropolitana (full: agricultural zone) ──
    "RM": [
        "Santiago", "Cerrillos", "Cerro Navia", "Conchali", "El Bosque",
        "Estacion Central", "Huechuraba", "Independencia", "La Cisterna",
        "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes",
        "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipu",
        "Nunoa", "Pedro Aguirre Cerda", "Penalolen", "Providencia",
        "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca",
        "San Joaquin", "San Miguel", "San Ramon", "Vitacura",
        "Puente Alto", "Pirque", "San Jose de Maipo",
        "Colina", "Lampa", "Til Til",
        "San Bernardo", "Buin", "Calera de Tango", "Paine",
        "Melipilla", "Alhue", "Curacavi", "Maria Pinto", "San Pedro",
        "Talagante", "El Monte", "Isla de Maipo", "Padre Hurtado", "Penaflor",
    ],
    # ── VI  O'Higgins (full: main agricultural zone for this project) ──
    "VI": [
        "Rancagua", "Machali", "Codegua", "Graneros", "Mostazal",
        "Requinoa", "Rengo", "Olivar", "Coinco", "Coltauco",
        "Donihue", "Las Cabras", "Peumo", "Quinta de Tilcoco",
        "San Vicente", "Pichidegua", "Malloa",
        "San Fernando", "Chimbarongo", "Nancagua", "Placilla",
        "Santa Cruz", "Chepica", "Lolol", "Palmilla", "Peralillo",
        "Pumanque",
        "Pichilemu", "La Estrella", "Litueche", "Marchigue",
        "Navidad", "Paredones",
    ],
    # ── VII  Maule (full: agricultural zone) ──
    "VII": [
        "Talca", "Constitucion", "Curepto", "Empedrado", "Maule",
        "Pelarco", "Pencahue", "Rio Claro", "San Clemente",
        "San Rafael",
        "Curico", "Hualane", "Licanten", "Molina", "Rauco",
        "Romeral", "Sagrada Familia", "Teno", "Vichuquen",
        "Linares", "Colbun", "Longavi", "Parral", "Retiro",
        "San Javier", "Villa Alegre", "Yerbas Buenas",
        "Cauquenes", "Chanco", "Pelluhue",
    ],
    # ── XVI  Nuble (full: agricultural zone) ──
    "XVI": [
        "Chillan", "Chillan Viejo", "Bulnes", "Cobquecura", "Coelemu",
        "Coihueco", "El Carmen", "Ninhue", "Niquen", "Pemuco",
        "Pinto", "Portezuelo", "Quillon", "Quirihue", "Ranquil",
        "San Carlos", "San Fabian", "San Ignacio", "San Nicolas",
        "Trehuaco", "Yungay",
    ],
    # ── VIII  Biobio (full: agricultural zone) ──
    "VIII": [
        "Concepcion", "Coronel", "Chiguayante", "Florida", "Hualpen",
        "Hualqui", "Lota", "Penco", "San Pedro de la Paz", "Santa Juana",
        "Talcahuano", "Tome",
        "Los Angeles", "Antuco", "Cabrero", "Laja", "Mulchen",
        "Nacimiento", "Negrete", "Quilaco", "Quilleco",
        "San Rosendo", "Santa Barbara", "Tucapel", "Yumbel",
        "Alto Biobio",
        "Lebu", "Arauco", "Canete", "Contulmo", "Curanilahue",
        "Los Alamos", "Tirua",
    ],
    # ── IX  La Araucania ──
    "IX": [
        "Temuco", "Carahue", "Cholchol", "Cunco", "Curarrehue",
        "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche",
        "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco",
        "Pitrufquen", "Pucon", "Saavedra", "Teodoro Schmidt",
        "Tolten", "Vilcun", "Villarrica",
        "Angol", "Collipulli", "Curacautin", "Ercilla", "Lonquimay",
        "Los Sauces", "Lumaco", "Puren", "Renaico", "Traiguen",
        "Victoria",
    ],
    # ── XIV  Los Rios ──
    "XIV": [
        "Valdivia", "Corral", "Lanco", "Los Lagos", "Mafil",
        "Mariquina", "Paillaco", "Panguipulli",
        "La Union", "Futrono", "Lago Ranco", "Rio Bueno",
    ],
    # ── X  Los Lagos ──
    "X": [
        "Puerto Montt", "Calbuco", "Cochamo", "Fresia", "Frutillar",
        "Los Muermos", "Llanquihue", "Maullin", "Puerto Varas",
        "Osorno", "Puerto Octay", "Purranque", "Puyehue",
        "Rio Negro", "San Juan de la Costa", "San Pablo",
        "Castro", "Ancud", "Chonchi", "Curaco de Velez",
        "Dalcahue", "Puqueldon", "Queilen", "Quellon",
        "Quemchi", "Quinchao",
        "Chaiten", "Futaleufu", "Hualaihue", "Palena",
    ],
    # ── XI  Aysen ──
    "XI": [
        "Coyhaique", "Lago Verde",
        "Aysen", "Cisnes", "Guaitecas",
        "Chile Chico", "Rio Ibanez",
        "Cochrane", "O'Higgins", "Tortel",
    ],
    # ── XII  Magallanes ──
    "XII": [
        "Punta Arenas", "Laguna Blanca", "Rio Verde", "San Gregorio",
        "Cabo de Hornos", "Antartica",
        "Porvenir", "Primavera", "Timaukel",
        "Puerto Natales", "Torres del Paine",
    ],
}


def _find_or_create(db: Session, model, lookup_field: str, lookup_value, defaults: dict):
    """Return (instance, created_bool)."""
    obj = db.query(model).filter(getattr(model, lookup_field) == lookup_value).first()
    if obj:
        return obj, False
    obj = model(**{lookup_field: lookup_value, **defaults})
    db.add(obj)
    db.flush()
    return obj, True


@router.post("/regiones-comunas")
def seed_regiones_comunas(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Seed paises, regiones and comunas of Chile. Idempotent."""

    summary = {
        "paises": {"created": 0, "skipped": 0},
        "regiones": {"created": 0, "skipped": 0},
        "comunas": {"created": 0, "skipped": 0},
    }

    # 0. Insert paises
    for pdata in PAISES:
        _, created = _find_or_create(
            db, Pais, "codigo", pdata["codigo"],
            {
                "nombre": pdata["nombre"],
                "nombre_en": pdata["nombre_en"],
                "orden": pdata["orden"],
            },
        )
        summary["paises"]["created" if created else "skipped"] += 1

    # 1. Insert regiones
    region_map: dict[str, Region] = {}
    for rdata in REGIONES:
        reg, created = _find_or_create(
            db, Region, "codigo", rdata["codigo"],
            {
                "nombre": rdata["nombre"],
                "numero": rdata["numero"],
                "orden": rdata["orden"],
            },
        )
        region_map[rdata["codigo"]] = reg
        summary["regiones"]["created" if created else "skipped"] += 1

    # 2. Insert comunas
    for region_codigo, comunas_list in COMUNAS_POR_REGION.items():
        reg_obj = region_map.get(region_codigo)
        if not reg_obj:
            continue
        for nombre_comuna in comunas_list:
            # Check if already exists for this region
            existing = (
                db.query(Comuna)
                .filter(Comuna.nombre == nombre_comuna, Comuna.id_region == reg_obj.id_region)
                .first()
            )
            if existing:
                summary["comunas"]["skipped"] += 1
                continue
            comuna = Comuna(nombre=nombre_comuna, id_region=reg_obj.id_region)
            db.add(comuna)
            summary["comunas"]["created"] += 1

    db.commit()

    total_comunas = sum(len(v) for v in COMUNAS_POR_REGION.values())
    return {
        "status": "ok",
        "message": f"Seed completado: {len(PAISES)} paises, {len(REGIONES)} regiones, {total_comunas} comunas",
        "summary": summary,
    }
