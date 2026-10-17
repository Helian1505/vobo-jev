import { SEV, type Decision } from "./types";

export type Modo = "combinado" | "solo_reglas" | "solo_jev";

const max = (a: Decision, b: Decision): Decision => (SEV[b] > SEV[a] ? b : a);

/**
 * Capa 3 (CLAUDE.md §2 y §7): riesgo final = max(piso de reglas, riesgo según JEV). JEV solo puede
 * subir el riesgo, nunca bajarlo. Los modos solo_reglas y solo_jev existen para comparar en la
 * evaluación del banco; no se usan en producción.
 */
export function combinar(piso: Decision, riesgoJev: Decision, modo: Modo = "combinado"): Decision {
  if (modo === "solo_reglas") return piso;
  if (modo === "solo_jev") return riesgoJev;
  return max(piso, riesgoJev);
}

export const ETIQUETA_DECISION: Record<Decision, string> = {
  ALLOW: "PERMITIR",
  REVIEW: "PEDIR VOBO",
  BLOCK: "BLOQUEAR",
};
