"""Motor de clustering para clasificacion de calidad de carozos.

Implementa el algoritmo de suma de bandas (Band-Sum Approach) del sistema legado:
1. Para cada grupo de medicion, se calculan metricas agregadas:
   brix_mean, acidez_first, mejillas_mean, punto_debil_mean
2. Cada metrica se clasifica en bandas 1-4 segun umbrales por especie
3. Se suman las 4 bandas (rango 4-16)
4. Se asigna cluster: 4-5=C1(excelente), 6-8=C2(bueno), 9-11=C3(regular), 12-16=C4(deficiente)

Este modulo es una funcion pura: no tiene dependencia de base de datos.
Las escrituras a BD se realizan en la capa de rutas/servicios.
"""

from datetime import date
from typing import Optional


# ---------------------------------------------------------------------------
# Reglas de umbrales por especie / categoria
# ---------------------------------------------------------------------------
# Formato: {"metrica": [umbral_banda1, umbral_banda2, umbral_banda3]}
#
# Metricas normales (mayor = mejor):
#   valor >= t1 → B1, >= t2 → B2, >= t3 → B3, else B4
#
# Acidez (menor = mejor, invertida):
#   valor <= t1 → B1, <= t2 → B2, <= t3 → B3, else B4

RULES: dict[str, dict[str, list[float]]] = {
    # ── Ciruela ──────────────────────────────────────────────────────
    "ciruela_candy": {
        # peso > 60g
        "brix": [18.0, 16.0, 14.0],
        "mejillas": [9.0, 7.0, 6.0],
        "punto": [7.0, 5.0, 4.0],
        "acidez": [0.60, 0.81, 1.00],
    },
    "ciruela_cherry": {
        # peso <= 60g
        "brix": [21.0, 18.0, 15.0],
        "mejillas": [6.0, 5.0, 4.0],
        "punto": [6.0, 4.5, 3.0],
        "acidez": [0.60, 0.81, 1.00],
    },
    # ── Nectarina Amarilla ───────────────────────────────────────────
    "nectarina_amarilla_muy_temprana": {
        "brix": [13.0, 10.0, 9.0],
        "mejillas": [14.0, 12.0, 9.0],
        "punto": [9.0, 8.0, 7.0],
        "acidez": [0.60, 0.81, 1.00],
    },
    "nectarina_amarilla_temprana": {
        "brix": [13.0, 11.0, 9.0],
        "mejillas": [14.0, 12.0, 9.0],
        "punto": [9.0, 8.0, 7.0],
        "acidez": [0.60, 0.81, 1.00],
    },
    "nectarina_amarilla_tardia": {
        "brix": [14.0, 12.0, 10.0],
        "mejillas": [14.0, 12.0, 9.0],
        "punto": [9.0, 8.0, 7.0],
        "acidez": [0.60, 0.81, 1.00],
    },
    # ── Nectarina Blanca ─────────────────────────────────────────────
    "nectarina_blanca_muy_temprana": {
        "brix": [13.0, 10.0, 9.0],
        "mejillas": [13.0, 11.0, 9.0],
        "punto": [9.0, 8.0, 7.0],
        "acidez": [0.60, 0.81, 1.00],
    },
    "nectarina_blanca_temprana": {
        "brix": [13.0, 11.0, 9.0],
        "mejillas": [13.0, 11.0, 9.0],
        "punto": [9.0, 8.0, 7.0],
        "acidez": [0.60, 0.81, 1.00],
    },
    "nectarina_blanca_tardia": {
        "brix": [14.0, 12.0, 10.0],
        "mejillas": [13.0, 11.0, 9.0],
        "punto": [9.0, 8.0, 7.0],
        "acidez": [0.60, 0.81, 1.00],
    },
    # ── Durazno Amarillo (similar a nectarina amarilla, pulpa mas blanda) ─
    "durazno_amarillo_muy_temprana": {
        "brix": [12.0, 10.0, 8.0],
        "mejillas": [12.0, 10.0, 8.0],
        "punto": [8.0, 7.0, 6.0],
        "acidez": [0.55, 0.75, 0.95],
    },
    "durazno_amarillo_temprana": {
        "brix": [13.0, 11.0, 9.0],
        "mejillas": [12.0, 10.0, 8.0],
        "punto": [8.0, 7.0, 6.0],
        "acidez": [0.55, 0.75, 0.95],
    },
    "durazno_amarillo_tardia": {
        "brix": [14.0, 12.0, 10.0],
        "mejillas": [12.0, 10.0, 8.0],
        "punto": [8.0, 7.0, 6.0],
        "acidez": [0.55, 0.75, 0.95],
    },
    # ── Durazno Blanco ───────────────────────────────────────────────
    "durazno_blanco_muy_temprana": {
        "brix": [12.0, 10.0, 8.0],
        "mejillas": [11.0, 9.0, 7.0],
        "punto": [8.0, 7.0, 6.0],
        "acidez": [0.55, 0.75, 0.95],
    },
    "durazno_blanco_temprana": {
        "brix": [13.0, 11.0, 9.0],
        "mejillas": [11.0, 9.0, 7.0],
        "punto": [8.0, 7.0, 6.0],
        "acidez": [0.55, 0.75, 0.95],
    },
    "durazno_blanco_tardia": {
        "brix": [14.0, 12.0, 10.0],
        "mejillas": [11.0, 9.0, 7.0],
        "punto": [8.0, 7.0, 6.0],
        "acidez": [0.55, 0.75, 0.95],
    },
    # ── Paraguayo (fruto plano, alto brix, pulpa blanda) ─────────────
    "paraguayo_default": {
        "brix": [15.0, 13.0, 11.0],
        "mejillas": [10.0, 8.0, 6.0],
        "punto": [7.0, 6.0, 5.0],
        "acidez": [0.50, 0.70, 0.90],
    },
    # ── Platerina (nectarina plana, similar a paraguayo pero mas firme) ─
    "platerina_default": {
        "brix": [15.0, 13.0, 11.0],
        "mejillas": [12.0, 10.0, 8.0],
        "punto": [8.0, 7.0, 6.0],
        "acidez": [0.55, 0.75, 0.95],
    },
    # ── Damasco ──────────────────────────────────────────────────────
    "damasco_default": {
        "brix": [14.0, 12.0, 10.0],
        "mejillas": [8.0, 6.0, 4.0],
        "punto": [6.0, 5.0, 4.0],
        "acidez": [0.80, 1.00, 1.30],
    },
}

