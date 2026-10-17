import type { NombreRegla } from "./types";

export const ETIQUETA_REGLA: Record<NombreRegla, string> = {
  canal_no_oficial: "Canal no oficial",
  en_lista_de_bajas: "Destinatarios en la lista de bajas",
  campo_protegido_masivo: "Campo protegido en varios contactos",
  campo_protegido_individual: "Campo protegido en un contacto",
  etapa_ganado_masivo: "Etapa «Ganado» en varios deals",
  etapa_ganado_individual: "Etapa «Ganado» en un deal",
  audiencia_grande: "Audiencia grande",
  fuera_de_horario: "Fuera de horario",
  fecha_inconsistente: "Fecha inconsistente",
  precio_inconsistente: "Precio inconsistente",
  oferta_sin_afinidad: "Oferta sin afinidad",
};

export const ETIQUETA_PREGUNTA: Record<string, string> = {
  promesa: "Promesa de resultados",
  certificacion: "Título o certificación oficial",
  datos_personales: "Datos personales de terceros",
  instruccion_agente: "Instrucción dirigida a un agente",
  afirmacion: "Afirmaciones de impacto",
  segmento: "Público al que va dirigido",
  tono: "Tono",
};

export const TIPOS_ACCION = [
  { valor: "correo_masivo", etiqueta: "Correo masivo" },
  { valor: "whatsapp_masivo", etiqueta: "WhatsApp masivo" },
  { valor: "publicacion_redes", etiqueta: "Publicación en redes" },
  { valor: "crm_update", etiqueta: "Cambio en el CRM" },
] as const;

// «estudiantes» existe en el banco sintético pero no en los datos de 30X: no se ofrece en la demo (docs/BASE_CONOCIMIENTO_30X.md §4).
export const SEGMENTOS = [
  { valor: "founders", etiqueta: "Founders" },
  { valor: "ejecutivos", etiqueta: "Ejecutivos" },
  { valor: "equipos_tecnicos", etiqueta: "Equipos técnicos" },
  { valor: "comunidad_general", etiqueta: "Comunidad general" },
] as const;

export const CANALES_SUGERIDOS = [
  "correo_oficial",
  "whatsapp_oficial",
  "instagram_oficial",
  "linkedin_oficial",
  "crm",
  "numero_personal_whatsapp",
  "gmail_personal",
];

export const CAMPOS_CRM_SUGERIDOS = [
  "etapa_crm",
  "notas",
  "consentimiento_marketing",
  "estado_pago",
  "nivel_acceso",
  "descuento_aprobado",
];

/** Estado del formulario: todo como texto, tal como lo escribe la persona. */
export interface FormEstado {
  tipo_accion: string;
  canal: string;
  programa_ofrecido: string;
  audiencia_id: string;
  perfil_id: string;
  destinatarios: string;
  segmento_declarado: string;
  hora_envio: string;
  campo_crm: string;
  fecha_evento_real: string;
  fecha_en_texto: string;
  precio_en_texto_usd: string;
  en_lista_de_bajas: string;
  texto: string;
}

export const FORM_VACIO: FormEstado = {
  tipo_accion: "correo_masivo",
  canal: "correo_oficial",
  programa_ofrecido: "",
  audiencia_id: "",
  perfil_id: "",
  destinatarios: "800",
  segmento_declarado: "comunidad_general",
  hora_envio: "10:00",
  campo_crm: "",
  fecha_evento_real: "",
  fecha_en_texto: "",
  precio_en_texto_usd: "",
  en_lista_de_bajas: "",
  texto: "",
};

const texto = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/** Acción de un ejemplo (data/ejemplos_demo.json) → estado del formulario. */
export function estadoDesdeAccion(a: Record<string, unknown>): FormEstado {
  return {
    tipo_accion: texto(a.tipo_accion) || FORM_VACIO.tipo_accion,
    canal: texto(a.canal) || FORM_VACIO.canal,
    programa_ofrecido: texto(a.programa_ofrecido),
    audiencia_id: texto(a.audiencia_id),
    perfil_id: texto(a.perfil_id),
    destinatarios: texto(a.destinatarios ?? 0),
    segmento_declarado: texto(a.segmento_declarado) || FORM_VACIO.segmento_declarado,
    hora_envio: texto(a.hora_envio) || FORM_VACIO.hora_envio,
    campo_crm: texto(a.campo_crm),
    fecha_evento_real: texto(a.fecha_evento_real),
    fecha_en_texto: texto(a.fecha_en_texto),
    precio_en_texto_usd: texto(a.precio_en_texto_usd),
    en_lista_de_bajas: texto(a.en_lista_de_bajas),
    texto: texto(a.texto),
  };
}

const entero = (v: string) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Formulario → cuerpo de POST /api/evaluate. Los campos vacíos se omiten.
 * La afinidad de la audiencia NO se manda: la calcula el servidor desde audiencia_id.
 */
export function cuerpoDesdeEstado(e: FormEstado): Record<string, unknown> {
  const c: Record<string, unknown> = {
    tipo_accion: e.tipo_accion,
    canal: e.canal.trim(),
    destinatarios: e.tipo_accion === "publicacion_redes" ? 0 : entero(e.destinatarios),
    segmento_declarado: e.segmento_declarado,
    hora_envio: e.hora_envio,
    texto: e.texto,
  };
  const vacioOmitir: [keyof FormEstado, string][] = [
    ["programa_ofrecido", e.programa_ofrecido],
    ["audiencia_id", e.audiencia_id],
    ["perfil_id", e.perfil_id],
    ["campo_crm", e.campo_crm],
    ["fecha_evento_real", e.fecha_evento_real],
    ["fecha_en_texto", e.fecha_en_texto],
  ];
  for (const [k, v] of vacioOmitir) if (v.trim() !== "") c[k] = v.trim();
  if (e.precio_en_texto_usd.trim() !== "" && Number.isFinite(Number(e.precio_en_texto_usd))) {
    c.precio_en_texto_usd = Number(e.precio_en_texto_usd);
  }
  if (e.en_lista_de_bajas.trim() !== "") c.en_lista_de_bajas = entero(e.en_lista_de_bajas);
  return c;
}

export const miles = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Porcentaje con un decimal y coma decimal: 0,831 → «83,1%». */
export const pct1 = (p: number | null) => (p === null ? "—" : `${(p * 100).toFixed(1).replace(".", ",")}%`);

/** USD con los decimales justos para costos de fracciones de centavo. */
export function usd(n: number): string {
  if (n === 0) return "USD 0";
  const decimales = n < 0.01 ? 6 : n < 1 ? 4 : 2;
  return `USD ${n.toFixed(decimales)}`;
}
