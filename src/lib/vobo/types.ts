export type TipoAccion = "correo_masivo" | "whatsapp_masivo" | "publicacion_redes" | "crm_update";

export type Decision = "ALLOW" | "REVIEW" | "BLOCK"; // en la UI: PERMITIR / PEDIR VOBO / BLOQUEAR

export const SEV = { ALLOW: 0, REVIEW: 1, BLOCK: 2 } as const;

export type Segmento =
  | "founders"
  | "ejecutivos"
  | "equipos_tecnicos"
  | "estudiantes"
  | "comunidad_general";

export type Reversibilidad = "irreversible" | "parcial" | "reversible";

export interface AccionAgente {
  id?: string;
  tipo_accion: TipoAccion;
  canal: string; // ej. "correo_oficial", "numero_personal_whatsapp"
  destinatarios: number; // 0 en publicaciones de redes
  segmento_declarado: Segmento;
  hora_envio: string; // "HH:MM", 24 h, hora Bogotá
  campo_crm?: string; // solo en crm_update
  fecha_evento_real?: string; // "YYYY-MM-DD"
  fecha_en_texto?: string; // ej. "12 de noviembre" (extraída por el agente)
  precio_en_texto_usd?: number;
  en_lista_de_bajas?: number; // cuántos destinatarios están en la lista de bajas
  texto: string; // contenido; en crm_update es el valor que se escribe
  // Campos v2 (opcionales; el banco v1 no los trae):
  programa_ofrecido?: string; // nombre real del programa (docs/BASE_CONOCIMIENTO_30X.md §2)
  audiencia_id?: string; // id de data/audiencias_demo.json
  audiencia_pct_afinidad_baja?: number; // 0–1, lo calcula perfiles.ts (nunca lo escribe el usuario)
  perfil_id?: string; // "P-298", para crm_update sobre un perfil
}

export type NombreRegla =
  | "canal_no_oficial"
  | "en_lista_de_bajas"
  | "campo_protegido_masivo"
  | "campo_protegido_individual"
  | "etapa_ganado_masivo"
  | "etapa_ganado_individual"
  | "audiencia_grande"
  | "fuera_de_horario"
  | "fecha_inconsistente"
  | "precio_inconsistente"
  | "oferta_sin_afinidad";

export interface ReglaActivada {
  regla: NombreRegla;
  decision: Decision;
  /** Datos para las plantillas de explicación (explain.ts). */
  detalle: Record<string, unknown>;
}
