import { ETIQUETA_DECISION } from "./combine";
import { SCHEMA_VERSION, type RegistroDecision, type RespuestaEvaluate } from "./api-contrato";
import type { Evaluacion } from "./evaluate";
import type { AccionAgente } from "./types";
import { miles } from "./ui-datos";

const MAX_RAZONES = 3;
const MAX_CHARS_RAZON = 220;
const MAX_CHARS_TEXTO = 120;

const recortar = (s: string, n: number) => {
  const limpio = s.replace(/\s+/g, " ").trim();
  return limpio.length > n ? `${limpio.slice(0, n - 1).trimEnd()}…` : limpio;
};

/** «correo masivo a 9.000 destinatarios por «correo_oficial»» y equivalentes, en español. */
function describirAccion(a: AccionAgente): string {
  const id = a.id ? ` (id ${a.id})` : "";
  switch (a.tipo_accion) {
    case "correo_masivo":
      return `correo masivo a ${miles(a.destinatarios)} destinatarios por «${a.canal}»${id}`;
    case "whatsapp_masivo":
      return `WhatsApp masivo a ${miles(a.destinatarios)} destinatarios por «${a.canal}»${id}`;
    case "publicacion_redes":
      return `publicación en «${a.canal}»${id}`;
    case "crm_update": {
      const campo = a.campo_crm ? `«${a.campo_crm}»` : "un campo";
      return `cambio en el CRM: ${campo} en ${miles(a.destinatarios)} contacto(s)${id}`;
    }
  }
}

/**
 * Texto corto en español para mandar a una persona por Slack o WhatsApp (*negritas* con asteriscos, que
 * ambos entienden): qué acción es, qué decidió VoBo y 2–3 razones. Sale solo de datos que ya existen.
 */
export function construirResumenAprobacion(accion: AccionAgente, ev: Evaluacion, requestId: string): string {
  const lineas = [`*VoBo: ${ETIQUETA_DECISION[ev.decision]}*`, `Acción: ${describirAccion(accion)}`];
  if (accion.texto.trim()) lineas.push(`Texto: «${recortar(accion.texto, MAX_CHARS_TEXTO)}»`);

  const razones = ev.explicacion.razones;
  if (ev.decision === "ALLOW" || razones.length === 0) {
    lineas.push("No se encontraron problemas.");
  } else {
    lineas.push("Por qué:");
    for (const r of razones.slice(0, MAX_RAZONES)) lineas.push(`• ${recortar(r, MAX_CHARS_RAZON)}`);
    if (razones.length > MAX_RAZONES) lineas.push(`(y ${razones.length - MAX_RAZONES} más en el detalle)`);
  }
  lineas.push(`Solicitud: ${requestId.slice(0, 8)}`);
  return lineas.join("\n");
}

/**
 * Objeto PLANO (solo textos y números) para guardar la decisión donde haga falta, por ejemplo como registro en un
 * CRM. Las reglas van como un solo texto separado por comas porque los campos de un CRM suelen ser escalares.
 */
export function construirRegistro(accion: AccionAgente, ev: Evaluacion, requestId: string, ahora: Date = new Date()): RegistroDecision {
  return {
    request_id: requestId,
    timestamp: ahora.toISOString(),
    decision: ev.decision,
    piso_reglas: ev.piso_reglas,
    riesgo_jev: ev.riesgo_jev,
    reglas: ev.reglas.map((r) => r.regla).join(","),
    modelo: ev.traza.modelo,
    jev_estado: ev.jev_estado,
    tipo_accion: accion.tipo_accion,
    id_accion: accion.id ?? null,
  };
}

/** Cuerpo de una respuesta 200 de POST /api/evaluate: la Evaluacion más los campos de contrato. */
export function armarRespuestaEvaluate(accion: AccionAgente, ev: Evaluacion, requestId: string, ahora: Date = new Date()): RespuestaEvaluate {
  return {
    schema_version: SCHEMA_VERSION,
    request_id: requestId,
    ...ev,
    resumen_aprobacion: construirResumenAprobacion(accion, ev, requestId),
    registro: construirRegistro(accion, ev, requestId, ahora),
  };
}
