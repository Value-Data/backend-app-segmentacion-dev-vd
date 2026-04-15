"""TestBlock routes: CRUD, posiciones, grilla, alta/baja/replante, config, QR, mapa."""

import io
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.sistema import Usuario
from app.models.testblock import TestBlock, PosicionTestBlock, Planta, HistorialPosicion
from app.models.inventario import InventarioVivero, InventarioTestBlock
from app.schemas.testblock import (
    TestBlockCreate, TestBlockUpdate,
    AltaPlantaRequest, AltaMasivaRequest,
    BajaPlantaRequest, BajaMasivaRequest,
    ReplantePlantaRequest,
    AgregarHileraRequest, AgregarPosicionesRequest,
    GenerarPosicionesRequest,
    UpdatePosicionObservaciones,
)
from app.services import crud
from app.services.testblock_service import (
    generar_posiciones, alta_planta, alta_masiva,
    baja_planta, baja_masiva, replante_planta,
    get_grilla, get_resumen_hileras, get_resumen_variedades,
    agregar_hilera, agregar_posiciones,
    eliminar_hilera, eliminar_posiciones,
    get_inventario_testblock,
)

router = APIRouter(prefix="/testblocks", tags=["TestBlock"])


# ── Seed demo lotes (static path — must be before /{id} routes) ───────────
@router.post("/demo/seed-lotes")
def seed_lotes_demo(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Auto-crear lotes demo desde datos existentes de testblocks.

    Para cada testblock, agrupa posiciones por (variedad, portainjerto),
    crea un lote en inventario_vivero, y vincula las plantas existentes.
    """
    from app.models.testblock import Planta
    from app.core.utils import utcnow
    from sqlalchemy import func as sa_func
    import logging

    logger = logging.getLogger(__name__)

    try:
        testblocks = db.query(TestBlock).filter(TestBlock.activo == True).all()
        if not testblocks:
            return {"lotes_creados": 0, "plantas_vinculadas": 0, "message": "No hay testblocks activos"}

        total_lotes = 0
        total_plantas = 0
        detalles = []

        for tb in testblocks:
            # Get positions with plants (estado='alta') that have variedad and portainjerto
            posiciones = (
                db.query(PosicionTestBlock)
                .filter(
                    PosicionTestBlock.id_testblock == tb.id_testblock,
                    PosicionTestBlock.estado == "alta",
                    PosicionTestBlock.id_variedad.isnot(None),
                    PosicionTestBlock.id_portainjerto.isnot(None),
                )
                .all()
            )

            if not posiciones:
                continue

            # Group by (variedad, portainjerto)
            grupos: dict[tuple[int, int], list] = {}
            for pos in posiciones:
                key = (pos.id_variedad, pos.id_portainjerto)
                if key not in grupos:
                    grupos[key] = []
                grupos[key].append(pos)

            for (var_id, pi_id), grupo_pos in grupos.items():
                # Skip if these positions already have a lote assigned
                already_lotted = all(p.id_lote is not None for p in grupo_pos)
                if already_lotted:
                    continue

                # Only process positions without lote
                sin_lote = [p for p in grupo_pos if p.id_lote is None]
                if not sin_lote:
                    continue

                # Generate unique codigo_lote
                seq_count = (
                    db.query(sa_func.count(InventarioVivero.id_inventario))
                    .filter(InventarioVivero.codigo_lote.like(f"LOT-TB{tb.id_testblock}-%"))
                    .scalar()
                ) or 0
                seq = seq_count + 1
                codigo_lote = f"LOT-TB{tb.id_testblock}-{seq:04d}"

                while db.query(InventarioVivero).filter(InventarioVivero.codigo_lote == codigo_lote).first():
                    seq += 1
                    codigo_lote = f"LOT-TB{tb.id_testblock}-{seq:04d}"

                first_pos = sin_lote[0]

                lote = InventarioVivero(
                    codigo_lote=codigo_lote,
                    id_variedad=var_id,
                    id_portainjerto=pi_id,
                    id_especie=first_pos.id_pmg,  # best effort
                    tipo_planta="TESTBLOCK_DIRECTO",
                    cantidad_inicial=len(sin_lote),
                    cantidad_actual=0,
                    cantidad_minima=0,
                    cantidad_comprometida=0,
                    fecha_ingreso=utcnow().date(),
                    estado="plantado",
                    observaciones=f"Lote seed demo desde TB {tb.codigo}",
                    fecha_creacion=utcnow(),
                )
                db.add(lote)
                db.flush()

                # Link existing plants and positions
                plantas_linked = 0
                for pos in sin_lote:
                    pos.id_lote = lote.id_inventario

                    planta = (
                        db.query(Planta)
                        .filter(Planta.id_posicion == pos.id_posicion, Planta.activa == True)
                        .first()
                    )
                    if planta:
                        planta.id_lote_origen = lote.id_inventario
                        plantas_linked += 1

                total_lotes += 1
                total_plantas += plantas_linked
                detalles.append({
                    "testblock": tb.codigo,
                    "codigo_lote": codigo_lote,
                    "variedad_id": var_id,
                    "portainjerto_id": pi_id,
                    "posiciones": len(sin_lote),
                    "plantas_vinculadas": plantas_linked,
                })

        db.commit()

        return {
            "lotes_creados": total_lotes,
            "plantas_vinculadas": total_plantas,
            "detalles": detalles,
            "message": f"{total_lotes} lotes creados, {total_plantas} plantas vinculadas",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error en seed lotes demo: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear lotes demo: {str(e)}. La base de datos puede estar temporalmente inaccesible.",
        )


# ── CRUD ────────────────────────────────────────────────────────────────────
@router.get("")
def list_testblocks(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    from sqlalchemy import func, case

    from app.models.maestras import Campo

    tbs = crud.list_all(db, TestBlock)
    if not tbs:
        return []

    tb_ids = [tb.id_testblock for tb in tbs]

    # Resolve campo names in a single query
    campo_ids = list({tb.id_campo for tb in tbs if tb.id_campo})
    campo_map: dict[int, str] = {}
    if campo_ids:
        campos = db.query(Campo.id_campo, Campo.nombre).filter(Campo.id_campo.in_(campo_ids)).all()
        campo_map = {c[0]: c[1] for c in campos}

    # Single GROUP BY query instead of N+1 per-testblock queries
    stats_q = (
        db.query(
            PosicionTestBlock.id_testblock,
            func.sum(case((PosicionTestBlock.estado == "alta", 1), else_=0)).label("pos_alta"),
            func.sum(case((PosicionTestBlock.estado == "baja", 1), else_=0)).label("pos_baja"),
            func.sum(case((PosicionTestBlock.estado == "replante", 1), else_=0)).label("pos_replante"),
            func.sum(case((PosicionTestBlock.estado == "vacia", 1), else_=0)).label("pos_vacia"),
        )
        .filter(PosicionTestBlock.id_testblock.in_(tb_ids))
        .group_by(PosicionTestBlock.id_testblock)
        .all()
    )
    stats_map = {row[0]: row for row in stats_q}

    result = []
    for tb in tbs:
        data = {c: getattr(tb, c) for c in tb.__class__.model_fields}
        data["campo_nombre"] = campo_map.get(tb.id_campo, f"Campo #{tb.id_campo}")
        s = stats_map.get(tb.id_testblock)
        data["pos_alta"] = int(s[1]) if s else 0
        data["pos_baja"] = int(s[2]) if s else 0
        data["pos_replante"] = int(s[3]) if s else 0
        data["pos_vacia"] = int(s[4]) if s else 0
        result.append(data)
    return result


@router.get("/{id}")
def get_testblock(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    from sqlalchemy import func, case

    tb = crud.get_by_id(db, TestBlock, id)
    data = {c: getattr(tb, c) for c in tb.__class__.model_fields}

    stats = (
        db.query(
            func.sum(case((PosicionTestBlock.estado == "alta", 1), else_=0)).label("pos_alta"),
            func.sum(case((PosicionTestBlock.estado == "baja", 1), else_=0)).label("pos_baja"),
            func.sum(case((PosicionTestBlock.estado == "replante", 1), else_=0)).label("pos_replante"),
            func.sum(case((PosicionTestBlock.estado == "vacia", 1), else_=0)).label("pos_vacia"),
        )
        .filter(PosicionTestBlock.id_testblock == id)
        .first()
    )
    data["pos_alta"] = int(stats[0] or 0) if stats else 0
    data["pos_baja"] = int(stats[1] or 0) if stats else 0
    data["pos_replante"] = int(stats[2] or 0) if stats else 0
    data["pos_vacia"] = int(stats[3] or 0) if stats else 0
    return data


@router.post("", status_code=201)
def create_testblock(
    data: TestBlockCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return crud.create(db, TestBlock, data, usuario=user.username)


@router.put("/{id}")
def update_testblock(
    id: int,
    data: TestBlockUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return crud.update(db, TestBlock, id, data, usuario=user.username)


@router.post("/{id}/reestructurar")
def reestructurar_testblock(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Reorganize existing positions into a new grid layout.

    Takes all positions from the testblock and redistributes them into
    the specified num_hileras × posiciones_por_hilera grid.

    Body: { num_hileras: int, posiciones_por_hilera: int }

    Example: 124 positions currently in 124×1 → reestructurar to 6×21 (126 slots, 124 filled + 2 empty)
    """
    num_hileras = data.get("num_hileras")
    pos_por_hilera = data.get("posiciones_por_hilera")
    if not num_hileras or not pos_por_hilera:
        raise HTTPException(status_code=400, detail="Se requiere num_hileras y posiciones_por_hilera")

    tb = db.query(TestBlock).filter(TestBlock.id_testblock == id).first()
    if not tb:
        raise HTTPException(status_code=404, detail="TestBlock no encontrado")

    # Get all existing positions ordered by hilera, posicion
    posiciones = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == id)
        .order_by(PosicionTestBlock.hilera, PosicionTestBlock.posicion)
        .all()
    )

    total_existing = len(posiciones)

    # Auto-adjust: if positions don't fit, increase hileras
    import math
    min_hileras = math.ceil(total_existing / pos_por_hilera) if pos_por_hilera > 0 else 1
    if num_hileras < min_hileras:
        num_hileras = min_hileras  # auto-expand to fit all positions

    total_slots = num_hileras * pos_por_hilera

    # Redistribute: assign new hilera/posicion to each existing position
    reassigned = 0
    for i, pos in enumerate(posiciones):
        new_hilera = (i // pos_por_hilera) + 1
        new_posicion = (i % pos_por_hilera) + 1

        if pos.hilera != new_hilera or pos.posicion != new_posicion:
            pos.hilera = new_hilera
            pos.posicion = new_posicion
            # Update codigo_unico
            cuartel_code = pos.codigo_unico.split("-H")[0] if "-H" in pos.codigo_unico else tb.codigo
            pos.codigo_unico = f"{cuartel_code}-H{new_hilera}-P{new_posicion}"
            # Also update plant codigo if exists
            planta = db.query(Planta).filter(Planta.id_posicion == pos.id_posicion, Planta.activa == True).first()
            if planta:
                planta.codigo = pos.codigo_unico
            reassigned += 1

    # Create new empty positions if total_slots > total_existing
    created = 0
    if total_slots > total_existing:
        existing_coords = {(p.hilera, p.posicion) for p in posiciones}
        from app.models.maestras import Cuartel
        cuartel = db.query(Cuartel).filter(Cuartel.id_cuartel == tb.id_cuartel).first() if tb.id_cuartel else None
        base_code = cuartel.codigo if cuartel else tb.codigo

        for h in range(1, num_hileras + 1):
            for p in range(1, pos_por_hilera + 1):
                if (h, p) not in existing_coords:
                    new_pos = PosicionTestBlock(
                        codigo_unico=f"{base_code}-H{h}-P{p}",
                        id_cuartel=tb.id_cuartel,
                        id_testblock=id,
                        hilera=h,
                        posicion=p,
                        estado="vacia",
                    )
                    db.add(new_pos)
                    created += 1

    # Update testblock metadata
    tb.num_hileras = num_hileras
    tb.posiciones_por_hilera = pos_por_hilera
    tb.total_posiciones = total_existing + created

    db.commit()

    return {
        "testblock": tb.codigo,
        "layout": f"{num_hileras} hileras × {pos_por_hilera} posiciones",
        "posiciones_redistribuidas": reassigned,
        "posiciones_nuevas": created,
        "total": total_existing + created,
    }


@router.delete("/{id}")
def delete_testblock(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return crud.soft_delete(db, TestBlock, id, usuario=user.username)


# ── Generar posiciones ──────────────────────────────────────────────────────
@router.post("/{id}/generar-posiciones")
def api_generar_posiciones(
    id: int,
    data: GenerarPosicionesRequest | None = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    count = generar_posiciones(
        db, id,
        num_hileras=data.num_hileras if data else None,
        pos_por_hilera=data.posiciones_por_hilera if data else None,
        usuario=user.username,
    )
    return {"count": count}


# ── Posiciones y Grilla ────────────────────────────────────────────────────
@router.get("/{id}/posiciones")
def list_posiciones(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    posiciones = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == id)
        .order_by(PosicionTestBlock.hilera, PosicionTestBlock.posicion)
        .all()
    )
    # Enrich with etapa from active plant
    pos_ids = [p.id_posicion for p in posiciones if p.estado in ("alta", "replante")]
    etapa_map: dict[int, str] = {}
    if pos_ids:
        plantas = (
            db.query(Planta.id_posicion, Planta.etapa)
            .filter(Planta.id_posicion.in_(pos_ids), Planta.activa == True)
            .all()
        )
        etapa_map = {p.id_posicion: (p.etapa or "formacion") for p in plantas}

    result = []
    for pos in posiciones:
        d = {c.name: getattr(pos, c.name) for c in pos.__table__.columns}
        d["etapa"] = etapa_map.get(pos.id_posicion)
        result.append(d)
    return result


@router.get("/{id}/grilla")
def api_grilla(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return get_grilla(db, id)


@router.get("/{id}/resumen-hileras")
def api_resumen_hileras(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return get_resumen_hileras(db, id)


@router.get("/{id}/resumen-variedades")
def api_resumen_variedades(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return get_resumen_variedades(db, id)


# ── Operaciones de planta ──────────────────────────────────────────────────
@router.post("/{id}/alta")
def api_alta(
    id: int,
    data: AltaPlantaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return alta_planta(db, id, data, usuario=user.username)


@router.post("/{id}/alta-directa")
def api_alta_directa(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Alta directa de planta SIN lote de inventario.

    Para plantas pre-existentes que no pasaron por inventario.
    Body: {
        id_posicion: int (o posicion_ids: [int] para masivo),
        id_variedad: int,
        id_portainjerto: int,
        id_especie: int (opcional),
        id_pmg: int (opcional),
        fecha_plantacion: str (opcional, default hoy),
        observaciones: str (opcional)
    }
    """
    from datetime import date
    from app.models.testblock import TestBlock, PosicionTestBlock, Planta, HistorialPosicion
    from app.core.utils import utcnow

    tb = db.query(TestBlock).filter(TestBlock.id_testblock == id).first()
    if not tb:
        raise HTTPException(status_code=404, detail="TestBlock no encontrado")

    id_variedad = data.get("id_variedad")
    id_portainjerto = data.get("id_portainjerto")
    if not id_variedad:
        raise HTTPException(status_code=400, detail="id_variedad es requerido")

    id_especie = data.get("id_especie")
    id_pmg = data.get("id_pmg")
    fecha_plant = data.get("fecha_plantacion")
    observaciones = data.get("observaciones", "")

    # Support single or multiple positions
    pos_ids = data.get("posicion_ids", [])
    if not pos_ids and data.get("id_posicion"):
        pos_ids = [data["id_posicion"]]
    if not pos_ids:
        raise HTTPException(status_code=400, detail="Debe indicar id_posicion o posicion_ids")

    posiciones = (
        db.query(PosicionTestBlock)
        .filter(
            PosicionTestBlock.id_posicion.in_(pos_ids),
            PosicionTestBlock.id_testblock == id,
        )
        .all()
    )

    vacias = [p for p in posiciones if p.estado in ("vacia", None, "baja")]
    if not vacias:
        raise HTTPException(status_code=400, detail="No hay posiciones disponibles en la seleccion")

    created = 0
    for pos in vacias:
        # Deactivate old plant if exists (for baja positions)
        old_plantas = db.query(Planta).filter(Planta.id_posicion == pos.id_posicion).all()
        for old_p in old_plantas:
            if old_p.activa:
                old_p.activa = False
                old_p.fecha_baja = utcnow()
                old_p.motivo_baja = "Alta directa (reemplazo)"
            if old_p.codigo == pos.codigo_unico:
                old_p.codigo = f"{pos.codigo_unico}_prev_{old_p.id_planta}"
        db.flush()

        planta = Planta(
            codigo=pos.codigo_unico,
            id_posicion=pos.id_posicion,
            id_variedad=id_variedad,
            id_portainjerto=id_portainjerto,
            id_especie=id_especie,
            id_pmg=id_pmg,
            fecha_alta=utcnow(),
            observaciones=observaciones,
            usuario_creacion=user.username,
        )
        db.add(planta)
        db.flush()

        estado_anterior = pos.estado
        pos.estado = "alta"
        pos.id_variedad = id_variedad
        pos.id_portainjerto = id_portainjerto
        pos.id_pmg = id_pmg
        pos.fecha_alta = utcnow()
        pos.fecha_plantacion = utcnow()
        pos.usuario_alta = user.username
        pos.observaciones = observaciones

        hist = HistorialPosicion(
            id_posicion=pos.id_posicion,
            id_planta=planta.id_planta,
            accion="alta_directa",
            estado_anterior=estado_anterior,
            estado_nuevo="alta",
            usuario=user.username,
        )
        db.add(hist)
        created += 1

    db.commit()
    return {"created": created, "message": f"{created} plantas dadas de alta directamente (sin inventario)"}


@router.post("/{id}/alta-masiva")
def api_alta_masiva(
    id: int,
    data: AltaMasivaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return alta_masiva(db, id, data, usuario=user.username)


@router.post("/{id}/baja")
def api_baja(
    id: int,
    data: BajaPlantaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return baja_planta(db, id, data, usuario=user.username)


@router.post("/{id}/baja-masiva")
def api_baja_masiva(
    id: int,
    data: BajaMasivaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return baja_masiva(db, id, data, usuario=user.username)


@router.post("/{id}/replante")
def api_replante(
    id: int,
    data: ReplantePlantaRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return replante_planta(db, id, data, usuario=user.username)


# ── Historial global del testblock ────────────────────────────────────────
@router.get("/{id}/historial")
def api_historial_testblock(
    id: int,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Return recent history across ALL positions of this testblock."""
    pos_ids = [
        p.id_posicion
        for p in db.query(PosicionTestBlock.id_posicion)
        .filter(PosicionTestBlock.id_testblock == id)
        .all()
    ]
    if not pos_ids:
        return []
    rows = (
        db.query(HistorialPosicion)
        .filter(HistorialPosicion.id_posicion.in_(pos_ids))
        .order_by(HistorialPosicion.fecha.desc())
        .limit(limit)
        .all()
    )
    # Enrich with codigo_unico for each position
    pos_map = {
        p.id_posicion: p.codigo_unico
        for p in db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_posicion.in_([r.id_posicion for r in rows]))
        .all()
    }
    result = []
    for r in rows:
        d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        d["codigo_posicion"] = pos_map.get(r.id_posicion, f"POS-{r.id_posicion}")
        result.append(d)
    return result


# ── Carga mixta (multi-variedad en un testblock) ────────────────────────
@router.post("/{id}/carga-mixta", status_code=201)
def carga_mixta(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Mixed load: create one lot per variety/rootstock group and plant positions.
    Body: { grupos: [{id_variedad, id_portainjerto?, posicion_ids}], id_especie?, id_pmg?, ... }
    """
    from app.services.testblock_service import plantar_en_posicion
    from app.models.inventario import InventarioVivero, MovimientoInventario
    from app.routes.inventario import _generar_codigo_lote
    from datetime import date

    tb = db.query(TestBlock).filter(TestBlock.id_testblock == id).first()
    if not tb:
        raise HTTPException(status_code=404, detail="TestBlock no encontrado")

    grupos = data.get("grupos", [])
    if not grupos:
        raise HTTPException(status_code=400, detail="Se requiere al menos un grupo")

    resultados = []
    total = 0

    for grupo in grupos:
        gvar = grupo.get("id_variedad")
        gpi = grupo.get("id_portainjerto")
        gpos_ids = grupo.get("posicion_ids", [])
        if not gvar or not gpos_ids:
            continue

        posiciones = (
            db.query(PosicionTestBlock)
            .filter(PosicionTestBlock.id_posicion.in_(gpos_ids), PosicionTestBlock.id_testblock == id)
            .all()
        )
        if not posiciones:
            continue

        cantidad = len(posiciones)

        # Generate lot code
        class _D:
            pass
        fd = _D()
        fd.id_especie = data.get("id_especie")
        fd.id_variedad = gvar
        fd.id_portainjerto = gpi
        codigo = _generar_codigo_lote(db, fd)

        lote = InventarioVivero(
            codigo_lote=codigo,
            id_variedad=gvar,
            id_portainjerto=gpi,
            id_especie=data.get("id_especie"),
            id_pmg=data.get("id_pmg"),
            tipo_planta=data.get("tipo_planta"),
            tipo_injertacion=data.get("tipo_injertacion"),
            cantidad_inicial=cantidad,
            cantidad_actual=0,
            cantidad_minima=0,
            fecha_ingreso=date.today(),
            ano_plantacion=data.get("ano_plantacion") or date.today().year,
            estado="plantado",
            observaciones=data.get("observaciones") or f"Carga mixta TB {tb.codigo}",
        )
        db.add(lote)
        db.flush()

        for pos in posiciones:
            plantar_en_posicion(
                db, pos,
                id_variedad=gvar,
                id_portainjerto=gpi,
                id_especie=data.get("id_especie"),
                id_pmg=data.get("id_pmg"),
                id_lote=lote.id_inventario,
                accion="carga_inicial",
                usuario=user.username,
            )

        mov = MovimientoInventario(
            id_inventario=lote.id_inventario,
            tipo="CARGA_INICIAL",
            cantidad=cantidad,
            saldo_anterior=cantidad,
            saldo_nuevo=0,
            motivo=f"Carga mixta TB {tb.codigo}",
            referencia_destino=tb.codigo,
            usuario=user.username,
        )
        db.add(mov)

        resultados.append({"codigo_lote": codigo, "variedad": gvar, "portainjerto": gpi, "plantas": cantidad})
        total += cantidad

    db.commit()
    return {"testblock": tb.codigo, "grupos": len(resultados), "total_plantas": total, "detalle": resultados}


# ── Etapa (formacion / produccion) por planta ─────────────────────────────
@router.put("/{id}/etapa")
def api_cambiar_etapa(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Cambiar etapa de plantas por posicion_ids o por id_lote.

    Body: { etapa: "formacion"|"produccion", posicion_ids: [int] }
       o: { etapa: "formacion"|"produccion", id_lote: int }
    """
    etapa = data.get("etapa")
    if etapa not in ("formacion", "produccion"):
        raise HTTPException(status_code=400, detail="etapa debe ser 'formacion' o 'produccion'")

    tb = db.query(TestBlock).filter(TestBlock.id_testblock == id).first()
    if not tb:
        raise HTTPException(status_code=404, detail="TestBlock no encontrado")

    pos_ids = data.get("posicion_ids", [])
    id_lote = data.get("id_lote")

    if id_lote and not pos_ids:
        # Buscar posiciones del lote en este testblock
        posiciones = (
            db.query(PosicionTestBlock)
            .filter(
                PosicionTestBlock.id_testblock == id,
                PosicionTestBlock.id_lote == id_lote,
                PosicionTestBlock.estado.in_(["alta", "replante"]),
            )
            .all()
        )
        pos_ids = [p.id_posicion for p in posiciones]
    elif not pos_ids:
        raise HTTPException(status_code=400, detail="Debe indicar posicion_ids o id_lote")

    # Actualizar etapa de las plantas asociadas
    updated = 0
    for pos_id in pos_ids:
        pos = db.get(PosicionTestBlock, pos_id)
        if not pos or pos.id_testblock != id or pos.estado not in ("alta", "replante"):
            continue
        planta = (
            db.query(Planta)
            .filter(Planta.id_posicion == pos_id, Planta.activa == True)
            .first()
        )
        if planta:
            old_etapa = planta.etapa or "formacion"
            planta.etapa = etapa
            planta.fecha_modificacion = datetime.utcnow()
            planta.usuario_modificacion = user.username
            updated += 1
            # Register in historial
            hist = HistorialPosicion(
                id_posicion=pos_id,
                id_planta=planta.id_planta,
                accion="etapa",
                estado_anterior=old_etapa,
                estado_nuevo=etapa,
                motivo=f"Cambio etapa {old_etapa} → {etapa}",
                usuario=user.username,
            )
            db.add(hist)

    db.commit()
    return {"updated": updated, "etapa": etapa, "message": f"{updated} plantas actualizadas a {etapa}"}


# ── Configuracion ──────────────────────────────────────────────────────────
@router.post("/{id}/agregar-hilera")
def api_agregar_hilera(
    id: int,
    data: AgregarHileraRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    count = agregar_hilera(db, id, data.num_posiciones, usuario=user.username)
    return {"count": count}


@router.post("/{id}/agregar-posiciones")
def api_agregar_posiciones(
    id: int,
    data: AgregarPosicionesRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    count = agregar_posiciones(db, id, data.hilera, data.cantidad, usuario=user.username)
    return {"count": count}


@router.delete("/{id}/eliminar-hilera/{hilera}")
def api_eliminar_hilera(
    id: int,
    hilera: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return eliminar_hilera(db, id, hilera, usuario=user.username)


@router.post("/{id}/eliminar-posiciones")
def api_eliminar_posiciones(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    ids = data.get("ids_posiciones", [])
    if not ids:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="ids_posiciones requerido")
    return eliminar_posiciones(db, id, ids, usuario=user.username)


# ── Inventario vinculado ───────────────────────────────────────────────────
@router.get("/{id}/pendientes")
def api_pendientes(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    tb = crud.get_by_id(db, TestBlock, id)
    return (
        db.query(InventarioTestBlock)
        .filter(InventarioTestBlock.id_cuartel == tb.id_cuartel, InventarioTestBlock.estado == "pendiente")
        .all()
    )


@router.get("/{id}/inventario-disponible")
def api_inventario_disponible(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(InventarioVivero)
        .filter(InventarioVivero.estado == "disponible", InventarioVivero.cantidad_actual > 0)
        .all()
    )


@router.get("/{id}/inventario")
def api_inventario_testblock(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Inventario asignado al testblock (post-despacho, en standby o completado)."""
    return get_inventario_testblock(db, id)


# ── Mapa satelital ─────────────────────────────────────────────────────────
@router.get("/{id}/mapa")
def get_mapa(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Get testblock map data: center coords, polygon, zoom, and position coords."""
    tb = db.get(TestBlock, id)
    if not tb:
        raise HTTPException(status_code=404, detail="TestBlock no encontrado")

    posiciones = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == id)
        .order_by(PosicionTestBlock.hilera, PosicionTestBlock.posicion)
        .all()
    )

    return {
        "latitud": tb.latitud,
        "longitud": tb.longitud,
        "poligono_coords": json.loads(tb.poligono_coords) if tb.poligono_coords else None,
        "zoom_nivel": tb.zoom_nivel or 18,
        "posiciones": [
            {
                "id_posicion": p.id_posicion,
                "hilera": p.hilera,
                "posicion": p.posicion,
                "estado": p.estado,
                "codigo_unico": p.codigo_unico,
                "id_variedad": p.id_variedad,
            }
            for p in posiciones
        ],
    }


@router.put("/{id}/mapa")
def update_mapa(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Save testblock map configuration: polygon corners and zoom."""
    tb = db.get(TestBlock, id)
    if not tb:
        raise HTTPException(status_code=404, detail="TestBlock no encontrado")
    if "poligono_coords" in data:
        tb.poligono_coords = json.dumps(data["poligono_coords"])
    if "zoom_nivel" in data:
        tb.zoom_nivel = data["zoom_nivel"]
    if "latitud" in data:
        tb.latitud = data["latitud"]
    if "longitud" in data:
        tb.longitud = data["longitud"]
    db.commit()
    return {"ok": True}


# ── Historial ──────────────────────────────────────────────────────────────
posiciones_router = APIRouter(prefix="/posiciones", tags=["TestBlock"])


@posiciones_router.get("/{id}/historial")
def api_historial(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(HistorialPosicion)
        .filter(HistorialPosicion.id_posicion == id)
        .order_by(HistorialPosicion.fecha.desc())
        .all()
    )


@posiciones_router.patch("/{id}/observaciones")
def api_update_observaciones(
    id: int,
    data: UpdatePosicionObservaciones,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo", "laboratorio")),
):
    pos = crud.get_by_id(db, PosicionTestBlock, id)
    pos.observaciones = data.observaciones
    db.commit()
    db.refresh(pos)
    return {"ok": True, "observaciones": pos.observaciones}


# ── Editar posicion ────────────────────────────────────────────────────────
@posiciones_router.put("/{id}")
def api_update_posicion(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Update editable fields on a position and its active plant."""
    pos = db.get(PosicionTestBlock, id)
    if not pos:
        raise HTTPException(status_code=404, detail="Posicion no encontrada")

    # Fields editable on the position itself
    POS_FIELDS = ("conduccion", "marco_plantacion", "observaciones", "protegida")
    for f in POS_FIELDS:
        if f in data:
            setattr(pos, f, data[f])
    pos.fecha_modificacion = datetime.utcnow()

    # If there's an active plant, also update plant-level fields
    planta = (
        db.query(Planta)
        .filter(Planta.id_posicion == id, Planta.activa == True)
        .first()
    )
    if planta:
        PLANTA_FIELDS = ("conduccion", "marco_plantacion", "ano_plantacion",
                         "metodo_injertacion", "tipo_patron", "observaciones")
        for f in PLANTA_FIELDS:
            if f in data:
                setattr(planta, f, data[f])
        planta.fecha_modificacion = datetime.utcnow()
        planta.usuario_modificacion = user.username

    db.commit()
    db.refresh(pos)
    return {c.name: getattr(pos, c.name) for c in pos.__table__.columns}


# ── Eliminar posicion ─────────────────────────────────────────────────────
@posiciones_router.delete("/{id}")
def api_delete_posicion(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Delete a position. Only allowed if estado is vacia or baja (no active plant)."""
    pos = db.get(PosicionTestBlock, id)
    if not pos:
        raise HTTPException(status_code=404, detail="Posicion no encontrada")
    if pos.estado == "alta":
        raise HTTPException(status_code=400, detail="No se puede eliminar una posicion con planta activa. Primero dar de baja.")
    # Delete any historial
    db.query(HistorialPosicion).filter(HistorialPosicion.id_posicion == id).delete()
    db.delete(pos)
    db.commit()
    return {"detail": "Posicion eliminada"}


# ── Evidencia (foto) para posicion ─────────────────────────────────────────
@posiciones_router.post("/{id}/evidencia", status_code=201)
def api_add_evidencia_posicion(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo", "operador")),
):
    """Add photo evidence to a position (for any action: alta, baja, fenologia, etc.)."""
    pos = db.get(PosicionTestBlock, id)
    if not pos:
        raise HTTPException(status_code=404, detail="Posicion no encontrada")

    # Store in historial as a special "evidencia" entry
    hist = HistorialPosicion(
        id_posicion=id,
        id_planta=data.get("id_planta"),
        accion="evidencia",
        estado_anterior=pos.estado,
        estado_nuevo=pos.estado,
        motivo=data.get("descripcion", "Foto de evidencia"),
        usuario=user.username,
    )
    db.add(hist)
    db.flush()

    # Also store the image if using EvidenciaLabor model
    # For simplicity, store base64 in the historial motivo or as a separate record
    imagen = data.get("imagen_base64")
    if imagen:
        from app.models.evidencia import EvidenciaLabor
        # Find linked labor if any
        id_ejecucion = data.get("id_ejecucion")
        if not id_ejecucion:
            # Try to find a pending labor for this position
            from app.models.laboratorio import EjecucionLabor
            labor = (
                db.query(EjecucionLabor)
                .filter(EjecucionLabor.id_posicion == id, EjecucionLabor.estado == "planificada")
                .first()
            )
            id_ejecucion = labor.id_ejecucion if labor else None

        if id_ejecucion:
            ev = EvidenciaLabor(
                id_ejecucion=id_ejecucion,
                tipo="foto",
                descripcion=data.get("descripcion", "Foto de campo"),
                imagen_base64=imagen,
                usuario=user.username,
            )
            db.add(ev)

    db.commit()
    return {"detail": "Evidencia registrada", "id_historial": hist.id_historial}


@posiciones_router.get("/{id}/evidencias")
def api_get_evidencias_posicion(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Get evidence photos linked to labores of this position."""
    from app.models.evidencia import EvidenciaLabor
    from app.models.laboratorio import EjecucionLabor

    ejecuciones = db.query(EjecucionLabor.id_ejecucion).filter(EjecucionLabor.id_posicion == id).all()
    ejec_ids = [e[0] for e in ejecuciones]
    if not ejec_ids:
        return []
    return (
        db.query(EvidenciaLabor)
        .filter(EvidenciaLabor.id_ejecucion.in_(ejec_ids))
        .order_by(EvidenciaLabor.fecha_creacion.desc())
        .limit(20)
        .all()
    )


# ── QR ─────────────────────────────────────────────────────────────────────
@posiciones_router.get("/{id}/qr")
def api_qr_posicion(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    pos = crud.get_by_id(db, PosicionTestBlock, id)
    import qrcode
    img = qrcode.make(pos.codigo_unico)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@router.get("/{id}/qr-pdf")
def api_qr_pdf(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    import qrcode

    posiciones = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == id)
        .order_by(PosicionTestBlock.hilera, PosicionTestBlock.posicion)
        .all()
    )

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    w, h = letter
    x, y = 50, h - 80
    col_w, row_h = 120, 120

    for pos in posiciones:
        img = qrcode.make(pos.codigo_unico)
        img_buf = io.BytesIO()
        img.save(img_buf, format="PNG")
        img_buf.seek(0)

        from reportlab.lib.utils import ImageReader
        c.drawImage(ImageReader(img_buf), x, y - 80, 80, 80)
        c.setFont("Helvetica", 7)
        c.drawString(x, y - 90, pos.codigo_unico)

        x += col_w
        if x > w - col_w:
            x = 50
            y -= row_h
            if y < 80:
                c.showPage()
                y = h - 80

    c.save()
    buf.seek(0)

    filename = f"qr_testblock_{id}.pdf"

    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/{id}/qr-hilera/{hilera}")
def api_qr_hilera(
    id: int,
    hilera: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader
    import qrcode

    posiciones = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.id_testblock == id, PosicionTestBlock.hilera == hilera)
        .order_by(PosicionTestBlock.posicion)
        .all()
    )

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    w, h = letter
    x, y = 50, h - 80
    col_w, row_h = 120, 120

    for pos in posiciones:
        img = qrcode.make(pos.codigo_unico)
        img_buf = io.BytesIO()
        img.save(img_buf, format="PNG")
        img_buf.seek(0)

        c.drawImage(ImageReader(img_buf), x, y - 80, 80, 80)
        c.setFont("Helvetica", 7)
        c.drawString(x, y - 90, pos.codigo_unico)

        x += col_w
        if x > w - col_w:
            x = 50
            y -= row_h
            if y < 80:
                c.showPage()
                y = h - 80

    c.save()
    buf.seek(0)

    filename = f"qr_tb{id}_h{hilera}.pdf"

    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})


# ── Crear lote desde testblock ────────────────────────────────────────────
@router.post("/{id}/crear-lote")
def crear_lote_desde_testblock(
    id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Crear un lote de inventario directamente desde un TestBlock y asignar plantas.

    Body: {
        id_variedad: int (requerido),
        id_portainjerto: int (requerido),
        posicion_ids: [int] (requerido - posiciones a asignar),
        id_especie: int (opcional),
        id_pmg: int (opcional),
        fecha_plantacion: str (opcional, default hoy),
        observaciones: str (opcional)
    }
    """
    from datetime import date as _date
    from app.models.testblock import Planta
    from app.models.variedades_extra import TestblockEvento
    from app.core.utils import utcnow
    import logging

    logger = logging.getLogger(__name__)

    try:
        tb = db.query(TestBlock).filter(TestBlock.id_testblock == id).first()
        if not tb:
            raise HTTPException(status_code=404, detail="TestBlock no encontrado")

        id_variedad = data.get("id_variedad")
        id_portainjerto = data.get("id_portainjerto")
        posicion_ids = data.get("posicion_ids", [])

        if not id_variedad:
            raise HTTPException(status_code=400, detail="id_variedad es requerido")
        if not id_portainjerto:
            raise HTTPException(status_code=400, detail="id_portainjerto es requerido")
        if not posicion_ids:
            raise HTTPException(status_code=400, detail="posicion_ids es requerido (lista de IDs)")

        id_especie = data.get("id_especie")
        id_pmg = data.get("id_pmg")
        observaciones = data.get("observaciones", "")

        # --- 1. Generate unique codigo_lote ---
        from sqlalchemy import func as sa_func
        max_seq = (
            db.query(sa_func.count(InventarioVivero.id_inventario))
            .filter(InventarioVivero.codigo_lote.like(f"LOT-TB{id}-%"))
            .scalar()
        ) or 0
        seq = max_seq + 1
        codigo_lote = f"LOT-TB{id}-{seq:04d}"

        # Ensure uniqueness
        while db.query(InventarioVivero).filter(InventarioVivero.codigo_lote == codigo_lote).first():
            seq += 1
            codigo_lote = f"LOT-TB{id}-{seq:04d}"

        # --- 2. Create inventario_vivero record ---
        lote = InventarioVivero(
            codigo_lote=codigo_lote,
            id_variedad=id_variedad,
            id_portainjerto=id_portainjerto,
            id_especie=id_especie,
            id_pmg=id_pmg,
            tipo_planta="TESTBLOCK_DIRECTO",
            cantidad_inicial=len(posicion_ids),
            cantidad_actual=0,  # already planted
            cantidad_minima=0,
            cantidad_comprometida=0,
            fecha_ingreso=utcnow().date(),
            estado="plantado",
            observaciones=observaciones or f"Lote creado desde TestBlock {tb.codigo}",
            fecha_creacion=utcnow(),
        )
        db.add(lote)
        db.flush()  # get lote.id_inventario

        # --- 3. Process each position ---
        posiciones = (
            db.query(PosicionTestBlock)
            .filter(
                PosicionTestBlock.id_posicion.in_(posicion_ids),
                PosicionTestBlock.id_testblock == id,
            )
            .all()
        )

        if not posiciones:
            raise HTTPException(status_code=400, detail="Ninguna posicion encontrada para este testblock")

        plantas_creadas = 0
        for pos in posiciones:
            # Deactivate old plant if exists
            old_plantas = db.query(Planta).filter(Planta.id_posicion == pos.id_posicion).all()
            for old_p in old_plantas:
                if old_p.activa:
                    old_p.activa = False
                    old_p.fecha_baja = utcnow()
                    old_p.motivo_baja = "Reemplazo por lote directo"
                if old_p.codigo and old_p.codigo == pos.codigo_unico:
                    old_p.codigo = f"{pos.codigo_unico}_prev_{old_p.id_planta}"
            db.flush()

            # Create new plant
            planta = Planta(
                codigo=pos.codigo_unico,
                id_posicion=pos.id_posicion,
                id_variedad=id_variedad,
                id_portainjerto=id_portainjerto,
                id_especie=id_especie,
                id_pmg=id_pmg,
                id_lote_origen=lote.id_inventario,
                fecha_alta=utcnow(),
                observaciones=observaciones,
                usuario_creacion=user.username,
            )
            db.add(planta)
            db.flush()

            # Update position
            estado_anterior = pos.estado
            pos.estado = "alta"
            pos.id_variedad = id_variedad
            pos.id_portainjerto = id_portainjerto
            pos.id_pmg = id_pmg
            pos.id_lote = lote.id_inventario
            pos.fecha_alta = utcnow()
            pos.fecha_plantacion = utcnow()
            pos.usuario_alta = user.username
            pos.observaciones = observaciones

            # Historial
            hist = HistorialPosicion(
                id_posicion=pos.id_posicion,
                id_planta=planta.id_planta,
                accion="crear_lote",
                estado_anterior=estado_anterior,
                estado_nuevo="alta",
                usuario=user.username,
            )
            db.add(hist)
            plantas_creadas += 1

        # --- 4. Log testblock_eventos ---
        try:
            evento = TestblockEvento(
                id_testblock=id,
                id_posicion=posicion_ids[0] if posicion_ids else 0,
                tipo_evento="crear_lote",
                datos_despues=json.dumps({
                    "codigo_lote": codigo_lote,
                    "id_inventario": lote.id_inventario,
                    "plantas_creadas": plantas_creadas,
                    "posicion_ids": posicion_ids,
                }),
                created_by=user.username,
            )
            db.add(evento)
        except Exception as evt_err:
            logger.warning(f"Could not log testblock_evento: {evt_err}")

        db.commit()

        return {
            "lote_id": lote.id_inventario,
            "codigo_lote": codigo_lote,
            "plantas_creadas": plantas_creadas,
            "message": f"Lote {codigo_lote} creado con {plantas_creadas} plantas",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creando lote desde testblock {id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear lote: {str(e)}. La base de datos puede estar temporalmente inaccesible.",
        )



# ── Lotes de un testblock (agrupados desde posiciones) ───────────────────
@router.get("/{id}/lotes")
def get_lotes_testblock(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Obtener lotes vinculados a un testblock desde sus posiciones."""
    from sqlalchemy import func as sa_func, distinct
    import logging

    logger = logging.getLogger(__name__)

    try:
        tb = db.query(TestBlock).filter(TestBlock.id_testblock == id).first()
        if not tb:
            raise HTTPException(status_code=404, detail="TestBlock no encontrado")

        # Get distinct lote IDs from positions
        lote_ids = (
            db.query(distinct(PosicionTestBlock.id_lote))
            .filter(
                PosicionTestBlock.id_testblock == id,
                PosicionTestBlock.id_lote.isnot(None),
            )
            .all()
        )
        lote_ids = [lid[0] for lid in lote_ids]

        if not lote_ids:
            return []

        lotes = (
            db.query(InventarioVivero)
            .filter(InventarioVivero.id_inventario.in_(lote_ids))
            .all()
        )

        result = []
        for lote in lotes:
            # Count positions using this lote in this testblock
            count = (
                db.query(sa_func.count(PosicionTestBlock.id_posicion))
                .filter(
                    PosicionTestBlock.id_testblock == id,
                    PosicionTestBlock.id_lote == lote.id_inventario,
                )
                .scalar()
            ) or 0

            result.append({
                "id_inventario": lote.id_inventario,
                "codigo_lote": lote.codigo_lote,
                "id_variedad": lote.id_variedad,
                "id_portainjerto": lote.id_portainjerto,
                "tipo_planta": lote.tipo_planta,
                "cantidad_inicial": lote.cantidad_inicial,
                "cantidad_actual": lote.cantidad_actual,
                "estado": lote.estado,
                "posiciones_en_tb": count,
                "fecha_ingreso": lote.fecha_ingreso,
                "observaciones": lote.observaciones,
            })

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo lotes de testblock {id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener lotes: {str(e)}. La base de datos puede estar temporalmente inaccesible.",
        )
