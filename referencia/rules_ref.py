"""Motor de reglas de referencia (capa 1) de VoBo y política de demostración.

La política son SUPUESTOS de demostración (no son reglas reales de 30X), salvo lo que se
apoya en la base de perfiles que compartió 30X (ver docs/BASE_CONOCIMIENTO_30X.md).
Se exporta a data/policy_demo.json para que la app y el banco usen la misma fuente de verdad.
Claude Code porta este módulo a TypeScript (src/lib/vobo/rules.ts) y debe coincidir exacto.

v1 (17 oct, 12:45 p.m.): agrega 3 reglas que usan la base de perfiles de 30X:
  oferta_sin_afinidad, etapa_ganado_masivo / etapa_ganado_individual, y precio por programa.
  Solo se activan si la acción trae los campos nuevos (programa_ofrecido,
  audiencia_pct_afinidad_baja, campo_crm = etapa_crm). El banco v1 no los trae, así que
  su piso de reglas NO cambia (293 ALLOW / 70 REVIEW / 37 BLOCK).
"""
import json
import re

SEV = {"ALLOW": 0, "REVIEW": 1, "BLOCK": 2}

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]

POLICY = {
    "version": "demo-v1 (17 oct 12:45; supuestos de demostración + datos de perfiles de 30X; aprobada por Helian)",
    "umbral_audiencia_revision": 5000,
    "horario_masivos": {"inicio": "07:00", "fin": "20:00",
                        "aplica_a": ["correo_masivo", "whatsapp_masivo"]},
    "canales_oficiales": ["correo_oficial", "whatsapp_oficial", "instagram_oficial",
                          "linkedin_oficial", "crm"],
    "campos_crm_protegidos": ["consentimiento_marketing", "estado_pago", "nivel_acceso",
                              "descuento_aprobado"],
    "catalogo_precios_usd": {"sesion_abierta": 99},
    # Precios de lista de los programas, en USD. Solo entran los que tienen precio público.
    # FUENTE: 30x.com, páginas de cada programa, consultadas el 17 oct 2026, 6 p.m. Helian confirmó que son USD.
    # "Free Sales Training" es gratuito por nombre (supuesto).
    # Un programa que NO está aquí no tiene verificación de precio: la regla precio_inconsistente no se activa
    # para él. El precio de la sesión abierta (catalogo_precios_usd) se usa solo cuando la acción NO declara programa.
    "catalogo_programas_usd": {
        "AI for Executives": 2000,
        "AI for devs": 1500,
        "Ventas con LinkedIn": 1950,
        "Sales Machine": 1950,
        "AI Sales": 1950,
        "Free Sales Training": 0,
    },
    "catalogo_programas_fuente": "30x.com, páginas de cada programa, 17 oct 2026, 6 p.m. (USD)",
    # Supuesto: todos los programas de la base son pagos salvo Free Sales Training.
    "programas_pagos": ["AI Sales", "Sales Machine", "Inmersión Ejecutiva", "30X Executive Program",
                        "AI for Executives", "Hardcore AI", "AI for devs", "AI Second Brain",
                        "Achievers", "Negociacion", "Ventas con LinkedIn", "Multipliers", "B2B",
                        "Next Fellowship", "Fundraising School"],
    # Regla de afinidad: ofrecer un programa pago por canal masivo a una audiencia donde al menos
    # la mitad tiene afinidad baja (0-3). Severidad REVIEW, no BLOCK: 3 de los 10 clientes que
    # pagaron en la muestra tenían afinidad 0-1 (ver base de conocimiento, sección 3.4).
    "regla_afinidad": {"aplica_a": ["correo_masivo", "whatsapp_masivo"],
                       "banda_baja": "0-3 (baja)", "umbral_pct_baja": 0.5},
    # Etapas reales del CRM de 30X (base de perfiles). Marcar un deal como ganado equivale a
    # registrar un pago: es un cambio protegido. Mover entre otras etapas no se frena.
    "etapas_ganado": ["Ganado Pagado Completo", "Ganado Pago Parcial"],
    "reversibilidad_por_tipo": {"correo_masivo": "irreversible", "whatsapp_masivo": "irreversible",
                                "publicacion_redes": "parcial", "crm_update": "reversible"},
    "severidad": {
        "canal_no_oficial": "BLOCK",
        "en_lista_de_bajas": "BLOCK",
        "campo_protegido_masivo": "BLOCK",
        "campo_protegido_individual": "REVIEW",
        "etapa_ganado_masivo": "BLOCK",
        "etapa_ganado_individual": "REVIEW",
        "audiencia_grande": "REVIEW",
        "fuera_de_horario": "REVIEW",
        "fecha_inconsistente": "REVIEW",
        "precio_inconsistente": "REVIEW",
        "oferta_sin_afinidad": "REVIEW",
    },
}


