"""Pruebas de vobo_gate contra un servidor falso. Solo biblioteca estándar.

    python -m unittest discover -s integraciones/python -p "test_*.py" -v
"""

import asyncio
import json
import os
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import vobo_gate
from vobo_gate import VoboBloqueado, VoboNoAprobado, consultar, ejecutar_con_vobo, vobo_gate as gate

ACCION = {
    "tipo_accion": "correo_masivo",
    "canal": "correo_oficial",
    "destinatarios": 800,
    "segmento_declarado": "comunidad_general",
    "hora_envio": "10:00",
    "texto": "Te invitamos a la clase abierta del jueves.",
    "id": "ACC-1",
}


def respuesta_vobo(decision, **extra):
    cuerpo = {
        "schema_version": "1",
        "request_id": "13ab2ca9-4555-47b4-b6a0-f9e7e900fa3d",
        "decision": decision,
        "explicacion": {"titular": f"{decision}: motivo de prueba", "razones": ["motivo de prueba"]},
        "resumen_aprobacion": f"*VoBo: {decision}*\nAcción: prueba",
        "registro": {"request_id": "13ab2ca9-4555-47b4-b6a0-f9e7e900fa3d", "decision": decision},
    }
    cuerpo.update(extra)
    return cuerpo


class ServidorFalso:
    """Un VoBo de mentira: responde lo que se le configure y recuerda lo que recibió."""

    def __init__(self):
        self.modo = "ALLOW"
        self.recibidos = []
        outer = self

        class Manejador(BaseHTTPRequestHandler):
            def log_message(self, *args):  # silencio
                pass

            def do_POST(self):
                largo = int(self.headers.get("Content-Length", 0))
                cuerpo = self.rfile.read(largo)
                outer.recibidos.append({"ruta": self.path, "cabeceras": dict(self.headers), "cuerpo": json.loads(cuerpo or b"{}")})
                modo = outer.modo
                if modo == "hang":
                    time.sleep(3)  # más que el tiempo límite de las pruebas
                    return
                estado, tipo, datos = 200, "application/json", None
                if modo in ("ALLOW", "REVIEW", "BLOCK"):
                    datos = json.dumps(respuesta_vobo(modo))
                elif modo.startswith("http"):
                    estado, datos = int(modo[4:]), json.dumps({"error": "falla de prueba"})
                elif modo == "schema2":
                    datos = json.dumps(respuesta_vobo("ALLOW", schema_version="2"))
                elif modo == "sin_schema":
                    datos = json.dumps({"decision": "ALLOW"})
                elif modo == "decision_rara":
                    datos = json.dumps(respuesta_vobo("QUIZAS"))
                elif modo == "html":
                    tipo, datos = "text/html", "<html>no es json</html>"
                elif modo == "lista":
                    datos = json.dumps([1, 2, 3])
                elif modo == "vacio":
                    datos = ""
                elif modo == "204":
                    estado, datos = 204, ""
                self.send_response(estado)
                self.send_header("Content-Type", tipo)
                self.send_header("Content-Length", str(len(datos.encode())))
                self.end_headers()
                self.wfile.write(datos.encode())

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Manejador)
        self.httpd.daemon_threads = True
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def cerrar(self):
        self.httpd.shutdown()
        self.httpd.server_close()


class PruebasBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = ServidorFalso()

    @classmethod
    def tearDownClass(cls):
        cls.srv.cerrar()

    def setUp(self):
        self.srv.recibidos.clear()
        self.srv.modo = "ALLOW"
        self.llamadas = []

    def herramienta(self, **config):
        """Una herramienta decorada que anota cuándo se ejecuta de verdad."""

        @gate(a_accion=lambda destinatarios: dict(ACCION, destinatarios=destinatarios), timeout=0.5, base_url=self.srv.url, **config)
        def enviar_correo_masivo(destinatarios):
            self.llamadas.append(destinatarios)
            return f"enviado a {destinatarios}"

        return enviar_correo_masivo


