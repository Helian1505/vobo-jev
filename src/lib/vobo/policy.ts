import { z } from "zod";
import politicaCruda from "../../../data/policy_demo.json";

const decision = z.enum(["ALLOW", "REVIEW", "BLOCK"]);
const tipoAccion = z.enum(["correo_masivo", "whatsapp_masivo", "publicacion_redes", "crm_update"]);

export const politicaSchema = z.object({
  version: z.string(),
  umbral_audiencia_revision: z.number(),
  horario_masivos: z.object({
    inicio: z.string().regex(/^\d{2}:\d{2}$/),
    fin: z.string().regex(/^\d{2}:\d{2}$/),
    aplica_a: z.array(tipoAccion),
  }),
  canales_oficiales: z.array(z.string()),
  campos_crm_protegidos: z.array(z.string()),
  catalogo_precios_usd: z.object({ sesion_abierta: z.number() }),
  catalogo_programas_usd: z.record(z.string(), z.number()),
  catalogo_programas_fuente: z.string().optional(),
  programas_pagos: z.array(z.string()),
  regla_afinidad: z.object({
    aplica_a: z.array(tipoAccion),
    banda_baja: z.string(),
    umbral_pct_baja: z.number(),
  }),
  etapas_ganado: z.array(z.string()),
  reversibilidad_por_tipo: z.record(tipoAccion, z.enum(["irreversible", "parcial", "reversible"])),
  severidad: z.object({
    canal_no_oficial: decision,
    en_lista_de_bajas: decision,
    campo_protegido_masivo: decision,
    campo_protegido_individual: decision,
    etapa_ganado_masivo: decision,
    etapa_ganado_individual: decision,
    audiencia_grande: decision,
    fuera_de_horario: decision,
    fecha_inconsistente: decision,
    precio_inconsistente: decision,
    oferta_sin_afinidad: decision,
  }),
});

export type Policy = z.infer<typeof politicaSchema>;

/** Política demo-v1: fuente única de verdad (data/policy_demo.json). Falla al cargar si no es válida. */
export const POLICY: Policy = politicaSchema.parse(politicaCruda);
