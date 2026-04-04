"""Laboratorio business logic: mediciones, cluster classification, KPIs.

La clasificacion por cluster utiliza el motor de clustering (clustering_service)
basado en el algoritmo Band-Sum del sistema legado. El motor es una funcion pura
que no depende de la base de datos — las escrituras a BD se realizan aqui.
"""

import math
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.laboratorio import (
    MedicionLaboratorio,
    ClasificacionCluster,
    UmbralCalidad,
)
from app.models.testblock import PosicionTestBlock, Planta
from app.models.variedades import Variedad
from app.models.maestras import Especie
from app.schemas.laboratorio import MedicionCreate
from app.services.clustering_service import (
    clasificar_medicion as _clasificar_bandas,
    calcular_mejillas_promedio,
    calcular_punto_debil,
    determinar_regla,
)


def _resolver_especie_y_variedad(
    db: Session,
    id_planta: Optional[int],
    id_posicion: Optional[int],
    id_especie_direct: Optional[int] = None,
    id_variedad_direct: Optional[int] = None,
) -> tuple[Optional[Especie], Optional[Variedad], Optional[Planta]]:
    """Resuelve la especie, variedad y planta asociadas a una medicion.

    Prioridad de resolucion:
    1. FKs directas (id_especie_direct, id_variedad_direct) — del formulario
    2. Desde id_planta (planta -> variedad -> especie)
    3. Desde id_posicion (posicion -> variedad -> especie)

    Retorna (especie, variedad, planta) — cualquiera puede ser None.
    """
    planta_obj: Optional[Planta] = None
    variedad_obj: Optional[Variedad] = None
    especie_obj: Optional[Especie] = None

    # 1. FKs directas tienen prioridad
    if id_especie_direct:
        especie_obj = db.query(Especie).filter(
            Especie.id_especie == id_especie_direct
        ).first()
    if id_variedad_direct:
        variedad_obj = db.query(Variedad).filter(
            Variedad.id_variedad == id_variedad_direct
        ).first()

    # 2. Resolver desde planta
    if id_planta:
        planta_obj = db.query(Planta).filter(Planta.id_planta == id_planta).first()
        if planta_obj and not variedad_obj and planta_obj.id_variedad:
            variedad_obj = db.query(Variedad).filter(
                Variedad.id_variedad == planta_obj.id_variedad
            ).first()
        if planta_obj and not especie_obj and planta_obj.id_especie:
            especie_obj = db.query(Especie).filter(
                Especie.id_especie == planta_obj.id_especie
            ).first()

    # 3. Resolver desde posicion
    if not variedad_obj and id_posicion:
        pos = db.query(PosicionTestBlock).filter(
            PosicionTestBlock.id_posicion == id_posicion
        ).first()
        if pos and pos.id_variedad:
            variedad_obj = db.query(Variedad).filter(
                Variedad.id_variedad == pos.id_variedad
            ).first()
            if variedad_obj and not especie_obj and variedad_obj.id_especie:
                especie_obj = db.query(Especie).filter(
                    Especie.id_especie == variedad_obj.id_especie
                ).first()

    return especie_obj, variedad_obj, planta_obj


