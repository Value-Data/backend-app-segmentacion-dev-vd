"""Text sanitization helpers for user input persisted to DB.

Strips HTML tags and suspicious attributes to prevent stored XSS
(e.g. <script>, <img onerror=...>). Safe for plain-text fields like
titles, descriptions, notes.
"""

import bleach


def clean_text(value: str | None) -> str | None:
    """Strip all HTML/JS from a free-text field. None/empty passthrough."""
    if value is None:
        return None
    stripped = bleach.clean(value, tags=[], attributes={}, strip=True)
    return stripped.strip() or None
