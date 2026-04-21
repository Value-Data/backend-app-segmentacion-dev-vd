"""Decode literal \\uXXXX escapes in frontend source to real UTF-8 chars."""
import os
import re

FRONTEND_SRC = os.path.join(os.path.dirname(__file__), "..", "frontend", "src")

# Files known to contain literal \uXXXX escapes that render wrong in JSX text
TARGETS = [
    "pages/Home.tsx",
    "pages/inventario/InventarioPage.tsx",
    "components/layout/Sidebar.tsx",
    "pages/laboratorio/ReglasClusterPage.tsx",
]

ESCAPE_RE = re.compile(r"\\u([0-9a-fA-F]{4})")


def decode(match: re.Match) -> str:
    return chr(int(match.group(1), 16))


total = 0
for rel in TARGETS:
    path = os.path.join(FRONTEND_SRC, rel)
    if not os.path.exists(path):
        print(f"SKIP {rel}")
        continue
    with open(path, "r", encoding="utf-8") as f:
        orig = f.read()
    new = ESCAPE_RE.sub(decode, orig)
    if new != orig:
        count = len(ESCAPE_RE.findall(orig))
        with open(path, "w", encoding="utf-8") as f:
            f.write(new)
        print(f"FIXED {rel}: {count} escapes")
        total += count
    else:
        print(f"NOOP  {rel}")

print(f"TOTAL: {total}")