class PruebasDecisiones(PruebasBase):
    def test_permitir_ejecuta_la_funcion_y_devuelve_su_resultado(self):
        self.assertEqual(self.herramienta()(800), "enviado a 800")
        self.assertEqual(self.llamadas, [800])

    def test_bloquear_lanza_y_no_ejecuta(self):
        self.srv.modo = "BLOCK"
        with self.assertRaises(VoboBloqueado) as cm:
            self.herramienta()(800)
        self.assertEqual(cm.exception.veredicto.decision, "BLOQUEAR")
        self.assertEqual(cm.exception.veredicto.request_id, "13ab2ca9-4555-47b4-b6a0-f9e7e900fa3d")
        self.assertEqual(self.llamadas, [])

    def test_pedir_vobo_ejecuta_solo_si_el_callback_devuelve_true(self):
        self.srv.modo = "REVIEW"
        vistos = []

        def aprobar(veredicto, accion):
            vistos.append((veredicto.decision, veredicto.resumen_aprobacion, accion["id"]))
            return True

        self.assertEqual(self.herramienta(solicitar_aprobacion=aprobar)(800), "enviado a 800")
        self.assertEqual(self.llamadas, [800])
        self.assertEqual(vistos, [("PEDIR VOBO", "*VoBo: REVIEW*\nAcción: prueba", "ACC-1")])  # el callback recibe el resumen

    def test_pedir_vobo_no_ejecuta_si_rechazan_o_no_hay_callback_o_el_callback_falla_o_no_devuelve_true(self):
        self.srv.modo = "REVIEW"
        casos = {
            "rechazan": lambda v, a: False,
            "sin_callback": None,
            "callback_lanza": lambda v, a: 1 / 0,
            "devuelve_1": lambda v, a: 1,  # truthy, pero no es True: no cuenta como aprobación
            "devuelve_texto": lambda v, a: "sí",
            "devuelve_none": lambda v, a: None,
        }
        for nombre, cb in casos.items():
            with self.subTest(nombre):
                with self.assertRaises(VoboNoAprobado):
                    self.herramienta(solicitar_aprobacion=cb)(800)
        self.assertEqual(self.llamadas, [])

    def test_el_callback_solo_se_llama_en_pedir_vobo(self):
        llamado = []
        for modo in ("ALLOW", "BLOCK"):
            self.srv.modo = modo
            try:
                self.herramienta(solicitar_aprobacion=lambda v, a: llamado.append(modo) or True)(800)
            except VoboBloqueado:
                pass
        self.assertEqual(llamado, [])

    def test_manda_la_accion_en_json_y_la_clave_si_hay(self):
        self.herramienta(api_key="clave-de-prueba")(1234)
        recibido = self.srv.recibidos[0]
        self.assertEqual(recibido["ruta"], "/api/evaluate")
        self.assertEqual(recibido["cuerpo"]["destinatarios"], 1234)
        self.assertEqual(recibido["cabeceras"]["Content-Type"], "application/json")
        self.assertEqual(recibido["cabeceras"]["Authorization"], "Bearer clave-de-prueba")
        self.herramienta()(1)
        self.assertNotIn("Authorization", self.srv.recibidos[1]["cabeceras"])


class PruebasFallaCerrada(PruebasBase):
    """Toda respuesta que no sea un 200 válido cuenta como PEDIR VOBO: nunca ejecuta sola."""

    MODOS_MALOS = {
        "http500": "HTTP 500",
        "http503": "HTTP 503",
        "http429": "HTTP 429",
        "http400": "HTTP 400",
        "http401": "HTTP 401",
        "schema2": "schema_version desconocido",
        "sin_schema": "schema_version desconocido",
        "decision_rara": "decisión inválida",
        "html": "no es JSON",
        "lista": "respuesta inesperada",
        "vacio": "no es JSON",
        "204": "HTTP 204",
    }

    def test_cada_respuesta_mala_es_pedir_vobo_con_la_falla_anotada(self):
        for modo, esperado in self.MODOS_MALOS.items():
            with self.subTest(modo):
                self.srv.modo = modo
                v = consultar(ACCION, base_url=self.srv.url, timeout=0.5)
                self.assertEqual(v.decision, "PEDIR VOBO")
                self.assertTrue(v.fallo_cerrado)
                self.assertIn(esperado, v.falla)
                self.assertIn("por seguridad pasa a una persona", v.motivo)
                self.assertIn("*VoBo no pudo evaluar esta acción*", v.resumen_aprobacion)

    def test_con_falla_no_se_ejecuta_sin_aprobacion_y_si_con_aprobacion_explicita(self):
        self.srv.modo = "http500"
        with self.assertRaises(VoboNoAprobado):
            self.herramienta()(800)
        self.assertEqual(self.llamadas, [])
        self.assertEqual(self.herramienta(solicitar_aprobacion=lambda v, a: v.fallo_cerrado)(800), "enviado a 800")
        self.assertEqual(self.llamadas, [800])

    def test_tiempo_agotado_no_cuelga_y_es_pedir_vobo(self):
        self.srv.modo = "hang"
        inicio = time.monotonic()
        v = consultar(ACCION, base_url=self.srv.url, timeout=0.4)
        self.assertLess(time.monotonic() - inicio, 2.0)
        self.assertEqual((v.decision, v.falla), ("PEDIR VOBO", "tiempo agotado"))

    def test_servidor_caido_y_urls_invalidas(self):
        for url in ("http://127.0.0.1:9", "esto no es una url", "ftp://127.0.0.1/", ""):
            with self.subTest(url):
                v = consultar(ACCION, base_url=url or "://", timeout=0.5)
                self.assertEqual(v.decision, "PEDIR VOBO")
                self.assertTrue(v.fallo_cerrado)

    def test_consultar_nunca_lanza_aunque_la_accion_no_sea_serializable(self):
        v = consultar({"texto": object()}, base_url=self.srv.url, timeout=0.5)
        self.assertEqual(v.decision, "PEDIR VOBO")


