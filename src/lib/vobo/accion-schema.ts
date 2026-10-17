import { z } from "zod";

export const MAX_TEXTO = 2000;

const vacioAUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const opcional = <T extends z.ZodType>(s: T) => z.preprocess(vacioAUndefined, s.optional());

/** Entrada de POST /api/evaluate (CLAUDE.md §5.1 y §8.1). Las llaves desconocidas se descartan. */
export const accionSchema = z.object({
  id: opcional(z.string().max(64)),
  tipo_accion: z.enum(["correo_masivo", "whatsapp_masivo", "publicacion_redes", "crm_update"]),
  canal: z.string().min(1).max(100),
  destinatarios: z.number().int().min(0).max(100_000_000),
  segmento_declarado: z.enum(["founders", "ejecutivos", "equipos_tecnicos", "estudiantes", "comunidad_general"]),
  hora_envio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "hora_envio debe ser HH:MM (24 h)"),
  campo_crm: opcional(z.string().max(100)),
  fecha_evento_real: opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha_evento_real debe ser AAAA-MM-DD")),
  fecha_en_texto: opcional(z.string().max(100)),
  precio_en_texto_usd: opcional(z.number().min(0).max(1_000_000)),
  en_lista_de_bajas: opcional(z.number().int().min(0).max(100_000_000)),
  texto: z.string().max(MAX_TEXTO, `El texto admite como máximo ${MAX_TEXTO} caracteres.`),
  programa_ofrecido: opcional(z.string().max(100)),
  audiencia_id: opcional(z.string().max(20)),
  // Se acepta por compatibilidad, pero la ruta lo recalcula desde audiencia_id y descarta el del cliente.
  audiencia_pct_afinidad_baja: opcional(z.number().min(0).max(1)),
  perfil_id: opcional(z.string().max(20)),
});

export type AccionEntrada = z.infer<typeof accionSchema>;