# Etiquetas de cluster para respuestas de la API
CLUSTER_LABELS: dict[int, str] = {
    1: "Excelente",
    2: "Bueno",
    3: "Regular",
    4: "Deficiente",
}

# Rangos de suma de bandas por cluster
CLUSTER_RANGES: dict[int, dict] = {
    1: {"min": 4, "max": 5, "label": "Excelente"},
    2: {"min": 6, "max": 8, "label": "Bueno"},
    3: {"min": 9, "max": 11, "label": "Regular"},
    4: {"min": 12, "max": 16, "label": "Deficiente"},
}


# ---------------------------------------------------------------------------
# Funciones puras de clasificacion
# ---------------------------------------------------------------------------

def clasificar_banda(valor: Optional[float], thresholds: list[float], inverted: bool = False) -> int:
    """Clasifica un valor en banda 1-4 segun umbrales.

    Args:
        valor: Valor numerico de la metrica. None se trata como peor banda (4).
        thresholds: Lista de 3 umbrales [t1, t2, t3] en orden descendente
                    (para metricas normales) o ascendente (para invertidas).
        inverted: True para acidez (menor = mejor).

    Returns:
        Banda 1 (mejor) a 4 (peor).

    Metricas normales (mayor = mejor):
        valor >= t1 → B1, >= t2 → B2, >= t3 → B3, else B4

    Metricas invertidas (menor = mejor, ej: acidez):
        valor <= t1 → B1, <= t2 → B2, <= t3 → B3, else B4
    """
    if valor is None:
        return 4  # peor banda por defecto

    if inverted:
        if valor <= thresholds[0]:
            return 1
        if valor <= thresholds[1]:
            return 2
        if valor <= thresholds[2]:
            return 3
        return 4
    else:
        if valor >= thresholds[0]:
            return 1
        if valor >= thresholds[1]:
            return 2
        if valor >= thresholds[2]:
            return 3
        return 4


def determinar_periodo_cosecha(color_pulpa: Optional[str], fecha: Optional[date]) -> str:
    """Determina periodo de cosecha de nectarina segun color de pulpa y fecha.

    Args:
        color_pulpa: Color de pulpa de la variedad ("blanca", "amarilla", etc.).
        fecha: Fecha de evaluacion/cosecha.

    Returns:
        Periodo: "muy_temprana", "temprana", o "tardia".

    Rangos para nectarina blanca:
        < 25 nov → muy_temprana, <= 15 dic → temprana, > 15 dic → tardia

    Rangos para nectarina amarilla (o default):
        < 22 nov → muy_temprana, <= 22 dic → temprana, > 22 dic → tardia
    """
    if not fecha:
        return "tardia"

    month_day = (fecha.month, fecha.day)

    if color_pulpa and "blanca" in color_pulpa.lower():
        if month_day < (11, 25):
            return "muy_temprana"
        if month_day <= (12, 15):
            return "temprana"
        return "tardia"
    else:
        # amarilla o default
        if month_day < (11, 22):
            return "muy_temprana"
        if month_day <= (12, 22):
            return "temprana"
        return "tardia"