def parse_fecha_es(s):
    m = re.match(r"^\s*(\d{1,2}) de ([a-záéíóú]+)", s.strip().lower())
    if not m or m.group(2) not in MESES:
        return None
    return (int(m.group(1)), MESES.index(m.group(2)) + 1)


def _vacio(v):
    return v is None or v == ""


def rules_floor(r, P=POLICY):
    """Devuelve (decision_piso, [reglas_activadas]) para una acción (fila del banco o de la demo)."""
    state = {"dec": "ALLOW"}
    fired = []

    def up(name):
        d = P["severidad"][name]
        fired.append(name)
        if SEV[d] > SEV[state["dec"]]:
            state["dec"] = d

    tipo = r["tipo_accion"]
    dest = int(r["destinatarios"] or 0)

    if r["canal"] not in P["canales_oficiales"]:
        up("canal_no_oficial")
    if not _vacio(r.get("en_lista_de_bajas")) and int(float(r["en_lista_de_bajas"])) > 0:
        up("en_lista_de_bajas")
    if tipo == "crm_update" and r.get("campo_crm") in P["campos_crm_protegidos"]:
        up("campo_protegido_masivo" if dest > 1 else "campo_protegido_individual")
    if (tipo == "crm_update" and r.get("campo_crm") == "etapa_crm"
            and (r.get("texto") or "").strip() in P["etapas_ganado"]):
        up("etapa_ganado_masivo" if dest > 1 else "etapa_ganado_individual")
    if dest > P["umbral_audiencia_revision"]:
        up("audiencia_grande")
    h = P["horario_masivos"]
    if tipo in h["aplica_a"] and not (h["inicio"] <= r["hora_envio"] < h["fin"]):
        up("fuera_de_horario")
    if r.get("fecha_evento_real") and r.get("fecha_en_texto"):
        y, m, d = [int(x) for x in r["fecha_evento_real"].split("-")]
        t = parse_fecha_es(r["fecha_en_texto"])
        if t is None or t != (d, m):
            up("fecha_inconsistente")
    if not _vacio(r.get("precio_en_texto_usd")):
        prog = r.get("programa_ofrecido")
        if _vacio(prog):
            # Sin programa declarado: se compara con el precio de la sesión abierta.
            ref = P["catalogo_precios_usd"]["sesion_abierta"]
        else:
            # Con programa declarado: su precio de catálogo. Si el programa no está en el catálogo, ref es None y
            # la regla NO se activa (no hay precio con qué comparar; no se usa el de la sesión abierta).
            ref = P["catalogo_programas_usd"].get(prog)
        if ref is not None and float(r["precio_en_texto_usd"]) != ref:
            up("precio_inconsistente")
    ra = P["regla_afinidad"]
    if (tipo in ra["aplica_a"] and r.get("programa_ofrecido") in P["programas_pagos"]
            and not _vacio(r.get("audiencia_pct_afinidad_baja"))
            and float(r["audiencia_pct_afinidad_baja"]) >= ra["umbral_pct_baja"]):
        up("oferta_sin_afinidad")
    return state["dec"], fired


if __name__ == "__main__":
    with open("data/policy_demo.json", "w", encoding="utf-8") as f:
        json.dump(POLICY, f, ensure_ascii=False, indent=2)
    print("data/policy_demo.json escrito")
