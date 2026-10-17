import type { Evaluacion } from "./evaluate";
import type { Decision } from "./types";

/**
 * Versión del contrato de respuesta de POST /api/evaluate. Cambia solo si se rompe o se quita un campo;
 * agregar campos nuevos no la cambia. Ver docs/INTEGRACION.md.
 */
export const SCHEMA_VERSION = "1" as const;

/** Objeto plano (solo textos y números) para guardar la decisión, p. ej. como registro en un CRM. */
export interface RegistroDecision {
  request_id: string;
  /** ISO 8601 en UTC. */
  timestamp: string;
  decision: Decision;
  piso_reglas: Decision;
  riesgo_jev: Decision;
  /** Nombres de las reglas activadas, separados por coma (vacío si ninguna). */
  reglas: string;
  modelo: string;
  jev_estado: string;
  tipo_accion: string;
  id_accion: string | null;
}

/**
 * Cuerpo de una respuesta 200 de POST /api/evaluate: la Evaluacion más los campos de contrato.
 * Agregar campos no cambia schema_version.
 */
export type RespuestaEvaluate = Evaluacion & {
  schema_version: typeof SCHEMA_VERSION;
  /** UUID de esta solicitud; también va en el encabezado x-request-id. Sirve para correlacionar y auditar. */
  request_id: string;
  /** Texto corto en español para mandar a una persona por Slack o WhatsApp: qué acción, decisión y 2–3 razones. */
  resumen_aprobacion: string;
  /** Objeto plano para guardar la decisión (por ejemplo, como registro en un CRM). */
  registro: RegistroDecision;
};
