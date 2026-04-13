"""Schemas for master/lookup tables — generic CRUD uses these for validation."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


# ── Pais ────────────────────────────────────────────────────────────────────
class PaisCreate(BaseModel):
    codigo: str
    nombre: str
    nombre_en: Optional[str] = None
    orden: int = 0
    activo: bool = True

class PaisUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    nombre_en: Optional[str] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None


# ── Region ──────────────────────────────────────────────────────────────────
class RegionCreate(BaseModel):
    codigo: str
    nombre: str
    numero: Optional[int] = None
    orden: Optional[int] = None
    activo: bool = True

class RegionUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    numero: Optional[int] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None


# ── Comuna ──────────────────────────────────────────────────────────────────
class ComunaCreate(BaseModel):
    nombre: str
    id_region: int
    codigo_postal: Optional[str] = None
    activo: bool = True

class ComunaUpdate(BaseModel):
    nombre: Optional[str] = None
    id_region: Optional[int] = None
    codigo_postal: Optional[str] = None
    activo: Optional[bool] = None


# ── Campo ───────────────────────────────────────────────────────────────────
class CampoCreate(BaseModel):
    codigo: str
    nombre: str
    ubicacion: Optional[str] = None
    comuna: Optional[str] = None
    region: Optional[str] = None
    direccion: Optional[str] = None
    hectareas: Optional[Decimal] = None
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None

class CampoUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    ubicacion: Optional[str] = None
    comuna: Optional[str] = None
    region: Optional[str] = None
    direccion: Optional[str] = None
    hectareas: Optional[Decimal] = None
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    activo: Optional[bool] = None


# ── Cuartel ─────────────────────────────────────────────────────────────────
class CuartelCreate(BaseModel):
    id_campo: Optional[int] = None
    codigo: Optional[str] = None
    nombre: Optional[str] = None

class CuartelUpdate(BaseModel):
    id_campo: Optional[int] = None
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    activo: Optional[bool] = None


# ── Especie ─────────────────────────────────────────────────────────────────
class EspecieCreate(BaseModel):
    codigo: str
    nombre: str
    nombre_cientifico: Optional[str] = None
    emoji: Optional[str] = None
    color_hex: Optional[str] = None

class EspecieUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    nombre_cientifico: Optional[str] = None
    emoji: Optional[str] = None
    color_hex: Optional[str] = None
    activo: Optional[bool] = None


# ── Portainjerto ────────────────────────────────────────────────────────────
class PortainjertoCr(BaseModel):
    codigo: str
    nombre: str
    vigor: Optional[str] = None
    compatibilidad: Optional[str] = None
    origen: Optional[str] = None
    cruce: Optional[str] = None
    especie: Optional[str] = None
    tipo: Optional[str] = None
    patron: Optional[str] = None
    propagacion: Optional[str] = None
    obtentor: Optional[str] = None
    sensibilidad: Optional[str] = None
    susceptibilidades: Optional[str] = None
    ventajas: Optional[str] = None
    notas: Optional[str] = None

class PortainjertoUp(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    vigor: Optional[str] = None
    compatibilidad: Optional[str] = None
    origen: Optional[str] = None
    cruce: Optional[str] = None
    especie: Optional[str] = None
    tipo: Optional[str] = None
    patron: Optional[str] = None
    propagacion: Optional[str] = None
    obtentor: Optional[str] = None
    sensibilidad: Optional[str] = None
    susceptibilidades: Optional[str] = None
    ventajas: Optional[str] = None
    notas: Optional[str] = None
    activo: Optional[bool] = None


# ── Pmg ─────────────────────────────────────────────────────────────────────
class PmgCreate(BaseModel):
    codigo: str
    nombre: str
    licenciante: Optional[str] = None
    pais_origen: Optional[str] = None
    pais: Optional[str] = None
    ciudad: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    contacto: Optional[str] = None
    notas: Optional[str] = None
    viveros_chile: Optional[str] = None

class PmgUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    licenciante: Optional[str] = None
    pais_origen: Optional[str] = None
    pais: Optional[str] = None
    ciudad: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    contacto: Optional[str] = None
    notas: Optional[str] = None
    viveros_chile: Optional[str] = None
    activo: Optional[bool] = None


# ── Origen ──────────────────────────────────────────────────────────────────
class OrigenCreate(BaseModel):
    codigo: str
    nombre: str
    pais: Optional[str] = None
    tipo: Optional[str] = "licenciante"
    contacto: Optional[str] = None
    notas: Optional[str] = None

class OrigenUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    pais: Optional[str] = None
    tipo: Optional[str] = None
    contacto: Optional[str] = None
    notas: Optional[str] = None
    activo: Optional[bool] = None


# ── Vivero ──────────────────────────────────────────────────────────────────
class ViveroCreate(BaseModel):
    codigo: str
    nombre: str
    id_pmg: Optional[int] = None
    representante: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    region: Optional[str] = None

class ViveroUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    id_pmg: Optional[int] = None
    representante: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    region: Optional[str] = None
    activo: Optional[bool] = None


# ── Color ───────────────────────────────────────────────────────────────────
class ColorCreate(BaseModel):
    codigo: Optional[str] = None
    nombre: str
    tipo: str
    aplica_especie: Optional[str] = None
    color_hex: Optional[str] = None

class ColorUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    aplica_especie: Optional[str] = None
    color_hex: Optional[str] = None
    activo: Optional[bool] = None


# ── Susceptibilidad ────────────────────────────────────────────────────────
class SusceptibilidadCreate(BaseModel):
    codigo: str
    nombre: str
    nombre_en: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    severidad: Optional[str] = "media"
    orden: int = 0

class SusceptibilidadUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    nombre_en: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    severidad: Optional[str] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None


# ── EstadoFenologico ───────────────────────────────────────────────────────
class EstadoFenologicoCreate(BaseModel):
    id_especie: int
    codigo: str
    nombre: str
    orden: int = 0
    descripcion: Optional[str] = None
    color_hex: Optional[str] = None
    mes_orientativo: Optional[str] = None
    mes_inicio: Optional[int] = None
    mes_fin: Optional[int] = None

class EstadoFenologicoUpdate(BaseModel):
    id_especie: Optional[int] = None
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    orden: Optional[int] = None
    descripcion: Optional[str] = None
    color_hex: Optional[str] = None
    mes_orientativo: Optional[str] = None
    mes_inicio: Optional[int] = None
    mes_fin: Optional[int] = None
    activo: Optional[bool] = None


# ── TipoLabor ──────────────────────────────────────────────────────────────
class TipoLaborCreate(BaseModel):
    codigo: str
    nombre: str
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    aplica_especies: Optional[str] = None
    aplica_a: Optional[str] = None
    frecuencia: Optional[str] = None

class TipoLaborUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    aplica_especies: Optional[str] = None
    aplica_a: Optional[str] = None
    frecuencia: Optional[str] = None
    activo: Optional[bool] = None


# ── EstadoPlanta ────────────────────────────────────────────────────────────
class EstadoPlantaCreate(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    color_hex: Optional[str] = None
    icono: Optional[str] = None
    requiere_foto: bool = False
    es_final: bool = False
    orden: int = 0

class EstadoPlantaUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    color_hex: Optional[str] = None
    icono: Optional[str] = None
    requiere_foto: Optional[bool] = None
    es_final: Optional[bool] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None


# ── Temporada ───────────────────────────────────────────────────────────────
class TemporadaCreate(BaseModel):
    codigo: str
    nombre: str
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: Optional[str] = "activa"
    notas: Optional[str] = None

class TemporadaUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: Optional[str] = None
    notas: Optional[str] = None
    activo: Optional[bool] = None


# ── Bodega ──────────────────────────────────────────────────────────────────
class BodegaCreate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    ubicacion: Optional[str] = None
    responsable: Optional[str] = None

class BodegaUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    ubicacion: Optional[str] = None
    responsable: Optional[str] = None
    activo: Optional[bool] = None


# ── Catalogo ────────────────────────────────────────────────────────────────
class CatalogoCreate(BaseModel):
    tipo: str
    valor: str
    descripcion: Optional[str] = None
    orden: int = 0

class CatalogoUpdate(BaseModel):
    tipo: Optional[str] = None
    valor: Optional[str] = None
    descripcion: Optional[str] = None
    orden: Optional[int] = None


# ── CentroCosto ─────────────────────────────────────────────────────────────
class CentroCostoCreate(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    id_campo: Optional[int] = None
    responsable: Optional[str] = None
    presupuesto: Optional[Decimal] = None

class CentroCostoUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    id_campo: Optional[int] = None
    responsable: Optional[str] = None
    presupuesto: Optional[Decimal] = None
    activo: Optional[bool] = None


# ── MarcoPlantacion ─────────────────────────────────────────────────────────
class MarcoPlantacionCreate(BaseModel):
    codigo: str
    nombre: str
    distancia_hilera: Optional[str] = None
    distancia_planta: Optional[str] = None
    sistema_conduccion: Optional[str] = None
    descripcion: Optional[str] = None
    dist_entre_hileras: Optional[Decimal] = None
    dist_entre_plantas: Optional[Decimal] = None
    plantas_hectarea: Optional[int] = None
    conduccion: Optional[str] = None
    especie_recomendada: Optional[str] = None

class MarcoPlantacionUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    distancia_hilera: Optional[str] = None
    distancia_planta: Optional[str] = None
    sistema_conduccion: Optional[str] = None
    descripcion: Optional[str] = None
    dist_entre_hileras: Optional[Decimal] = None
    dist_entre_plantas: Optional[Decimal] = None
    plantas_hectarea: Optional[int] = None
    conduccion: Optional[str] = None
    especie_recomendada: Optional[str] = None
    activo: Optional[bool] = None