def autoclasificar_medicion(
    db: Session,
    medicion: MedicionLaboratorio,
) -> Optional[ClasificacionCluster]:
    """Auto-clasifica una medicion usando el motor Band-Sum.

    Resuelve automaticamente la especie, variedad y color de pulpa
    desde las FKs directas, la planta o la posicion asociada a la medicion,
    y aplica la regla de umbrales correspondiente.

    Usa firmeza detallada (5 puntos) si esta disponible; si no, cae al
    campo generico ``firmeza``.

    Args:
        db: Sesion de base de datos.
        medicion: Medicion de laboratorio ya persistida (con id_medicion).

    Returns:
        ClasificacionCluster creada, o None si no se pudo resolver la especie.
    """
    especie_obj, variedad_obj, planta_obj = _resolver_especie_y_variedad(
        db,
        medicion.id_planta,
        medicion.id_posicion,
        id_especie_direct=medicion.id_especie,
        id_variedad_direct=medicion.id_variedad,
    )

    if not especie_obj:
        return None

    # Determinar color de pulpa: primero del campo directo, luego planta, luego variedad
    color_pulpa = None
    if medicion.color_pulpa:
        color_pulpa = medicion.color_pulpa
    elif planta_obj and hasattr(planta_obj, "color_pulpa") and planta_obj.color_pulpa:
        color_pulpa = planta_obj.color_pulpa
    elif variedad_obj and hasattr(variedad_obj, "color_pulpa") and variedad_obj.color_pulpa:
        color_pulpa = variedad_obj.color_pulpa

    # Determinar peso promedio para la distincion ciruela candy/cherry
    peso_promedio = float(medicion.peso) if medicion.peso else None

    # Fecha de evaluacion para determinar periodo de cosecha de nectarinas
    fecha_eval = medicion.fecha_cosecha or medicion.fecha_medicion

    # Resolver regla de umbrales
    regla = determinar_regla(
        especie=especie_obj.nombre,
        peso_promedio=peso_promedio,
        color_pulpa=color_pulpa,
        fecha_evaluacion=fecha_eval,
    )

    # Preparar valores de firmeza
    brix_val = float(medicion.brix) if medicion.brix is not None else None
    acidez_val = float(medicion.acidez) if medicion.acidez is not None else None

    # Firmeza detallada: usar mejillas y punto debil si hay datos de 5 puntos
    m1 = float(medicion.firmeza_mejilla_1) if medicion.firmeza_mejilla_1 is not None else None
    m2 = float(medicion.firmeza_mejilla_2) if medicion.firmeza_mejilla_2 is not None else None
    mejillas_val = calcular_mejillas_promedio(m1, m2) if (m1 is not None or m2 is not None) else None

    punta_val = float(medicion.firmeza_punta) if medicion.firmeza_punta is not None else None
    quilla_val = float(medicion.firmeza_quilla) if medicion.firmeza_quilla is not None else None
    hombro_val = float(medicion.firmeza_hombro) if medicion.firmeza_hombro is not None else None
    punto_debil_val = calcular_punto_debil(punta_val, quilla_val, hombro_val) if any(
        v is not None for v in [punta_val, quilla_val, hombro_val]
    ) else None

    # Fallback al campo generico "firmeza" si no hay datos detallados
    firmeza_val = float(medicion.firmeza) if medicion.firmeza is not None else None
    if mejillas_val is None or mejillas_val == 0.0:
        mejillas_val = firmeza_val
    if punto_debil_val is None or punto_debil_val == 0.0:
        punto_debil_val = firmeza_val

    # Clasificar
    result = _clasificar_bandas(
        brix=brix_val,
        acidez=acidez_val,
        firmeza_mejillas=mejillas_val,
        firmeza_punto_debil=punto_debil_val,
        regla=regla,
    )

    # Persistir clasificacion
    # NOTA: banda_calibre en la tabla almacena la banda de firmeza_punto_debil
    # (minimo de punta/quilla/hombro), NO calibre del fruto. Nombre legacy.
    clasif = ClasificacionCluster(
        id_medicion=medicion.id_medicion,
        cluster=result["cluster"],
        banda_brix=result["banda_brix"],
        banda_firmeza=result["banda_firmeza"],
        banda_acidez=result["banda_acidez"],
        banda_calibre=result["banda_firmeza_punto"],  # legacy name: stores firmeza punto debil band
        score_total=Decimal(str(result["suma_bandas"])),
        metodo="reglas_v2",
    )
    db.add(clasif)
    return clasif


# Mantener compatibilidad con el nombre anterior (usado internamente)
clasificar_medicion_legacy = autoclasificar_medicion


