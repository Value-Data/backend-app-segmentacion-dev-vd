"""Analisis routes: dashboard, paquetes tecnologicos, clusters."""

import time

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.sistema import Usuario
from app.models.analisis import PaqueteTecnologico
from app.models.laboratorio import ClasificacionCluster, MedicionLaboratorio
from app.models.testblock import PosicionTestBlock, Planta, TestBlock
from app.services.laboratorio_service import get_kpis

router = APIRouter(prefix="/analisis", tags=["Analisis"])

# In-memory cache for the heavy dashboard query (TTL 5 min)
_dashboard_cache: dict[str, dict] = {}
_DASHBOARD_TTL = 300  # seconds


@router.get("/dashboard")
def dashboard(
    temporada: str | None = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    cache_key = f"dashboard:{temporada or '__all__'}"
    now = time.time()
    cached = _dashboard_cache.get(cache_key)
    if cached and now < cached["expires"]:
        return cached["data"]

    kpis = get_kpis(db, temporada=temporada)
    # Plantas activas = posiciones con estado "alta" (coincide con suma de pos_alta
    # en listado de testblocks). Antes contaba Planta.activa=True lo cual daba un
    # número distinto (plantas vivas en BD, incluyendo algunas fuera de testblocks).
    total_plantas = (
        db.query(PosicionTestBlock)
        .filter(PosicionTestBlock.estado == "alta")
        .count()
    )
    total_testblocks = db.query(TestBlock).filter(TestBlock.activo == True).count()
    total_posiciones = db.query(PosicionTestBlock).count()

    # Cluster distribution
    q = db.query(ClasificacionCluster)
    if temporada:
        med_ids = [m.id_medicion for m in db.query(MedicionLaboratorio.id_medicion).filter(
            MedicionLaboratorio.temporada == temporada
        ).all()]
        q = q.filter(ClasificacionCluster.id_medicion.in_(med_ids))
    clusters = q.all()
    cluster_dist = {}
    for c in clusters:
        cl = c.cluster or 0
        cluster_dist[cl] = cluster_dist.get(cl, 0) + 1

    result = {
        "kpis": kpis,
        "total_plantas_activas": total_plantas,
        "total_testblocks": total_testblocks,
        "total_posiciones": total_posiciones,
        "cluster_distribution": cluster_dist,
    }

    _dashboard_cache[cache_key] = {"data": result, "expires": now + _DASHBOARD_TTL}
    return result


@router.get("/paquetes")
def list_paquetes(
    temporada: str | None = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    q = db.query(PaqueteTecnologico)
    if temporada:
        q = q.filter(PaqueteTecnologico.temporada == temporada)
    return q.all()


@router.post("/paquetes/generar")
def generar_paquetes(
    temporada: str | None = Query(None, description="Si se omite, se generan paquetes para todas las temporadas con clasificaciones"),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Genera paquetes tecnológicos (recomendación por variedad/temporada).

    Agrupa clasificaciones_cluster por (id_variedad, temporada) desde
    mediciones_laboratorio y calcula promedios + decisión agronómica.

    Decisión:
      - %C1+C2 >= 70% → "Adoptar"
      - 50% <= %C1+C2 < 70% → "Evaluar otra temporada"
      - %C1+C2 < 50% → "Rechazar"
    """
    from sqlalchemy import func
    from decimal import Decimal
    from datetime import datetime as _dt

    # Borramos paquetes previos de la(s) temporada(s) a regenerar
    del_q = db.query(PaqueteTecnologico)
    if temporada:
        del_q = del_q.filter(PaqueteTecnologico.temporada == temporada)
    deleted = del_q.delete(synchronize_session=False)

    # Base query: mediciones con clasificación, agrupadas por variedad + temporada
    base = (
        db.query(
            MedicionLaboratorio.id_variedad,
            MedicionLaboratorio.temporada,
            func.count(ClasificacionCluster.id_clasificacion).label("n"),
            func.avg(MedicionLaboratorio.brix).label("brix_avg"),
            func.min(MedicionLaboratorio.brix).label("brix_min"),
            func.max(MedicionLaboratorio.brix).label("brix_max"),
            func.avg(MedicionLaboratorio.firmeza).label("firm_avg"),
            func.avg(MedicionLaboratorio.acidez).label("ac_avg"),
            func.avg(MedicionLaboratorio.calibre).label("cal_avg"),
            func.avg(ClasificacionCluster.score_total).label("score_avg"),
            func.sum(
                func.iif(ClasificacionCluster.cluster == 1, 1, 0)
            ).label("n_c1"),
            func.sum(
                func.iif(ClasificacionCluster.cluster == 2, 1, 0)
            ).label("n_c2"),
            func.sum(
                func.iif(ClasificacionCluster.cluster == 3, 1, 0)
            ).label("n_c3"),
            func.sum(
                func.iif(ClasificacionCluster.cluster == 4, 1, 0)
            ).label("n_c4"),
        )
        .join(ClasificacionCluster, ClasificacionCluster.id_medicion == MedicionLaboratorio.id_medicion)
        .filter(MedicionLaboratorio.id_variedad.isnot(None))
        .filter(MedicionLaboratorio.temporada.isnot(None))
        .group_by(MedicionLaboratorio.id_variedad, MedicionLaboratorio.temporada)
    )
    if temporada:
        base = base.filter(MedicionLaboratorio.temporada == temporada)

    rows = base.all()
    created = 0
    for r in rows:
        total = r.n_c1 + r.n_c2 + r.n_c3 + r.n_c4
        if total == 0:
            continue
        pct_premium = (r.n_c1 + r.n_c2) / total * 100
        if pct_premium >= 70:
            decision = "Adoptar"
        elif pct_premium >= 50:
            decision = "Evaluar otra temporada"
        else:
            decision = "Rechazar"

        # Cluster predominante (mayor count)
        counts = [(1, r.n_c1), (2, r.n_c2), (3, r.n_c3), (4, r.n_c4)]
        cluster_pred = max(counts, key=lambda x: x[1])[0]

        def _dec(v):
            return Decimal(str(round(float(v), 2))) if v is not None else None

        paquete = PaqueteTecnologico(
            id_variedad=r.id_variedad,
            temporada=r.temporada,
            total_posiciones=None,
            posiciones_evaluadas=total,
            cluster_predominante=cluster_pred,
            brix_promedio=_dec(r.brix_avg),
            brix_min=_dec(r.brix_min),
            brix_max=_dec(r.brix_max),
            firmeza_promedio=_dec(r.firm_avg),
            acidez_promedio=_dec(r.ac_avg),
            calibre_promedio=_dec(r.cal_avg),
            score_promedio=_dec(r.score_avg),
            decision=decision,
            recomendacion=f"{total} mediciones. {pct_premium:.1f}% Premium (C1+C2). Decisión: {decision}.",
            fecha_generacion=_dt.utcnow(),
        )
        db.add(paquete)
        created += 1

    db.commit()
    # Invalidar cache del dashboard para reflejar el cambio
    _dashboard_cache.clear()
    return {
        "eliminados_previos": deleted,
        "generados": created,
        "temporada": temporada or "todas",
    }


@router.get("/clusters")
def list_clusters(
    testblock: int | None = Query(None),
    temporada: str | None = Query(None),
    especie: int | None = Query(None),
    limit: int = Query(5000, ge=1, le=50000),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Lista clasificaciones cluster enriquecidas con especie/variedad/testblock.

    Parámetros:
      testblock — filtra por id_testblock (via posiciones)
      temporada — filtra por temporada de la medición
      especie   — filtra por id_especie
      limit     — máximo de filas (default 5000)
    """
    from app.models.variedades import Variedad
    from app.models.maestras import Especie

    q = (
        db.query(
            ClasificacionCluster,
            MedicionLaboratorio.temporada,
            MedicionLaboratorio.id_variedad,
            MedicionLaboratorio.id_especie,
            MedicionLaboratorio.fecha_medicion,
            Variedad.nombre.label("variedad_nombre"),
            Especie.nombre.label("especie_nombre"),
            PosicionTestBlock.id_testblock,
        )
        .join(MedicionLaboratorio, MedicionLaboratorio.id_medicion == ClasificacionCluster.id_medicion)
        .outerjoin(Variedad, Variedad.id_variedad == MedicionLaboratorio.id_variedad)
        .outerjoin(Especie, Especie.id_especie == MedicionLaboratorio.id_especie)
        .outerjoin(PosicionTestBlock, PosicionTestBlock.id_posicion == MedicionLaboratorio.id_posicion)
    )
    if testblock:
        q = q.filter(PosicionTestBlock.id_testblock == testblock)
    if temporada:
        q = q.filter(MedicionLaboratorio.temporada == temporada)
    if especie:
        q = q.filter(MedicionLaboratorio.id_especie == especie)

    rows = q.order_by(ClasificacionCluster.id_clasificacion.desc()).limit(limit).all()

    def to_dict(r):
        c = r[0]
        return {
            "id_clasificacion": c.id_clasificacion,
            "id_medicion": c.id_medicion,
            "cluster": c.cluster,
            "cluster_label": c.cluster_label,
            "banda_brix": c.banda_brix,
            "banda_firmeza": c.banda_firmeza,
            "banda_calibre": c.banda_calibre,
            "score_total": float(c.score_total) if c.score_total is not None else None,
            "metodo": c.metodo,
            "temporada": r[1],
            "id_variedad": r[2],
            "id_especie": r[3],
            "fecha_medicion": str(r[4]) if r[4] else None,
            "variedad": r[5] or "-",
            "especie": r[6] or "-",
            "id_testblock": r[7],
        }

    return [to_dict(r) for r in rows]
