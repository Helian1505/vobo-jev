/**
 * ───────────────────────────────────────────────────────────────────────────────────────────────
 *  EJEMPLO: el mapeo real depende del stack de 30X.
 * ───────────────────────────────────────────────────────────────────────────────────────────────
 * PATRÓN COMPLEMENTARIO: el agente (o un middleware) consulta antes de actuar. No es el paso principal de la
 * integración: el principal es una compuerta dentro de los flujos (integraciones/n8n/ y docs/INTEGRACION.md).
 *
 * Este adaptador NO describe ningún CRM real ni afirma nada sobre los sistemas de 30X. Muestra el
 * patrón: tomar el evento que emite un CRM cualquiera cuando cambia un deal («deal.updated», con la
 * etapa o el campo que cambió y su nuevo valor) y traducirlo a una AccionAgente que VoBo entiende.
 * Quien integre debe reemplazar el esquema de entrada y la tabla CAMPOS por los de su CRM.
 *
 * Uso típico (patrón «middleware»): el CRM llama a tu endpoint → mapearDealUpdated() → POST a
 * /api/evaluate → según la decisión, dejas pasar el cambio, lo encolas o lo revierte. Ver docs/INTEGRACION.md.
 */
import { z } from "zod";
import type { AccionAgente } from "../src/lib/vobo/types";

/** Payload genérico de ejemplo (ver adapters/fixtures/). Los nombres de campos son inventados, a propósito. */
export const dealUpdatedSchema = z.object({
  event: z.literal("deal.updated"),
  event_id: z.string().min(1),
  /** Momento del cambio, ISO 8601 en UTC. */
  occurred_at: z.string().datetime(),
  deal: z.object({ id: z.string().min(1) }),
  change: z.object({
    field: z.string().min(1),
    from: z.string().nullable().optional(),
    to: z.string(),
  }),
  /** Cuántos deals toca el cambio (1 si es uno solo; más si el agente lo aplicó en lote). */
  records_affected: z.number().int().min(1).default(1),
});

export type DealUpdated = z.infer<typeof dealUpdatedSchema>;

/**
 * Nombre del campo en el CRM de ejemplo → nombre del campo que VoBo conoce (docs/BASE_CONOCIMIENTO_30X.md y
 * data/policy_demo.json). Un campo que no está en la tabla se manda tal cual: VoBo solo frena los protegidos.
 */
export const CAMPOS: Record<string, string> = {
  stage: "etapa_crm",
  payment_status: "estado_pago",
  marketing_consent: "consentimiento_marketing",
  access_level: "nivel_acceso",
  approved_discount: "descuento_aprobado",
  notes: "notas",
};

/** HH:MM en hora de Bogotá (UTC-5, sin horario de verano) a partir de un instante ISO en UTC. */
export function horaBogota(isoUtc: string): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(isoUtc));
}

/**
 * Traduce un «deal.updated» a la acción que se le pide evaluar a VoBo. Lanza (ZodError) si el payload
 * no tiene la forma esperada: quien llama decide qué hacer (lo razonable: tratarlo como PEDIR VOBO).
 */
export function mapearDealUpdated(payload: unknown): AccionAgente {
  const p = dealUpdatedSchema.parse(payload);
  return {
    id: p.event_id,
    tipo_accion: "crm_update",
    canal: "crm",
    destinatarios: p.records_affected,
    segmento_declarado: "comunidad_general", // un cambio de CRM no tiene público: se omite la pregunta de segmento
    hora_envio: horaBogota(p.occurred_at),
    campo_crm: CAMPOS[p.change.field] ?? p.change.field,
    texto: p.change.to, // en crm_update, el texto es el valor que se escribe
  };
}
