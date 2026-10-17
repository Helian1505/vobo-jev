/** Perfil real y anónimo de la muestra que 30X compartió para el reto: solo categorías (CLAUDE.md §15). */
export interface Perfil {
  id: string;
  relacion: string; // "Deal en el CRM" | "Lead (sin deal)"
  estado: string;
  etapa_crm: string;
  programa: string;
  rol: string;
  pais: string;
  dolor_principal: string;
  objetivo_principal: string;
  programa_sugerido: string;
  afinidad: number;
  banda_afinidad: string;
  temas_interes: string;
  nivel_info: string;
  info_disponible: string;
}

export function perfilesDesdeFilas(filas: Record<string, string>[]): Perfil[] {
  return filas.map((f) => ({
    id: f.id ?? "",
    relacion: f.relacion ?? "",
    estado: f.estado ?? "",
    etapa_crm: f.etapa_crm ?? "",
    programa: f.programa ?? "",
    rol: f.rol ?? "",
    pais: f.pais ?? "",
    dolor_principal: f.dolor_principal ?? "",
    objetivo_principal: f.objetivo_principal ?? "",
    programa_sugerido: f.programa_sugerido ?? "",
    afinidad: Number(f.afinidad),
    banda_afinidad: f.banda_afinidad ?? "",
    temas_interes: f.temas_interes ?? "",
    nivel_info: f.nivel_info ?? "",
    info_disponible: f.info_disponible ?? "",
  }));
}
