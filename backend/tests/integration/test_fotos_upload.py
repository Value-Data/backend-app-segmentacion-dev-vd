"""FIX-FOTOS (partial): upload validation hardening.

- Block non-image MIMEs (exe, pdf, script) → 415.
- Block oversized files → 413.
- Block empty files → 422.
- Allow jpeg/png/webp under 5 MB → 201.
"""

import io

import pytest

from app.models.maestras import Especie
from app.models.variedades import Variedad


API = "/api/v1"


@pytest.fixture()
def variedad(db):
    esp = Especie(codigo="CER", nombre="Cerezo", activo=True)
    db.add(esp)
    db.commit()
    db.refresh(esp)
    v = Variedad(codigo="CER-FOTO-UP", nombre="Test Var",
                 id_especie=esp.id_especie, activo=True)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def test_upload_jpeg_ok(client, auth_headers, variedad):
    files = {"file": ("t.jpg", io.BytesIO(b"\xff\xd8\xff" + b"\x00" * 100), "image/jpeg")}
    r = client.post(f"{API}/variedades/{variedad.id_variedad}/fotos",
                    files=files, headers=auth_headers)
    assert r.status_code in (200, 201), r.text


def test_upload_png_ok(client, auth_headers, variedad):
    files = {"file": ("t.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100), "image/png")}
    r = client.post(f"{API}/variedades/{variedad.id_variedad}/fotos",
                    files=files, headers=auth_headers)
    assert r.status_code in (200, 201), r.text


def test_upload_webp_ok(client, auth_headers, variedad):
    files = {"file": ("t.webp", io.BytesIO(b"RIFF" + b"\x00" * 100 + b"WEBP"), "image/webp")}
    r = client.post(f"{API}/variedades/{variedad.id_variedad}/fotos",
                    files=files, headers=auth_headers)
    assert r.status_code in (200, 201), r.text


def test_upload_pdf_rejected_415(client, auth_headers, variedad):
    files = {"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4" + b"\x00" * 100), "application/pdf")}
    r = client.post(f"{API}/variedades/{variedad.id_variedad}/fotos",
                    files=files, headers=auth_headers)
    assert r.status_code == 415
    assert "tipo de archivo" in r.json()["detail"].lower()


def test_upload_exe_rejected_415(client, auth_headers, variedad):
    files = {"file": ("bad.exe", io.BytesIO(b"MZ" + b"\x00" * 100), "application/x-msdownload")}
    r = client.post(f"{API}/variedades/{variedad.id_variedad}/fotos",
                    files=files, headers=auth_headers)
    assert r.status_code == 415


def test_upload_oversized_rejected_413(client, auth_headers, variedad):
    """6 MB jpeg payload → 413."""
    payload = b"\xff\xd8\xff" + b"\x00" * (6 * 1024 * 1024)
    files = {"file": ("big.jpg", io.BytesIO(payload), "image/jpeg")}
    r = client.post(f"{API}/variedades/{variedad.id_variedad}/fotos",
                    files=files, headers=auth_headers)
    assert r.status_code == 413
    assert "demasiado grande" in r.json()["detail"].lower()


def test_upload_empty_rejected_422(client, auth_headers, variedad):
    files = {"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")}
    r = client.post(f"{API}/variedades/{variedad.id_variedad}/fotos",
                    files=files, headers=auth_headers)
    assert r.status_code == 422
    assert "vacío" in r.json()["detail"].lower()