class PruebasOtras(PruebasBase):
    def test_modo_sombra_ejecuta_siempre_y_registra(self):
        registrados = []
        for modo in ("ALLOW", "REVIEW", "BLOCK", "http500"):
            self.srv.modo = modo
            self.assertEqual(self.herramienta(modo_sombra=True, al_decidir=lambda v, a: registrados.append(v.decision))(1), "enviado a 1")
        self.assertEqual(registrados, ["PERMITIR", "PEDIR VOBO", "BLOQUEAR", "PEDIR VOBO"])
        self.assertEqual(len(self.llamadas), 4)

    def test_un_observador_que_falla_no_cambia_la_decision(self):
        self.srv.modo = "BLOCK"
        with self.assertRaises(VoboBloqueado):
            self.herramienta(al_decidir=lambda v, a: 1 / 0)(800)
        self.assertEqual(self.llamadas, [])

    def test_si_no_se_puede_armar_la_accion_no_se_ejecuta(self):
        @gate(a_accion=lambda: 1 / 0, base_url=self.srv.url)
        def herramienta():
            self.llamadas.append("x")

        with self.assertRaises(ZeroDivisionError):
            herramienta()
        self.assertEqual((self.llamadas, self.srv.recibidos), ([], []))

    def test_version_funcional(self):
        self.assertEqual(ejecutar_con_vobo(ACCION, lambda: "ok", base_url=self.srv.url, timeout=0.5), "ok")

    def test_conserva_el_nombre_y_la_documentacion_de_la_funcion(self):
        @gate(a_accion=lambda: ACCION, base_url=self.srv.url)
        def mi_herramienta():
            """Documentación."""

        self.assertEqual((mi_herramienta.__name__, mi_herramienta.__doc__), ("mi_herramienta", "Documentación."))

    def test_variables_de_entorno(self):
        anterior = {k: os.environ.get(k) for k in ("VOBO_URL", "VOBO_API_KEY", "VOBO_EVALUATE_PATH")}
        try:
            os.environ.update({"VOBO_URL": self.srv.url, "VOBO_API_KEY": "k-env", "VOBO_EVALUATE_PATH": "/api/v1/evaluate"})
            self.assertEqual(consultar(ACCION, timeout=0.5).decision, "PERMITIR")
            r = self.srv.recibidos[-1]
            self.assertEqual((r["ruta"], r["cabeceras"]["Authorization"]), ("/api/v1/evaluate", "Bearer k-env"))
        finally:
            for k, v in anterior.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v


class PruebasAsync(PruebasBase):
    def test_funciones_async(self):
        ejecutadas = []

        @gate(a_accion=lambda n: dict(ACCION, destinatarios=n), base_url=self.srv.url, timeout=0.5,
              solicitar_aprobacion=lambda v, a: True)
        async def actualizar_crm(n):
            ejecutadas.append(n)
            return f"crm {n}"

        async def correr():
            self.assertEqual(await actualizar_crm(3), "crm 3")  # PERMITIR
            self.srv.modo = "REVIEW"
            self.assertEqual(await actualizar_crm(4), "crm 4")  # aprobada
            self.srv.modo = "BLOCK"
            with self.assertRaises(VoboBloqueado):
                await actualizar_crm(5)
            self.srv.modo = "http500"
            self.assertEqual(await actualizar_crm(6), "crm 6")  # falla cerrada + aprobación explícita

        asyncio.run(correr())
        self.assertEqual(ejecutadas, [3, 4, 6])

    def test_async_con_callback_async_y_sin_aprobacion(self):
        @gate(a_accion=lambda: ACCION, base_url=self.srv.url, timeout=0.5)
        async def sin_callback():
            self.llamadas.append(1)

        async def aprobar(v, a):
            return False

        @gate(a_accion=lambda: ACCION, base_url=self.srv.url, timeout=0.5, solicitar_aprobacion=aprobar)
        async def con_callback_async():
            self.llamadas.append(2)

        async def correr():
            self.srv.modo = "REVIEW"
            for f in (sin_callback, con_callback_async):
                with self.assertRaises(VoboNoAprobado):
                    await f()

        asyncio.run(correr())
        self.assertEqual(self.llamadas, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
