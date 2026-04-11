"""Import all models so SQLAlchemy registers them in metadata."""

from app.models.base import TABLE_PK_MAP  # noqa: F401
from app.models.maestras import (  # noqa: F401
    Pais, Region, Comuna, Campo, Cuartel, Especie, Portainjerto, Pmg, PmgEspecie,
    PortainjertoEspecie, ViveroPmg,
    Origen, Vivero, Color, Susceptibilidad, TipoLabor,
    EstadoFenologico, EstadoPlanta, Temporada, Bodega,
    Catalogo, Correlativo, CentroCosto, MarcoPlantacion,
)
from app.models.variedades import (  # noqa: F401
    Variedad, VariedadSusceptibilidad, VariedadLog,
    Defecto, DefectoVariedad, AsignacionTestBlock,
)
from app.models.inventario import (  # noqa: F401
    InventarioVivero, MovimientoInventario, InventarioTestBlock, GuiaDespacho,
)
from app.models.testblock import (  # noqa: F401
    TestBlock, TestBlockHilera, PosicionTestBlock, Planta, HistorialPosicion,
)
from app.models.laboratorio import (  # noqa: F401
    MedicionLaboratorio, ClasificacionCluster, UmbralCalidad,
    RegistroFenologico, DetalleLabor, EjecucionLabor,
)
from app.models.analisis import PaqueteTecnologico, Alerta, ReglaAlerta  # noqa: F401
from app.models.bitacora import BitacoraVariedad  # noqa: F401
from app.models.evidencia import EvidenciaLabor  # noqa: F401
from app.models.sistema import Usuario, Rol, AuditLog  # noqa: F401
from app.models.variedades_extra import (  # noqa: F401
    VariedadPolinizante, VariedadFoto, BitacoraPortainjerto, TestblockEvento,
)
