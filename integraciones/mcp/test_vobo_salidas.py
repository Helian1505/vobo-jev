"""Pruebas de la puerta de salida MCP contra un servidor falso. No necesitan el paquete `mcp`.

    python -m unittest discover -s integraciones/mcp -p "test_*.py" -v

Se prueban las funciones de las herramientas directamente (sin levantar el transporte MCP).
"""

import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

_AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(_AQUI))
sys.path.insert(0, str(_AQUI.parent / "python"))

from test_vobo_gate import ServidorFalso  # noqa: E402  (el mismo VoBo de mentira que usan las pruebas de vobo_gate)

import vobo_salidas  # noqa: E402

# Campos de la acción según src/lib/vobo/accion-schema.ts. Nada fuera de esta lista debe salir hacia VoBo.
CAMPOS_CONTRATO = {
    "id", "tipo_accion", "canal", "destinatarios", "segmento_declarado", "hora_envio", "campo_crm",
    "fecha_evento_real", "fecha_en_texto", "precio_en_texto_usd", "en_lista_de_bajas", "texto",
    "programa_ofrecido", "audiencia_id", "audiencia_pct_afinidad_baja", "perfil_id",
}
CAMPOS_REGISTRO = {"ts", "request_id", "herramienta", "hubspot_object_id", "decision", "razones", "ejecutada", "modo"}
VARIABLES = ("VOBO_URL", "VOBO_TIMEOUT", "VOBO_REGISTRO", "VOBO_SOMBRA", "VOBO_API_KEY", "VOBO_EVALUATE_PATH")


def correo():
    return vobo_salidas.enviar_correo_masivo(
        texto="Recordatorio: la clase abierta es el jueves.", destinatarios=800,
        segmento_declarado="comunidad_general", hora_envio="10:00",
    )


class PruebasBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = ServidorFalso()

    @classmethod
    def tearDownClass(cls):
        cls.srv.cerrar()

    def setUp(self):
        self.anterior = {k: os.environ.get(k) for k in VARIABLES}
        for k in VARIABLES:
            os.environ.pop(k, None)
        self.tmp = tempfile.TemporaryDirectory()
        self.registro = Path(self.tmp.name) / "registro.jsonl"
        os.environ.update({"VOBO_URL": self.srv.url, "VOBO_TIMEOUT": "0.5", "VOBO_REGISTRO": str(self.registro)})
        self.srv.recibidos.clear()
        self.srv.modo = "ALLOW"
        self.ejecutadas = []
        self._ejecutar_real = vobo_salidas.ejecutor.ejecutar

        def espia(herramienta, accion):
            self.ejecutadas.append(herramienta)
            return self._ejecutar_real(herramienta, accion)

        vobo_salidas.ejecutor.ejecutar = espia

    def tearDown(self):
        vobo_salidas.ejecutor.ejecutar = self._ejecutar_real
        self.tmp.cleanup()
        for k, v in self.anterior.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def lineas_registro(self):
        return [json.loads(l) for l in self.registro.read_text(encoding="utf-8").splitlines()]


class PruebasDecisiones(PruebasBase):
    def test_permitir_ejecuta_y_devuelve_enviado_con_request_id(self):
        r = correo()
        self.assertEqual((r["decision"], r["estado"], r["ejecutada"]), ("PERMITIR", "Enviado", True))
        self.assertEqual(r["request_id"], "13ab2ca9-4555-47b4-b6a0-f9e7e900fa3d")
        self.assertEqual(self.ejecutadas, ["enviar_correo_masivo"])

    def test_pedir_vobo_no_ejecuta(self):
        self.srv.modo = "REVIEW"
        r = correo()
        self.assertEqual((r["decision"], r["ejecutada"]), ("PEDIR VOBO", False))
        self.assertIn("pendiente de visto bueno humano", r["estado"])
        self.assertTrue(r["razones"])
        self.assertEqual(self.ejecutadas, [])

    def test_bloquear_no_ejecuta_y_da_razones(self):
        self.srv.modo = "BLOCK"
        r = vobo_salidas.actualizar_hubspot("12345678901", "notas", "valor de prueba")
        self.assertEqual((r["decision"], r["ejecutada"]), ("BLOQUEAR", False))
        self.assertIn("bloqueó", r["estado"])
        self.assertTrue(r["razones"])
        self.assertEqual(self.ejecutadas, [])


class PruebasFallaCerrada(PruebasBase):
    def test_caido_500_y_decision_desconocida_no_ejecutan(self):
        casos = {"http500": "HTTP 500", "decision_rara": "decisión inválida"}
        for modo, falla in casos.items():
            with self.subTest(modo):
                self.srv.modo = modo
                r = correo()
                self.assertEqual((r["decision"], r["ejecutada"]), ("PEDIR VOBO", False))
                self.assertIn(falla, r["falla"])
        os.environ["VOBO_URL"] = "http://127.0.0.1:9"  # nadie escucha
        r = correo()
        self.assertEqual((r["decision"], r["ejecutada"], r["falla"]), ("PEDIR VOBO", False, "error de red"))
        self.assertEqual(self.ejecutadas, [])

    def test_colgado_tiempo_agotado_no_ejecuta(self):
        self.srv.modo = "hang"
        inicio = time.monotonic()
        r = correo()
        self.assertLess(time.monotonic() - inicio, 2.5)
        self.assertEqual((r["decision"], r["ejecutada"], r["falla"]), ("PEDIR VOBO", False, "tiempo agotado"))
        self.assertEqual(self.ejecutadas, [])


