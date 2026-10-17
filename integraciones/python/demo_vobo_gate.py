"""Demo de vobo_gate: tres herramientas de un agente en Python con VoBo delante. Solo biblioteca estándar.

Las herramientas son simuladas: solo dicen lo que harían, no envían nada.

    VOBO_URL=http://localhost:3000 python integraciones/python/demo_vobo_gate.py     # o la URL de tu instancia
    VOBO_URL=http://localhost:9    python integraciones/python/demo_vobo_gate.py     # servidor caído: falla cerrada
    VOBO_SOMBRA=1 python integraciones/python/demo_vobo_gate.py                      # modo sombra: ejecuta todo

Es un ejemplo de integración; no afirma nada sobre los sistemas reales de 30X. Ver docs/INTEGRACION.md.
"""

import json
import os
import sys
from pathlib import Path

from vobo_gate import VoboBloqueado, VoboNoAprobado, vobo_gate

SOMBRA = os.environ.get("VOBO_SOMBRA") == "1"
EJEMPLOS = Path(__file__).resolve().parents[2] / "data" / "ejemplos_demo.json"
CASOS = ["E01", "E02", "E04", "E07", "E15"]

# La persona que aprueba: aquí es un simulacro (aprueba la primera solicitud real de VoBo y rechaza las demás, y
# rechaza siempre las que llegan por una falla de VoBo). En una integración real, este callback publicaría el
# resumen en el canal de aprobaciones y esperaría la respuesta.
_aprobaciones = {"vistas": 0}


def pedir_aprobacion(veredicto, accion):
    aprueba = False
    if not veredicto.fallo_cerrado:
        _aprobaciones["vistas"] += 1
        aprueba = _aprobaciones["vistas"] == 1
    print(f"   [aprobación] se le muestra a una persona:\n      " + (veredicto.resumen_aprobacion or veredicto.motivo).replace("\n", "\n      "))
    print(f"   [aprobación] la persona {'APRUEBA' if aprueba else 'RECHAZA'}")
    return aprueba


def registrar(veredicto, accion):
    """Aquí iría el registro de la decisión (p. ej. en un CRM). Hoy solo se guarda el último para la tabla."""
    ultimo.update(decision=veredicto.decision, falla=veredicto.falla, motivo=veredicto.motivo)


ultimo = {}
COMUN = dict(solicitar_aprobacion=pedir_aprobacion, al_decidir=registrar, modo_sombra=SOMBRA)


@vobo_gate(a_accion=lambda a: a, **COMUN)
def enviar_correo_masivo(accion):
    return f"correo enviado a {accion['destinatarios']} destinatarios"


@vobo_gate(a_accion=lambda a: a, **COMUN)
def actualizar_crm(accion):
    return f"CRM actualizado: «{accion.get('campo_crm', 'campo')}» en {accion['destinatarios']} contacto(s)"


@vobo_gate(a_accion=lambda a: a, **COMUN)
def publicar_redes(accion):
    return f"publicado en «{accion['canal']}»"


HERRAMIENTAS = {"correo_masivo": enviar_correo_masivo, "crm_update": actualizar_crm, "publicacion_redes": publicar_redes}


def main():
    ejemplos = {e["id"]: e for e in json.loads(EJEMPLOS.read_text(encoding="utf-8"))["ejemplos"]}
    print(f"Agente en Python -> VoBo en {os.environ.get('VOBO_URL', 'https://vobo-jev.vercel.app')}" + ("  (MODO SOMBRA)" if SOMBRA else "") + "\n")

    filas = [("Caso", "Herramienta", "Decisión de VoBo", "Qué pasó con la acción")]
    for caso in CASOS:
        accion = dict(ejemplos[caso]["accion"], id=f"py-{caso}")
        herramienta = HERRAMIENTAS[accion["tipo_accion"]]
        ultimo.clear()
        try:
            resultado = "ejecutó: " + herramienta(accion)
        except VoboBloqueado:
            resultado = "BLOQUEADA: no se ejecutó"
        except VoboNoAprobado:
            resultado = "no aprobada: no se ejecutó"
        decision = ultimo.get("decision", "?") + (f" (FALLA CERRADA: {ultimo['falla']})" if ultimo.get("falla") else "")
        filas.append((caso, herramienta.__name__, decision, resultado))

    anchos = [max(len(f[i]) for f in filas) for i in range(4)]
    for k, f in enumerate(filas):
        print("  │  ".join(c.ljust(anchos[i]) for i, c in enumerate(f)))
        if k == 0:
            print("──┼──".join("─" * a for a in anchos))


if __name__ == "__main__":
    sys.exit(main())
