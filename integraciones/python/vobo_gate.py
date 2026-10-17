"""vobo_gate: envoltorio para funciones-herramienta de agentes en Python. Solo biblioteca estándar.

Antes de ejecutar una herramienta, consulta a VoBo (POST /api/evaluate) y decide:

    PERMITIR     -> ejecuta la función.
    PEDIR VOBO   -> ejecuta SOLO si el callback `solicitar_aprobacion` devuelve True.
                    Si devuelve cualquier otra cosa, lanza una excepción o no hay callback: VoboNoAprobado.
    BLOQUEAR     -> no ejecuta; lanza VoboBloqueado.

FALLA CERRADA: un error de red, un tiempo agotado, cualquier respuesta que no sea un 200 válido (5xx, 429, 4xx),
un cuerpo que no es JSON, una decisión desconocida o un `schema_version` que esta librería no conoce cuentan como
PEDIR VOBO. Un error nunca equivale a PERMITIR.

Es un ejemplo de integración: no afirma nada sobre los sistemas reales de 30X. Ver docs/INTEGRACION.md.

Uso:

    from vobo_gate import vobo_gate

    @vobo_gate(
        a_accion=lambda destinatarios, texto: {
            "tipo_accion": "correo_masivo", "canal": "correo_oficial", "destinatarios": destinatarios,
            "segmento_declarado": "comunidad_general", "hora_envio": "10:00", "texto": texto,
        },
        solicitar_aprobacion=lambda veredicto, accion: pedir_en_slack(veredicto.resumen_aprobacion),
    )
    def enviar_correo_masivo(destinatarios, texto): ...

Configuración por variables de entorno (o parámetros): VOBO_URL, VOBO_EVALUATE_PATH, VOBO_API_KEY, VOBO_TIMEOUT.
"""

from __future__ import annotations

import asyncio
import functools
import inspect
import json
import os
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Optional

SCHEMA_CONOCIDO = "1"
URL_POR_DEFECTO = "https://vobo-jev.vercel.app"
RUTA_POR_DEFECTO = "/api/evaluate"
TIEMPO_LIMITE_POR_DEFECTO = 5.0
MAX_BYTES_RESPUESTA = 1_000_000

NOMBRE_DECISION = {"ALLOW": "PERMITIR", "REVIEW": "PEDIR VOBO", "BLOCK": "BLOQUEAR"}

PERMITIR = "PERMITIR"
PEDIR_VOBO = "PEDIR VOBO"
BLOQUEAR = "BLOQUEAR"


class VoboError(Exception):
    """Base de las excepciones de esta librería. Lleva el veredicto que la causó."""

    def __init__(self, mensaje: str, veredicto: "Veredicto"):
        super().__init__(mensaje)
        self.veredicto = veredicto


class VoboBloqueado(VoboError):
    """VoBo respondió BLOQUEAR: la función no se ejecutó."""


class VoboNoAprobado(VoboError):
    """VoBo pidió visto bueno humano y nadie lo dio (o no había a quién pedirlo): la función no se ejecutó."""


@dataclass(frozen=True)
class Veredicto:
    decision: str  # "PERMITIR" | "PEDIR VOBO" | "BLOQUEAR"
    motivo: str
    request_id: Optional[str] = None
    resumen_aprobacion: Optional[str] = None
    registro: Optional[dict] = None
    #: Si no hubo una respuesta válida de VoBo, qué falló. La decisión es entonces PEDIR VOBO (falla cerrada).
    falla: Optional[str] = None

    @property
    def fallo_cerrado(self) -> bool:
        return self.falla is not None


def _describir(accion: dict) -> str:
    return "{tipo} a {n} destinatario(s) por «{canal}»{id}".format(
        tipo=accion.get("tipo_accion", "acción"),
        n=accion.get("destinatarios", "?"),
        canal=accion.get("canal", "?"),
        id=f" (id {accion['id']})" if accion.get("id") else "",
    )


def _falla_cerrada(accion: dict, falla: str) -> Veredicto:
    motivo = f"No se pudo consultar a VoBo ({falla}); por seguridad pasa a una persona."
    resumen = "\n".join(
        [
            "*VoBo no pudo evaluar esta acción*",
            f"Acción: {_describir(accion)}",
            f"Por qué: {falla}. Por seguridad pasa a una persona.",
        ]
    )
    return Veredicto(decision=PEDIR_VOBO, motivo=motivo, resumen_aprobacion=resumen, falla=falla)


