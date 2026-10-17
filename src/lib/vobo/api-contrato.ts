import type { Evaluacion } from "./evaluate";

/**
 * Versión del contrato de respuesta de POST /api/evaluate. Cambia solo si se rompe o se quita un campo;
 * agregar campos nuevos no la cambia. Ver docs/INTEGRACION.md.
 */
export const SCHEMA_VERSION = "1" as const;

/** Cuerpo de una respuesta 200 de POST /api/evaluate: la Evaluacion más dos campos de contrato. */
export type RespuestaEvaluate = Evaluacion & {
  schema_version: typeof SCHEMA_VERSION;
  /** UUID de esta solicitud; también va en el encabezado x-request-id. Sirve para correlacionar y auditar. */
  request_id: string;
};
