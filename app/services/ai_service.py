"""AI analysis service using Azure OpenAI."""

from app.core.config import get_settings


def get_ai_analysis(context: str, question: str) -> str:
    """Send context + question to Azure OpenAI and return analysis.

    Args:
        context: Summary of agronomic data (varieties, lab results, etc.).
        question: User question or default analysis request.

    Returns:
        AI-generated analysis text, or an error/config message.
    """
    settings = get_settings()

    if not settings.AZURE_OPENAI_API_KEY or settings.AZURE_OPENAI_API_KEY == "tu_api_key":
        return "AI no configurada. Configure AZURE_OPENAI_API_KEY en .env"

    try:
        from openai import AzureOpenAI

        client = AzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
        )
        response = client.chat.completions.create(
            model=settings.AZURE_OPENAI_DEPLOYMENT,
            temperature=0.3,
            max_tokens=3000,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres un experto agronomo senior en fruticultura chilena, especialista en "
                        "evaluacion de variedades de carozos (cerezas, ciruelas, nectarinas). "
                        "Analiza los datos proporcionados y genera un informe narrativo completo. "
                        "Incluye: 1) Resumen ejecutivo, 2) Estado actual de la variedad/lote/testblock, "
                        "3) Hallazgos clave de las mediciones de laboratorio, "
                        "4) Observaciones de las visitas de campo (bitacora), "
                        "5) Recomendaciones tecnicas concretas para la proxima temporada. "
                        "Usa un tono profesional pero accesible. Escribe en espanol."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Datos:\n{context}\n\nPregunta: {question}",
                },
            ],
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error AI: {str(e)[:200]}"