def consultar(
    accion: dict,
    *,
    base_url: Optional[str] = None,
    ruta: Optional[str] = None,
    timeout: Optional[float] = None,
    api_key: Optional[str] = None,
) -> Veredicto:
    """Consulta a VoBo. NUNCA lanza: ante cualquier problema devuelve PEDIR VOBO con la falla anotada."""
    base = (base_url or os.environ.get("VOBO_URL") or URL_POR_DEFECTO).rstrip("/")
    camino = ruta or os.environ.get("VOBO_EVALUATE_PATH") or RUTA_POR_DEFECTO
    limite = timeout if timeout is not None else float(os.environ.get("VOBO_TIMEOUT") or TIEMPO_LIMITE_POR_DEFECTO)
    clave = api_key or os.environ.get("VOBO_API_KEY")

    try:
        cuerpo = json.dumps(accion, ensure_ascii=False).encode("utf-8")
        cabeceras = {"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "vobo-gate/1"}
        if clave:
            cabeceras["Authorization"] = f"Bearer {clave}"
        peticion = urllib.request.Request(base + camino, data=cuerpo, headers=cabeceras, method="POST")
        with urllib.request.urlopen(peticion, timeout=limite) as respuesta:  # noqa: S310 (la URL la configura quien integra)
            estado = respuesta.status
            crudo = respuesta.read(MAX_BYTES_RESPUESTA)
    except urllib.error.HTTPError as e:  # 4xx / 5xx: todo lo que no sea 200 falla cerrado
        e.close()
        return _falla_cerrada(accion, f"HTTP {e.code}")
    except (TimeoutError, socket.timeout):
        return _falla_cerrada(accion, "tiempo agotado")
    except urllib.error.URLError as e:
        if isinstance(e.reason, (TimeoutError, socket.timeout)):
            return _falla_cerrada(accion, "tiempo agotado")
        return _falla_cerrada(accion, "error de red")
    except (OSError, ValueError):  # conexión cortada, URL inválida, etc.
        return _falla_cerrada(accion, "error de red")
    except Exception:  # cualquier otra cosa rara: nunca se deja pasar por un error
        return _falla_cerrada(accion, "error inesperado")

    if estado != 200:
        return _falla_cerrada(accion, f"HTTP {estado}")
    try:
        datos: Any = json.loads(crudo.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return _falla_cerrada(accion, "respuesta que no es JSON")
    if not isinstance(datos, dict):
        return _falla_cerrada(accion, "respuesta inesperada")
    if datos.get("schema_version") != SCHEMA_CONOCIDO:
        return _falla_cerrada(accion, f"schema_version desconocido: {datos.get('schema_version')!r}")
    decision = NOMBRE_DECISION.get(datos.get("decision"))
    if decision is None:
        return _falla_cerrada(accion, "decisión inválida")

    explicacion = datos.get("explicacion")
    titular = explicacion.get("titular", "") if isinstance(explicacion, dict) else ""
    registro = datos.get("registro")
    resumen = datos.get("resumen_aprobacion")
    return Veredicto(
        decision=decision,
        motivo=titular if isinstance(titular, str) else "",
        request_id=datos.get("request_id") if isinstance(datos.get("request_id"), str) else None,
        resumen_aprobacion=resumen if isinstance(resumen, str) else None,
        registro=registro if isinstance(registro, dict) else None,
    )


Aprobacion = Callable[[Veredicto, dict], Any]
Observador = Callable[[Veredicto, dict], None]


def _avisar(al_decidir: Optional[Observador], veredicto: Veredicto, accion: dict) -> None:
    if al_decidir is None:
        return
    try:
        al_decidir(veredicto, accion)
    except Exception:  # un observador que falla (p. ej. al escribir un registro) no cambia la decisión
        pass


def _resolver(
    veredicto: Veredicto,
    accion: dict,
    resultado_aprobacion: Any,
    modo_sombra: bool,
) -> None:
    """Decide si se ejecuta: no lanza si se puede ejecutar; lanza VoboBloqueado / VoboNoAprobado si no."""
    if modo_sombra or veredicto.decision == PERMITIR:
        return
    if veredicto.decision == BLOQUEAR:
        raise VoboBloqueado(f"VoBo bloqueó la acción: {veredicto.motivo}", veredicto)
    # PEDIR VOBO: solo se ejecuta si la persona aprobó EXPLÍCITAMENTE (True)
    if resultado_aprobacion is True:
        return
    raise VoboNoAprobado("VoBo pidió visto bueno humano y no fue aprobado: " + (veredicto.motivo or "sin motivo"), veredicto)


def _pedir_aprobacion(solicitar: Optional[Aprobacion], veredicto: Veredicto, accion: dict) -> Any:
    if veredicto.decision != PEDIR_VOBO or solicitar is None:
        return None
    try:
        return solicitar(veredicto, accion)
    except Exception as exc:  # un callback que falla = no aprobado (falla cerrada)
        raise VoboNoAprobado(f"No se pudo pedir la aprobación ({type(exc).__name__}): la acción no se ejecuta.", veredicto) from exc


def ejecutar_con_vobo(
    accion: dict,
    ejecutar: Callable[[], Any],
    *,
    solicitar_aprobacion: Optional[Aprobacion] = None,
    al_decidir: Optional[Observador] = None,
    modo_sombra: bool = False,
    **config: Any,
) -> Any:
    """Versión funcional: consulta a VoBo y ejecuta `ejecutar()` solo si corresponde. Devuelve lo que devuelva."""
    veredicto = consultar(accion, **config)
    _avisar(al_decidir, veredicto, accion)
    aprobacion = None if modo_sombra else _pedir_aprobacion(solicitar_aprobacion, veredicto, accion)
    _resolver(veredicto, accion, aprobacion, modo_sombra)
    return ejecutar()


async def ejecutar_con_vobo_async(
    accion: dict,
    ejecutar: Callable[[], Any],
    *,
    solicitar_aprobacion: Optional[Aprobacion] = None,
    al_decidir: Optional[Observador] = None,
    modo_sombra: bool = False,
    **config: Any,
) -> Any:
    """Igual que ejecutar_con_vobo, para funciones async (la consulta y los callbacks corren sin bloquear el bucle)."""
    veredicto = await asyncio.to_thread(consultar, accion, **config)
    _avisar(al_decidir, veredicto, accion)
    aprobacion = None
    if not modo_sombra and veredicto.decision == PEDIR_VOBO and solicitar_aprobacion is not None:
        try:
            if inspect.iscoroutinefunction(solicitar_aprobacion):
                aprobacion = await solicitar_aprobacion(veredicto, accion)
            else:
                aprobacion = await asyncio.to_thread(solicitar_aprobacion, veredicto, accion)
        except Exception as exc:
            raise VoboNoAprobado(f"No se pudo pedir la aprobación ({type(exc).__name__}): la acción no se ejecuta.", veredicto) from exc
    _resolver(veredicto, accion, aprobacion, modo_sombra)
    resultado = ejecutar()
    return await resultado if inspect.isawaitable(resultado) else resultado


def vobo_gate(
    a_accion: Callable[..., dict],
    *,
    solicitar_aprobacion: Optional[Aprobacion] = None,
    al_decidir: Optional[Observador] = None,
    modo_sombra: bool = False,
    **config: Any,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorador para funciones-herramienta (síncronas o async).

    `a_accion(*args, **kwargs)` recibe los mismos argumentos que la herramienta y devuelve el dict de la acción
    que se le manda a VoBo. Si no puede armarla, la excepción sube y la herramienta no se ejecuta.

    `solicitar_aprobacion(veredicto, accion)` se llama solo en PEDIR VOBO y debe devolver True para aprobar.
    `al_decidir(veredicto, accion)` se llama siempre (para registrar la decisión); si falla, se ignora.
    `modo_sombra=True`: consulta y registra, pero ejecuta siempre (para medir antes de frenar).
    `config`: base_url, ruta, timeout, api_key.
    """

    def decorador(funcion: Callable[..., Any]) -> Callable[..., Any]:
        if inspect.iscoroutinefunction(funcion):

            @functools.wraps(funcion)
            async def envoltura_async(*args: Any, **kwargs: Any) -> Any:
                accion = a_accion(*args, **kwargs)
                return await ejecutar_con_vobo_async(
                    accion,
                    lambda: funcion(*args, **kwargs),
                    solicitar_aprobacion=solicitar_aprobacion,
                    al_decidir=al_decidir,
                    modo_sombra=modo_sombra,
                    **config,
                )

            return envoltura_async

        @functools.wraps(funcion)
        def envoltura(*args: Any, **kwargs: Any) -> Any:
            accion = a_accion(*args, **kwargs)
            return ejecutar_con_vobo(
                accion,
                lambda: funcion(*args, **kwargs),
                solicitar_aprobacion=solicitar_aprobacion,
                al_decidir=al_decidir,
                modo_sombra=modo_sombra,
                **config,
            )

        return envoltura

    return decorador
