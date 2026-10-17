import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const ARCHIVO_ETIQUETAS = "data/etiquetas_v1.csv";

export function sha256Archivo(ruta: string): string {
  return createHash("sha256").update(readFileSync(ruta)).digest("hex");
}

/** Lee de eval/FREEZE.md el SHA-256 vigente de las etiquetas (la línea «SHA-256 vigente (vX): `hash`»). */
export function hashVigente(freezeMd: string): string | null {
  const m = /SHA-256 vigente[^`\n]*`([0-9a-f]{64})`/i.exec(freezeMd);
  return m ? (m[1] as string).toLowerCase() : null;
}

export interface VerificacionCongelacion {
  ok: boolean;
  esperado: string | null;
  real: string;
}

/** Recalcula el hash de las etiquetas y lo compara con el vigente de FREEZE.md. */
export function verificarCongelacion(raiz: string): VerificacionCongelacion {
  const esperado = hashVigente(readFileSync(path.join(raiz, "eval/FREEZE.md"), "utf8"));
  const real = sha256Archivo(path.join(raiz, ARCHIVO_ETIQUETAS));
  return { ok: esperado !== null && esperado === real, esperado, real };
}