def crear_medicion(
    db: Session,
    data: MedicionCreate,
    usuario: str | None = None,
    *,
    auto_commit: bool = True,
) -> dict:
    """Crea una medicion de laboratorio y auto-clasifica si hay datos suficientes.

    Auto-calcula:
    - ``firmeza`` como promedio de mejillas si se proveen firmeza_mejilla_1/2.
    - ``calibre`` desde ``perimetro`` (calibre = perimetro / pi) si se provee perimetro
      y no se provee calibre directamente.

    Args:
        db: Sesion de base de datos.
        data: Datos de la medicion.
        usuario: Username del usuario que registra.
        auto_commit: Si True (default), hace commit automatico. Pasar False
            cuando el caller maneja la transaccion (ej. batch).

    Returns:
        Diccionario con la medicion creada y la clasificacion (si aplica).
    """
    # --- Auto-calculo de firmeza promedio (mejillas) ---
    firmeza = data.firmeza
    m1 = float(data.firmeza_mejilla_1) if data.firmeza_mejilla_1 is not None else None
    m2 = float(data.firmeza_mejilla_2) if data.firmeza_mejilla_2 is not None else None
    if (m1 is not None or m2 is not None) and firmeza is None:
        avg = calcular_mejillas_promedio(m1, m2)
        if avg > 0:
            firmeza = Decimal(str(round(avg, 1)))

    # --- Auto-calculo de calibre desde perimetro ---
    calibre = data.calibre
    if data.perimetro and calibre is None:
        calibre_val = float(data.perimetro) / math.pi
        calibre = Decimal(str(round(calibre_val, 2)))

    medicion = MedicionLaboratorio(
        id_posicion=data.id_posicion,
        id_planta=data.id_planta,
        temporada=data.temporada,
        fecha_medicion=data.fecha_medicion,
        fecha_cosecha=data.fecha_cosecha,
        brix=data.brix,
        acidez=data.acidez,
        firmeza=firmeza,
        calibre=calibre,
        peso=data.peso,
        color_pct=data.color_pct,
        cracking_pct=data.cracking_pct,
        observaciones=data.observaciones,
        usuario_registro=usuario,
        # Nuevos campos: firmeza detallada
        firmeza_punta=data.firmeza_punta,
        firmeza_quilla=data.firmeza_quilla,
        firmeza_hombro=data.firmeza_hombro,
        firmeza_mejilla_1=data.firmeza_mejilla_1,
        firmeza_mejilla_2=data.firmeza_mejilla_2,
        # Muestra y postcosecha
        n_muestra=data.n_muestra,
        periodo_almacenaje=data.periodo_almacenaje,
        perimetro=data.perimetro,
        pardeamiento=data.pardeamiento,
        traslucidez=data.traslucidez,
        gelificacion=data.gelificacion,
        harinosidad=data.harinosidad,
        color_pulpa=data.color_pulpa,
        # Agronomia y contexto de muestra
        raleo_frutos=data.raleo_frutos,
        rendimiento=data.rendimiento,
        repeticion=data.repeticion,
        # Color de cubrimiento
        color_0_30=data.color_0_30,
        color_30_50=data.color_30_50,
        color_50_75=data.color_50_75,
        color_75_100=data.color_75_100,
        color_total=data.color_total,
        # Distribucion de color
        color_verde=data.color_verde,
        color_crema=data.color_crema,
        color_amarillo=data.color_amarillo,
        color_full=data.color_full,
        color_dist_total=data.color_dist_total,
        # Total frutos por metrica postcosecha
        total_frutos_pardeamiento=data.total_frutos_pardeamiento,
        total_frutos_traslucidez=data.total_frutos_traslucidez,
        total_frutos_gelificacion=data.total_frutos_gelificacion,
        total_frutos_harinosidad=data.total_frutos_harinosidad,
        # FKs directas
        id_campo=data.id_campo,
        id_variedad=data.id_variedad,
        id_especie=data.id_especie,
        id_portainjerto=data.id_portainjerto,
    )
    db.add(medicion)
    db.flush()

    # Auto-trigger cluster classification con el motor Band-Sum
    clasif = autoclasificar_medicion(db, medicion)

    if auto_commit:
        db.commit()
        db.refresh(medicion)

    # Construir respuesta enriquecida con resultado de clasificacion
    result: dict = {
        "medicion": medicion,
    }
    if clasif:
        from app.services.clustering_service import CLUSTER_LABELS
        result["clasificacion"] = {
            "cluster": clasif.cluster,
            "cluster_label": CLUSTER_LABELS.get(clasif.cluster, ""),
            "banda_brix": clasif.banda_brix,
            "banda_firmeza": clasif.banda_firmeza,
            "banda_acidez": clasif.banda_acidez,
            "banda_firmeza_punto": clasif.banda_calibre,
            "score_total": float(clasif.score_total) if clasif.score_total else None,
        }
    else:
        result["clasificacion"] = None

    return result


def get_kpis(
    db: Session,
    testblock_id: int | None = None,
    temporada: str | None = None,
) -> dict:
    """Calcula KPIs de mediciones para un testblock y/o temporada."""
    q = db.query(MedicionLaboratorio)
    if testblock_id:
        pos_ids = [
            p.id_posicion
            for p in db.query(PosicionTestBlock.id_posicion).filter(
                PosicionTestBlock.id_testblock == testblock_id
            ).all()
        ]
        q = q.filter(MedicionLaboratorio.id_posicion.in_(pos_ids))
    if temporada:
        q = q.filter(MedicionLaboratorio.temporada == temporada)

    mediciones = q.all()
    if not mediciones:
        return {"total": 0}

    brix_vals = [float(m.brix) for m in mediciones if m.brix is not None]
    firmeza_vals = [float(m.firmeza) for m in mediciones if m.firmeza is not None]
    acidez_vals = [float(m.acidez) for m in mediciones if m.acidez is not None]
    calibre_vals = [float(m.calibre) for m in mediciones if m.calibre is not None]

    def _avg(vals):
        return round(sum(vals) / len(vals), 2) if vals else None

    return {
        "total": len(mediciones),
        "brix_promedio": _avg(brix_vals),
        "firmeza_promedio": _avg(firmeza_vals),
        "acidez_promedio": _avg(acidez_vals),
        "calibre_promedio": _avg(calibre_vals),
        "brix_min": min(brix_vals) if brix_vals else None,
        "brix_max": max(brix_vals) if brix_vals else None,
    }