class PruebasSombraYRegistro(PruebasBase):
    def test_modo_sombra_ejecuta_siempre_y_registra(self):
        os.environ["VOBO_SOMBRA"] = "1"
        for modo in ("ALLOW", "REVIEW", "BLOCK", "http500"):
            self.srv.modo = modo
            self.assertTrue(correo()["ejecutada"])
        self.assertEqual(len(self.ejecutadas), 4)
        lineas = self.lineas_registro()
        self.assertEqual([l["decision"] for l in lineas], ["PERMITIR", "PEDIR VOBO", "BLOQUEAR", "PEDIR VOBO"])
        self.assertTrue(all(l["modo"] == "sombra" and l["ejecutada"] for l in lineas))

    def test_el_registro_tiene_los_campos_esperados(self):
        correo()
        self.srv.modo = "BLOCK"
        vobo_salidas.actualizar_hubspot("12345678901", "notas", "valor")
        permitida, bloqueada = self.lineas_registro()
        for linea in (permitida, bloqueada):
            self.assertTrue(CAMPOS_REGISTRO <= set(linea), linea)
        self.assertEqual((permitida["herramienta"], permitida["ejecutada"], permitida["modo"]), ("enviar_correo_masivo", True, "normal"))
        self.assertEqual((bloqueada["hubspot_object_id"], bloqueada["ejecutada"]), ("12345678901", False))


class PruebasContrato(PruebasBase):
    def test_las_acciones_solo_llevan_campos_del_contrato(self):
        vobo_salidas.enviar_correo_masivo("hola", 10, "founders", "10:00", programa_ofrecido="AI Sales", audiencia_id="A3")
        vobo_salidas.enviar_whatsapp("hola", 10, "estudiantes", "11:00")
        vobo_salidas.publicar_en_redes("hola")
        vobo_salidas.actualizar_hubspot("12345678901", "etapa_crm", "Interesado")
        cuerpos = [r["cuerpo"] for r in self.srv.recibidos]
        self.assertEqual([c["tipo_accion"] for c in cuerpos], ["correo_masivo", "whatsapp_masivo", "publicacion_redes", "crm_update"])
        for c in cuerpos:
            self.assertLessEqual(set(c), CAMPOS_CONTRATO, c)
            self.assertNotIn(None, c.values())  # los opcionales vacíos no se mandan
        crm = cuerpos[3]
        self.assertEqual((crm["canal"], crm["destinatarios"], crm["campo_crm"], crm["texto"], crm["perfil_id"]),
                         ("crm", 1, "etapa_crm", "Interesado", "12345678901"))
        self.assertRegex(cuerpos[2]["hora_envio"], r"^([01]\d|2[0-3]):[0-5]\d$")

    def test_id_de_hubspot_numerico_se_manda_como_texto(self):
        vobo_salidas.actualizar_hubspot(12345678901, "notas", "valor")
        self.assertEqual(self.srv.recibidos[-1]["cuerpo"]["perfil_id"], "12345678901")
        self.assertEqual(self.lineas_registro()[-1]["hubspot_object_id"], "12345678901")

    def test_id_de_hubspot_de_mas_de_20_caracteres_no_se_recorta_ni_se_ejecuta(self):
        largo = "1" * 21
        r = vobo_salidas.actualizar_hubspot(largo, "notas", "valor")
        self.assertEqual((r["decision"], r["ejecutada"]), ("PEDIR VOBO", False))
        self.assertIn("21 caracteres", r["falla"])
        self.assertEqual((self.srv.recibidos, self.ejecutadas), ([], []))  # ni se consulta a VoBo ni se ejecuta
        linea = self.lineas_registro()[-1]
        self.assertEqual((linea["hubspot_object_id"], linea["decision"], linea["ejecutada"]), (largo, "PEDIR VOBO", False))
        vobo_salidas.actualizar_hubspot("1" * 20, "notas", "valor")  # 20 exactos sí pasan
        self.assertEqual(self.srv.recibidos[-1]["cuerpo"]["perfil_id"], "1" * 20)

    def test_con_clave_usa_la_ruta_protegida(self):
        os.environ["VOBO_API_KEY"] = "clave-de-prueba-larga"
        correo()
        r = self.srv.recibidos[-1]
        self.assertEqual((r["ruta"], r["cabeceras"]["Authorization"]), ("/api/v1/evaluate", "Bearer clave-de-prueba-larga"))
        os.environ.pop("VOBO_API_KEY")
        correo()
        self.assertEqual(self.srv.recibidos[-1]["ruta"], "/api/evaluate")


if __name__ == "__main__":
    unittest.main(verbosity=2)
