import { DEAL, LEAD, filtrarAudiencia, type FiltroAudiencia, type ResultadoAudiencia } from "./perfiles";

export interface DefinicionAudiencia {
  id: string;
  nombre: string;
  filtro: FiltroAudiencia;
}

/**
 * Las 6 audiencias de la demo (data/audiencias_demo.json). Los filtros se reconstruyeron a partir de
 * sus nombres y se verificaron contra las cifras del JSON (tests/perfiles.test.ts).
 */
export const AUDIENCIAS: DefinicionAudiencia[] = [
  {
    id: "A1",
    nombre: "Leads con afinidad muy alta y sugeridos a Inmersión Ejecutiva",
    filtro: { relacion: LEAD, banda_afinidad: ["9-10 (muy alta)"], programa_sugerido: "Inmersión Ejecutiva" },
  },
  { id: "A2", nombre: "Toda la base de leads (sin deal)", filtro: { relacion: LEAD } },
  {
    id: "A3",
    nombre: "Leads sin programa sugerido",
    filtro: { relacion: LEAD, programa_sugerido: "Sin programa sugerido" },
  },
  {
    id: "A4",
    nombre: "Deals en proceso sugeridos a AI Sales con afinidad alta o muy alta",
    filtro: {
      relacion: DEAL,
      estado: "En proceso",
      programa_sugerido: "AI Sales",
      banda_afinidad: ["7-8 (alta)", "9-10 (muy alta)"],
    },
  },
  { id: "A5", nombre: "Leads cuyo objetivo es vender más", filtro: { relacion: LEAD, objetivo_principal: "Vender más" } },
  { id: "A6", nombre: "Deals con cierre perdido", filtro: { relacion: DEAL, etapa_crm: "Cierre perdido" } },
];

export interface AudienciaResuelta extends ResultadoAudiencia {
  id: string;
  nombre: string;
}

export function resolverAudiencia(id: string): AudienciaResuelta | undefined {
  const def = AUDIENCIAS.find((a) => a.id === id);
  if (!def) return undefined;
  return { id: def.id, nombre: def.nombre, ...filtrarAudiencia(def.filtro) };
}
