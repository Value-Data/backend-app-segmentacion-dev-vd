"""Conservative accent corrections for user-visible strings in frontend.

Rules:
- Only replace Capitalized words (first letter uppercase). Lowercase variants
  are almost always TS identifiers (keys, props, accessors) — never touch them.
- Only replace when the word is inside a string literal: preceded by " ' ` or
  whitespace, and followed by " ' ` , . : ; ! ? ) or whitespace.
- Excludes words that appear in TS interface/type names we know exist in this
  codebase (Fenologico/Tecnologico/Pais/Region).
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "frontend", "src")
EXTS = {".ts", ".tsx"}

# Capitalized-only replacements. Lowercase variants are never touched
# because those are TS identifiers/keys.
REPLACEMENTS = {
    "Catalogos": "Catálogos",
    "Catalogo": "Catálogo",
    "Geneticos": "Genéticos",
    "Genetico": "Genético",
    "Periodos": "Períodos",
    "Periodo": "Período",
    "Paises": "Países",
    "Repeticion": "Repetición",
    "Perimetro": "Perímetro",
    "Evaluacion": "Evaluación",
    "Distribucion": "Distribución",
    "Produccion": "Producción",
    "Codigo": "Código",
    "Republica": "República",
    "Segmentacion": "Segmentación",
    "Paginas": "Páginas",
    "Pagina": "Página",
}

# Precede: start-of-string + literal delim + space  → ["'`\s]
# Follow:  end delim + punctuation + space          → ["'`,.:;!?)\s]
PRE = r"(?<=[\"'` ])"
POST = r"(?=[\"'`,.:;!?\)\s])"


def build_patterns():
    return [(re.compile(PRE + re.escape(k) + POST), v) for k, v in REPLACEMENTS.items()]


patterns = build_patterns()


def process_file(path: str) -> tuple[int, dict[str, int]]:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    orig = content
    hits = {}
    for pat, rep in patterns:
        matches = pat.findall(content)
        if matches:
            hits[pat.pattern] = len(matches)
            content = pat.sub(rep, content)
    if content != orig:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return (1, hits)
    return (0, {})


changed_files = 0
total_replacements = 0
for dirpath, _, files in os.walk(SRC):
    for name in files:
        if os.path.splitext(name)[1] not in EXTS:
            continue
        path = os.path.join(dirpath, name)
        changed, hits = process_file(path)
        if changed:
            changed_files += 1
            n = sum(hits.values())
            total_replacements += n
            rel = os.path.relpath(path, ROOT)
            print(f"FIXED {rel}: {n} replacements")

print(f"\nTotal: {changed_files} files, {total_replacements} replacements.")
