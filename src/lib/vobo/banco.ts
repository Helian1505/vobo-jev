import type { AccionAgente, Segmento, TipoAccion } from "./types";

export type FilaBanco = Record<string, string>;

const vacio = (v: string | undefined): v is undefined | "" => v === undefined || v === "";

/** Fila del CSV del banco → AccionAgente. Celdas vacías = undefined; enteros y precio como número. */
export function accionDesdeFila(f: FilaBanco): AccionAgente {
  const a: AccionAgente = {
    id: f.id,
    tipo_accion: f.tipo_accion as TipoAccion,
    canal: f.canal ?? "",
    destinatarios: vacio(f.destinatarios) ? 0 : Math.trunc(Number(f.destinatarios)),
    segmento_declarado: f.segmento_declarado as Segmento,
    hora_envio: f.hora_envio ?? "",
    texto: f.texto ?? "",
  };
  if (!vacio(f.campo_crm)) a.campo_crm = f.campo_crm;
  if (!vacio(f.fecha_evento_real)) a.fecha_evento_real = f.fecha_evento_real;
  if (!vacio(f.fecha_en_texto)) a.fecha_en_texto = f.fecha_en_texto;
  if (!vacio(f.precio_en_texto_usd)) a.precio_en_texto_usd = Number(f.precio_en_texto_usd);
  if (!vacio(f.en_lista_de_bajas)) a.en_lista_de_bajas = Math.trunc(Number(f.en_lista_de_bajas));
  return a;
}
