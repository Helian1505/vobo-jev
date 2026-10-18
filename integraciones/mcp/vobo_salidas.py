"""vobo_salidas: puerta de salida MCP para los agentes de 30X.

Cada herramienta de salida (correo masivo, WhatsApp, redes, HubSpot) consulta a VoBo ANTES de ejecutar:

    PERMITIR     -> ejecuta (con el ejecutor placeholder) y devuelve «Enviado» con el request_id.
    PEDIR VOBO   -> NO ejecuta. Queda pendiente de visto bueno humano; el aviso a Slack lo manda el servidor de
                    VoBo (webhook), no esta puerta.
    BLOQUEAR     -> NO ejecuta. Devuelve las razones.

FALLA CERRADA: la consulta reutiliza integraciones/python/vobo_gate.py (`consultar`), que convierte cualquier falla
(red, tiempo agotado, HTTP distinto de 200, decisión desconocida) en PEDIR VOBO. Esta puerta no repite esa lógica.

La puerta no usa ningún modelo: solo arma la acción con el contrato de VoBo y la manda. VoBo es quien usa JEV.

Configuración por entorno:
    VOBO_URL       por defecto https://vobo-jev.vercel.app
    VOBO_API_KEY   opcional; si está, se usa la ruta protegida /api/v1/evaluate
    VOBO_TIMEOUT   segundos (por defecto 5)
    VOBO_SOMBRA=1  modo sombra: consulta y registra, pero ejecuta siempre
    VOBO_REGISTRO  ruta del registro .jsonl (por defecto registro_salidas.jsonl junto a este archivo)

Correr (transporte stdio):
    python integraciones/mcp/vobo_salidas.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Union
from zoneinfo import ZoneInfo

_AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI))
sys.path.insert(0, str(_AQUI.parent / "python"))

import ejecutor  # noqa: E402
from vobo_gate import BLOQUEAR, PEDIR_VOBO, PERMITIR, Veredicto, consultar  # noqa: E402

RUTA_CON_CLAVE = "/api/v1/evaluate"
MAX_ID_HUBSPOT = 20  # largo máximo de perfil_id en src/lib/vobo/accion-schema.ts

# El Python de python.org en macOS no trae certificados raíz: sin esto, toda llamada HTTPS falla (y la puerta,
# por falla cerrada, pediría VoBo para todo). Si `certifi` está instalado y nadie fijó SSL_CERT_FILE, se usa.
if not os.environ.get("SSL_CERT_FILE"):
    try:
        import certifi

        os.environ["SSL_CERT_FILE"] = certifi.where()
    except ImportError:
        pass


def _hora_bogota() -> str:
    return datetime.now(ZoneInfo("America/Bogota")).strftime("%H:%M")


def _ruta() -> Optional[str]:
    """Con VOBO_API_KEY se usa la ruta protegida; si no, `consultar` resuelve VOBO_EVALUATE_PATH o /api/evaluate."""
    if os.environ.get("VOBO_EVALUATE_PATH"):
        return None
    return RUTA_CON_CLAVE if os.environ.get("VOBO_API_KEY") else None


def _sin_vacios(accion: dict) -> dict:
    return {k: v for k, v in accion.items() if v is not None}


def _razones(v: Veredicto) -> list[str]:
    """Las razones vienen en el resumen de aprobación como viñetas «• …»; si no hay, el titular."""
    lineas = [l[1:].strip() for l in (v.resumen_aprobacion or "").splitlines() if l.startswith("•")]
    if lineas:
        return lineas
    return [v.motivo] if v.motivo else []


def pasar_por_vobo(herramienta: str, accion: dict, hubspot_object_id: Optional[str] = None) -> dict:
    """Consulta a VoBo, registra la decisión y ejecuta solo si corresponde. Devuelve lo que ve el agente."""
    accion = _sin_vacios(accion)
    sombra = os.environ.get("VOBO_SOMBRA") == "1"
    veredicto = consultar(accion, ruta=_ruta())
    razones = _razones(veredicto)
    se_ejecuta = sombra or veredicto.decision == PERMITIR

    ejecutor.registrar(
        request_id=veredicto.request_id,
        herramienta=herramienta,
        hubspot_object_id=hubspot_object_id,
        decision=veredicto.decision,
        razones=razones,
        ejecutada=se_ejecuta,
        modo="sombra" if sombra else "normal",
        falla=veredicto.falla,
    )

    respuesta = {
        "decision": veredicto.decision,
        "request_id": veredicto.request_id,
        "razones": razones,
        "ejecutada": se_ejecuta,
    }
    if se_ejecuta:
        respuesta["resultado"] = ejecutor.ejecutar(herramienta, accion)
        respuesta["estado"] = "Enviado" if veredicto.decision == PERMITIR else f"Enviado en modo sombra (VoBo dijo {veredicto.decision})"
    elif veredicto.decision == BLOQUEAR:
        respuesta["estado"] = "No se envió: VoBo bloqueó la acción."
    else:  # PEDIR VOBO, incluida la falla cerrada
        respuesta["estado"] = (
            "No se envió: quedó pendiente de visto bueno humano. "
            "El aviso a la persona que aprueba lo manda el servidor de VoBo."
        )
        if veredicto.fallo_cerrado:
            respuesta["falla"] = veredicto.falla
    return respuesta


# ---------------------------------------------------------------------------------------------------------------
# Herramientas. Son funciones normales (se prueban sin levantar MCP); crear_servidor() las registra en MCP.
# ---------------------------------------------------------------------------------------------------------------


def enviar_correo_masivo(
    texto: str,
    destinatarios: int,
    segmento_declarado: str,
    hora_envio: str,
    programa_ofrecido: Optional[str] = None,
    audiencia_id: Optional[str] = None,
    canal: str = "correo_oficial",
) -> dict:
    """Envía un correo masivo. Pasa SIEMPRE por VoBo antes de salir.

    destinatarios: cuántas personas lo reciben. segmento_declarado: founders, ejecutivos, equipos_tecnicos,
    estudiantes o comunidad_general. hora_envio: HH:MM (24 h, Bogotá). audiencia_id: p. ej. «A3».
    """
    accion = {
        "tipo_accion": "correo_masivo",
        "canal": canal,
        "destinatarios": destinatarios,
        "segmento_declarado": segmento_declarado,
        "hora_envio": hora_envio,
        "texto": texto,
        "programa_ofrecido": programa_ofrecido,
        "audiencia_id": audiencia_id,
    }
    return pasar_por_vobo("enviar_correo_masivo", accion)


def enviar_whatsapp(
    texto: str,
    destinatarios: int,
    segmento_declarado: str,
    hora_envio: str,
    programa_ofrecido: Optional[str] = None,
    audiencia_id: Optional[str] = None,
    canal: str = "whatsapp_oficial",
) -> dict:
    """Envía un WhatsApp masivo. Pasa SIEMPRE por VoBo antes de salir.

    destinatarios: cuántas personas lo reciben. segmento_declarado: founders, ejecutivos, equipos_tecnicos,
    estudiantes o comunidad_general. hora_envio: HH:MM (24 h, Bogotá).
    """
    accion = {
        "tipo_accion": "whatsapp_masivo",
        "canal": canal,
        "destinatarios": destinatarios,
        "segmento_declarado": segmento_declarado,
        "hora_envio": hora_envio,
        "texto": texto,
        "programa_ofrecido": programa_ofrecido,
        "audiencia_id": audiencia_id,
    }
    return pasar_por_vobo("enviar_whatsapp", accion)


def publicar_en_redes(
    texto: str,
    canal: str = "instagram_oficial",
    segmento_declarado: str = "comunidad_general",
    hora_envio: Optional[str] = None,
) -> dict:
    """Publica en redes sociales (instagram_oficial o linkedin_oficial). Pasa SIEMPRE por VoBo antes de salir.

    hora_envio: HH:MM (24 h, Bogotá); si no se da, la hora actual.
    """
    accion = {
        "tipo_accion": "publicacion_redes",
        "canal": canal,
        "destinatarios": 0,
        "segmento_declarado": segmento_declarado,
        "hora_envio": hora_envio or _hora_bogota(),
        "texto": texto,
    }
    return pasar_por_vobo("publicar_en_redes", accion)


def actualizar_hubspot(
    hubspot_object_id: Union[str, int],
    campo: str,
    valor: str,
    segmento_declarado: str = "founders",
    hora_envio: Optional[str] = None,
) -> dict:
    """Actualiza un campo de un registro de HubSpot. Pasa SIEMPRE por VoBo antes de escribir.

    hubspot_object_id: ID del registro en HubSpot. campo: nombre del campo (p. ej. etapa_crm, notas).
    valor: el valor que se escribe. hora_envio: HH:MM (24 h, Bogotá); si no se da, la hora actual.
    """
    hubspot_object_id = str(hubspot_object_id)  # los IDs de HubSpot son numéricos; un agente puede mandarlos como número
    if len(hubspot_object_id) > MAX_ID_HUBSPOT:
        # No se recorta: dos IDs distintos podrían quedar iguales. No se consulta a VoBo ni se ejecuta.
        falla = f"el ID de HubSpot tiene {len(hubspot_object_id)} caracteres; el máximo es {MAX_ID_HUBSPOT}"
        ejecutor.registrar(
            request_id=None,
            herramienta="actualizar_hubspot",
            hubspot_object_id=hubspot_object_id,
            decision=PEDIR_VOBO,
            razones=[f"No se pudo evaluar: {falla}."],
            ejecutada=False,
            modo="normal",
            falla=falla,
        )
        return {
            "decision": PEDIR_VOBO,
            "request_id": None,
            "razones": [f"No se pudo evaluar: {falla}."],
            "ejecutada": False,
            "estado": "No se envió: el ID de HubSpot no es válido. Revisa el ID; una persona debe decidir.",
            "falla": falla,
        }
    accion = {
        "tipo_accion": "crm_update",
        "canal": "crm",
        "destinatarios": 1,
        "segmento_declarado": segmento_declarado,
        "hora_envio": hora_envio or _hora_bogota(),
        "campo_crm": campo,
        "texto": valor,
        "perfil_id": hubspot_object_id,
    }
    return pasar_por_vobo("actualizar_hubspot", accion, hubspot_object_id=hubspot_object_id)


HERRAMIENTAS = (enviar_correo_masivo, enviar_whatsapp, publicar_en_redes, actualizar_hubspot)


def crear_servidor():
    """Registra las herramientas en un servidor MCP (SDK oficial de Python, mcp 2.x)."""
    from mcp.server.mcpserver import MCPServer

    servidor = MCPServer(
        name="vobo-salidas",
        instructions=(
            "Puerta de salida de los agentes de 30X. Todo correo masivo, WhatsApp, publicación en redes o cambio en "
            "HubSpot se hace con estas herramientas: cada una consulta a VoBo antes de ejecutar. Si la respuesta dice "
            "que no se envió, no intentes otra vía: informa al usuario la decisión y sus razones."
        ),
    )
    for herramienta in HERRAMIENTAS:
        servidor.tool()(herramienta)
    return servidor


if __name__ == "__main__":
    crear_servidor().run(transport="stdio")
