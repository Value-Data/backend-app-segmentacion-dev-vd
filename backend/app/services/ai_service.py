"""AI analysis service using Azure OpenAI — generates professional agronomic reports."""

from app.core.config import get_settings

SYSTEM_PROMPT = """Eres el jefe del Departamento de Desarrollo Varietal y Genetico de Garces Fruit, una empresa lider en fruticultura chilena. Generas informes de evaluacion de variedades para la toma de decisiones comerciales y agronomicas.

Tu analisis debe ser:
- PROFESIONAL: como un informe del Departamento Desarrollo Varietal y Genetico de Garces Fruit
- ORIENTADO A DECISIONES: cada seccion debe terminar con una recomendacion concreta
- VENDEDOR: destaca las fortalezas de las variedades, pero siendo honesto con las debilidades
- BASADO EN DATOS: cita numeros especificos (peso, calibre, firmeza, brix, acidez)
- COMPARATIVO: cuando sea posible, compara con estandares de la industria

ESTRUCTURA DEL INFORME:

## Resumen Ejecutivo
3-4 lineas con la conclusion principal y recomendacion clave.

## Evaluacion de Cosecha
- Peso promedio, diametro, distribucion de calibre (PC, XL, J, 2J, 3J+)
- Firmeza (Shore/UD) y su implicancia para transporte y vida de estante
- Solidos solubles (Brix) y acidez — relacion dulzor/acidez
- Color de cubrimiento y color de fondo
- Interpretacion: "Un calibre predominante 2J-3J indica potencial premium de exportacion"

## Comportamiento por Campo/Temporada
- Diferencias entre campos si hay multiples
- Tendencia entre temporadas si hay datos historicos
- "En Santa Margarita el calibre fue 15% superior vs Las Vertientes"

## Susceptibilidad y Defectos
- Incidencia de pitting, cracking, decoloracion, pardeamiento
- Evaluacion de pedicelos (deshidratacion)
- "Susceptibilidad a pitting del 12% requiere atencion en manejo de cosecha"

## Evaluacion Poscosecha (si aplica)
- Comportamiento a N dias de frio + ambiente
- Open box: bueno/regular/malo
- Defectos emergentes post-frio
- Vida de estante estimada

## Recomendaciones
1. **Para plantacion**: continuar/ampliar/reducir superficie
2. **Para manejo**: ajustes en cosecha, poda, raleo
3. **Para comercializacion**: ventanas de cosecha, mercados objetivo
4. **Para proxima temporada**: acciones especificas

Escribe en espanol. Usa formato Markdown. Se conciso pero completo."""


class AIError(Exception):
    """Clase base para errores del servicio AI con clasificación."""
    def __init__(self, kind: str, detail: str):
        super().__init__(detail)
        self.kind = kind  # "config" | "connection" | "auth" | "quota" | "timeout" | "other"
        self.detail = detail


def get_ai_analysis(context: str, question: str) -> str:
    """Send context + question to Azure OpenAI and return professional analysis.

    Args:
        context: Summary of agronomic data (varieties, lab results, etc.).
        question: User question or default analysis request.

    Returns:
        AI-generated analysis text.

    Raises:
        AIError — with `.kind` one of: config/connection/auth/quota/timeout/other.
    """
    settings = get_settings()

    if not settings.AZURE_OPENAI_API_KEY or settings.AZURE_OPENAI_API_KEY == "tu_api_key":
        raise AIError("config", "AZURE_OPENAI_API_KEY no está configurada en el servidor.")
    if not settings.AZURE_OPENAI_ENDPOINT:
        raise AIError("config", "AZURE_OPENAI_ENDPOINT no está configurado.")

    try:
        from openai import AzureOpenAI
        from openai import (
            APIConnectionError as _Conn,
            AuthenticationError as _Auth,
            RateLimitError as _Rate,
            APITimeoutError as _Timeout,
        )
    except ImportError:
        raise AIError("config", "Paquete openai no instalado en el servidor.")

    try:
        client = AzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            timeout=60.0,
            max_retries=2,
        )
        response = client.chat.completions.create(
            model=settings.AZURE_OPENAI_DEPLOYMENT,
            temperature=0.3,
            max_tokens=4000,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Datos del sistema Garces Fruit:\n\n{context}\n\n"
                        f"Solicitud: {question}\n\n"
                        "Genera un informe profesional completo siguiendo la estructura indicada. "
                        "Cita datos especificos del contexto proporcionado."
                    ),
                },
            ],
        )
        return response.choices[0].message.content or ""
    except _Conn as e:
        raise AIError(
            "connection",
            f"No se pudo conectar a Azure OpenAI. Verifica endpoint '{settings.AZURE_OPENAI_ENDPOINT}' y conectividad de red. ({str(e)[:120]})",
        )
    except _Auth as e:
        raise AIError("auth", f"Credenciales inválidas. Verifica AZURE_OPENAI_API_KEY. ({str(e)[:120]})")
    except _Rate as e:
        raise AIError("quota", f"Cuota Azure OpenAI excedida. ({str(e)[:120]})")
    except _Timeout as e:
        raise AIError("timeout", f"Timeout del servicio AI. ({str(e)[:120]})")
    except Exception as e:
        raise AIError("other", f"{type(e).__name__}: {str(e)[:200]}")
