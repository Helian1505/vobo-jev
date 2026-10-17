import { z } from "zod";
import umbralesCrudos from "../../../data/thresholds.json";
import type { Reversibilidad } from "./types";

export type PerfilUmbral = "estricto" | "normal" | "laxo";

const perfil = z.object({
  T_accion: z.number().min(0).max(1),
  T_revision: z.number().min(0).max(1),
  T_segmento: z.number().min(0).max(1),
});

export const umbralesSchema = z.object({
  version: z.string(),
  estado: z.enum(["inicial_sin_ajustar", "ajustado_en_dev"]),
  nota: z.string().optional(),
  fecha: z.string().nullable(),
  modelo: z.string().nullable(),
  metricas_dev: z.unknown().nullable(),
  perfiles: z.object({ estricto: perfil, normal: perfil, laxo: perfil }),
});

export type Umbrales = z.infer<typeof umbralesSchema>;
export type UmbralesPerfil = z.infer<typeof perfil>;

/** data/thresholds.json se versiona aparte de la política y solo se ajusta en dev. */
export const UMBRALES: Umbrales = umbralesSchema.parse(umbralesCrudos);

/** Perfil de umbral según la reversibilidad de la acción (CLAUDE.md §6.4). */
export function perfilDe(rev: Reversibilidad): PerfilUmbral {
  return rev === "irreversible" ? "estricto" : rev === "parcial" ? "normal" : "laxo";
}
