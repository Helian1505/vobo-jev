import perfilesJson from "../../generated/perfiles.json";
import type { Perfil } from "./perfiles-datos";

export const PERFILES: Perfil[] = perfilesJson as Perfil[];

export const LEAD = "Lead (sin deal)";
export const DEAL = "Deal en el CRM";
export const BANDA_BAJA = "0-3 (baja)";

/**
 * Base real de 30X (docs/BASE_CONOCIMIENTO_30X.md): ≈ 24.800 contactos con deal y ≈ 7.500 leads.
 * El factor de escala de cada relación es base real ÷ perfiles de la muestra. Se calcula exacto y no
 * con los valores redondeados de audiencias_demo.json (18,8 y 83,22), porque redondeados dan 7.501
 * en la audiencia A2 en lugar de 7.500.
 */
export const BASE_REAL: Record<string, number> = { [DEAL]: 24_800, [LEAD]: 7_500 };

export function factoresEscala(perfiles: Perfil[] = PERFILES): Record<string, number> {
  const factores: Record<string, number> = {};
  for (const relacion of Object.keys(BASE_REAL)) {
    const n = perfiles.filter((p) => p.relacion === relacion).length;
    factores[relacion] = n > 0 ? (BASE_REAL[relacion] as number) / n : 0;
  }
  return factores;
}

export interface FiltroAudiencia {
  relacion?: string;
  estado?: string;
  etapa_crm?: string;
  programa_sugerido?: string;
  banda_afinidad?: string[];
  objetivo_principal?: string;
}

export interface ResultadoAudiencia {
  perfiles_en_muestra: number;
  /** round(Σ factor[relacion]): personas aproximadas en la base real. */
  destinatarios_estimados: number;
  /** 0–1: proporción de perfiles con afinidad baja (0–3). */
  pct_afinidad_baja: number;
  ids: string[];
}

export function filtrarAudiencia(filtro: FiltroAudiencia, perfiles: Perfil[] = PERFILES): ResultadoAudiencia {
  const factores = factoresEscala(perfiles);
  const sel = perfiles.filter(
    (p) =>
      (filtro.relacion === undefined || p.relacion === filtro.relacion) &&
      (filtro.estado === undefined || p.estado === filtro.estado) &&
      (filtro.etapa_crm === undefined || p.etapa_crm === filtro.etapa_crm) &&
      (filtro.programa_sugerido === undefined || p.programa_sugerido === filtro.programa_sugerido) &&
      (filtro.banda_afinidad === undefined || filtro.banda_afinidad.includes(p.banda_afinidad)) &&
      (filtro.objetivo_principal === undefined || p.objetivo_principal === filtro.objetivo_principal),
  );
  const personas = sel.reduce((s, p) => s + (factores[p.relacion] ?? 0), 0);
  const bajas = sel.filter((p) => p.banda_afinidad === BANDA_BAJA).length;
  return {
    perfiles_en_muestra: sel.length,
    destinatarios_estimados: Math.round(personas),
    pct_afinidad_baja: sel.length > 0 ? bajas / sel.length : 0,
    ids: sel.map((p) => p.id),
  };
}

export function perfilPorId(id: string, perfiles: Perfil[] = PERFILES): Perfil | undefined {
  return perfiles.find((p) => p.id === id);
}
