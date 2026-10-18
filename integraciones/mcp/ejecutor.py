"""Ejecutor PLACEHOLDER de la puerta de salida MCP. Solo biblioteca estándar.

No llama a HubSpot, WhatsApp, correo ni redes. Hace dos cosas:

1. `registrar(...)`: escribe una línea en `registro_salidas.jsonl` por CADA decisión (se ejecute o no).
   Esa línea es el registro que en producción se escribiría como nota en el registro de HubSpot.
2. `ejecutar(...)`: simula el envío. Aquí iría la llamada a la API de HubSpot / WhatsApp / correo / redes,
   con las llaves que en producción vivirían solo en este servidor.

El archivo de registro se puede cambiar con la variable de entorno VOBO_REGISTRO (ruta del .jsonl).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

REGISTRO_POR_DEFECTO = Path(__file__).resolve().parent / "registro_salidas.jsonl"


def ruta_registro() -> Path:
    return Path(os.environ.get("VOBO_REGISTRO") or REGISTRO_POR_DEFECTO)


def registrar(
    *,
    request_id: Optional[str],
    herramienta: str,
    decision: str,
    razones: list[str],
    ejecutada: bool,
    modo: str,
    hubspot_object_id: Optional[str] = None,
    falla: Optional[str] = None,
) -> dict:
    """Agrega una línea al registro y la devuelve. Esta línea es el registro que se escribiría como nota en HubSpot."""
    linea = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "request_id": request_id,
        "herramienta": herramienta,
        "hubspot_object_id": hubspot_object_id,
        "decision": decision,
        "razones": razones,
        "ejecutada": ejecutada,
        "modo": modo,
    }
    if falla:
        linea["falla"] = falla
    ruta = ruta_registro()
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("a", encoding="utf-8") as f:
        f.write(json.dumps(linea, ensure_ascii=False) + "\n")
    return linea


def ejecutar(herramienta: str, accion: dict) -> str:
    """PLACEHOLDER: aquí iría la llamada a la API de HubSpot / WhatsApp / correo / redes.

    No envía nada. Devuelve una descripción de lo que se habría enviado.
    """
    return f"[placeholder] {herramienta}: {accion.get('tipo_accion')} por «{accion.get('canal')}» a {accion.get('destinatarios')} destinatario(s)"
