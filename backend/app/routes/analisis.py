"""Analisis routes: dashboard, paquetes tecnologicos, clusters."""

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


@router.get("/dashboard")
def dashboard(
    temporada: str | None = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    kpis = get_kpis(db, temporada=temporada)
    total_plantas = db.query(Planta).filter(Planta.activa == True).count()
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

    return {
        "kpis": kpis,
        "total_plantas_activas": total_plantas,
        "total_testblocks": total_testblocks,
        "total_posiciones": total_posiciones,
        "cluster_distribution": cluster_dist,
    }


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


@router.get("/clusters")
def list_clusters(
    testblock: int | None = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    q = db.query(ClasificacionCluster)
    if testblock:
        med_ids = []
        pos_ids = [p.id_posicion for p in db.query(PosicionTestBlock.id_posicion).filter(
            PosicionTestBlock.id_testblock == testblock
        ).all()]
        meds = db.query(MedicionLaboratorio.id_medicion).filter(
            MedicionLaboratorio.id_posicion.in_(pos_ids)
        ).all()
        med_ids = [m.id_medicion for m in meds]
        q = q.filter(ClasificacionCluster.id_medicion.in_(med_ids))
    return q.all()
