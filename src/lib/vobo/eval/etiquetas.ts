import { parseCsvConEncabezado } from "../csv";
import type { Decision } from "../types";

export interface Etiqueta {
  id: string;
  split: "dev" | "test";
  decision_final: Decision;
  origen_etiqueta: string;
  ambigua: boolean;
  familia: string;
}

const DECISIONES = new Set<string>(["ALLOW", "REVIEW", "BLOCK"]);

/** data/etiquetas_v1.csv → etiquetas. Falla si una fila trae una decisión desconocida. */
export function parseEtiquetas(csv: string): Etiqueta[] {
  return parseCsvConEncabezado(csv).map((f) => {
    const d = f.decision_final ?? "";
    if (!DECISIONES.has(d)) throw new Error(`Etiqueta inválida en ${f.id}: «${d}»`);
    return {
      id: f.id as string,
      split: f.split === "test" ? "test" : "dev",
      decision_final: d as Decision,
      origen_etiqueta: f.origen_etiqueta ?? "",
      ambigua: f.ambigua === "SI",
      familia: f.familia ?? "",
    };
  });
}