def determinar_regla(
    especie: str,
    peso_promedio: Optional[float] = None,
    color_pulpa: Optional[str] = None,
    fecha_evaluacion: Optional[date] = None,
) -> str:
    """Determina el conjunto de reglas de umbrales a aplicar.

    Args:
        especie: Nombre de la especie (ej: "Ciruela", "Nectarin", "Durazno").
        peso_promedio: Peso promedio del fruto en gramos. Usado para
                       diferenciar ciruela candy (>60g) vs cherry (<=60g).
        color_pulpa: Color de pulpa para nectarinas/duraznos ("blanca" o "amarilla").
        fecha_evaluacion: Fecha de evaluacion para determinar periodo de cosecha.

    Returns:
        Clave de regla (ej: "ciruela_candy", "nectarina_amarilla_temprana").
        Retorna "ciruela_candy" como fallback si la especie no es reconocida.
    """
    esp = (especie or "").lower().strip()

    if "ciruela" in esp:
        if peso_promedio and peso_promedio > 60:
            return "ciruela_candy"
        return "ciruela_cherry"

    # "nectarin" matches both "Nectarina" and "Nectarin"
    if "nectarin" in esp:
        color = (color_pulpa or "amarilla").lower().strip()
        periodo = determinar_periodo_cosecha(color, fecha_evaluacion)
        color_key = "blanca" if "blanca" in color else "amarilla"
        return f"nectarina_{color_key}_{periodo}"

    if "durazno" in esp:
        color = (color_pulpa or "amarilla").lower().strip()
        periodo = determinar_periodo_cosecha(color, fecha_evaluacion)
        color_key = "blanco" if "blanca" in color else "amarillo"
        return f"durazno_{color_key}_{periodo}"

    if "paraguayo" in esp:
        return "paraguayo_default"

    if "platerina" in esp:
        return "platerina_default"

    if "damasco" in esp:
        return "damasco_default"

    # Fallback para especies no configuradas
    return "ciruela_candy"


def clasificar_medicion(
    brix: Optional[float],
    acidez: Optional[float],
    firmeza_mejillas: Optional[float],
    firmeza_punto_debil: Optional[float],
    regla: str,
) -> dict:
    """Clasifica un grupo de medicion en bandas y cluster.

    Aplica el algoritmo Band-Sum:
    1. Clasifica cada metrica en banda 1-4 segun umbrales de la regla
    2. Suma las 4 bandas (rango 4-16)
    3. Asigna cluster: 4-5 → C1, 6-8 → C2, 9-11 → C3, 12-16 → C4

    Args:
        brix: Grados brix promedio.
        acidez: Acidez (primera lectura o promedio).
        firmeza_mejillas: Firmeza de mejillas promedio.
        firmeza_punto_debil: Firmeza del punto mas debil (min de punta/quilla/hombro).
        regla: Clave de regla de umbrales (ej: "ciruela_candy").

    Returns:
        Diccionario con bandas individuales, suma, cluster y regla aplicada.
    """
    rules = RULES.get(regla, RULES["ciruela_candy"])

    banda_brix = clasificar_banda(brix, rules["brix"])
    banda_mejillas = clasificar_banda(firmeza_mejillas, rules["mejillas"])
    banda_punto = clasificar_banda(firmeza_punto_debil, rules["punto"])
    banda_acidez = clasificar_banda(acidez, rules["acidez"], inverted=True)

    suma = banda_brix + banda_mejillas + banda_punto + banda_acidez

    if suma <= 5:
        cluster = 1
    elif suma <= 8:
        cluster = 2
    elif suma <= 11:
        cluster = 3
    else:
        cluster = 4

    return {
        "banda_brix": banda_brix,
        "banda_firmeza": banda_mejillas,
        "banda_firmeza_punto": banda_punto,
        "banda_acidez": banda_acidez,
        "suma_bandas": suma,
        "cluster": cluster,
        "cluster_label": CLUSTER_LABELS[cluster],
        "regla_aplicada": regla,
    }


def calcular_mejillas_promedio(
    mejilla_1: Optional[float],
    mejilla_2: Optional[float],
) -> float:
    """Calcula el promedio de firmeza de mejillas.

    Si solo se tiene un valor, lo retorna directamente.
    Si ambos son None o 0, retorna 0.
    """
    vals = [v for v in [mejilla_1, mejilla_2] if v and v > 0]
    if not vals:
        return 0.0
    return sum(vals) / len(vals)


def calcular_punto_debil(
    punta: Optional[float],
    quilla: Optional[float],
    hombro: Optional[float],
) -> float:
    """Calcula el punto mas debil como el minimo de punta, quilla y hombro.

    Solo considera valores positivos. Si ninguno tiene valor, retorna 0.
    """
    vals = [v for v in [punta, quilla, hombro] if v and v > 0]
    if not vals:
        return 0.0
    return min(vals)
