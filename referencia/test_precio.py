"""Valida la regla precio_inconsistente de la referencia en Python con la tabla compartida casos_precio.json.

La misma tabla la valida la implementación en TypeScript (tests/rules.bordes.test.ts).

    python -I -m unittest discover -s referencia -p "test_*.py" -v
"""

import json
import unittest
from pathlib import Path

import rules_ref

RAIZ = Path(__file__).resolve().parents[1]
CASOS = json.loads((Path(__file__).parent / "casos_precio.json").read_text(encoding="utf-8"))["casos"]
POLITICA = json.loads((RAIZ / "data" / "policy_demo.json").read_text(encoding="utf-8"))

BASE = {
    "tipo_accion": "correo_masivo",
    "canal": "correo_oficial",
    "destinatarios": "800",
    "segmento_declarado": "comunidad_general",
    "hora_envio": "10:00",
    "texto": "Texto de prueba.",
}


class PruebasPrecio(unittest.TestCase):
    def test_la_politica_json_coincide_con_la_de_la_referencia(self):
        self.assertEqual(POLITICA["catalogo_programas_usd"], rules_ref.POLICY["catalogo_programas_usd"])
        self.assertEqual(
            rules_ref.POLICY["catalogo_programas_usd"],
            {"AI for Executives": 2000, "AI for devs": 1500, "Ventas con LinkedIn": 1950, "Sales Machine": 1950, "AI Sales": 1950, "Free Sales Training": 0},
        )

    def test_tabla_de_casos(self):
        for caso in CASOS:
            with self.subTest(caso["nombre"]):
                accion = dict(BASE)
                if caso["programa_ofrecido"] is not None:
                    accion["programa_ofrecido"] = caso["programa_ofrecido"]
                if caso["precio_en_texto_usd"] is not None:
                    accion["precio_en_texto_usd"] = str(caso["precio_en_texto_usd"])
                piso, reglas = rules_ref.rules_floor(accion, POLITICA)
                self.assertEqual("precio_inconsistente" in reglas, caso["se_activa"])
                self.assertEqual(piso, "REVIEW" if caso["se_activa"] else "ALLOW")
                self.assertEqual(reglas, ["precio_inconsistente"] if caso["se_activa"] else [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
