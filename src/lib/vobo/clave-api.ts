import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** Largo mínimo de VOBO_API_KEY: una clave corta no se acepta (la ruta se queda cerrada). */
export const LARGO_MINIMO_CLAVE = 16;

const huella = (s: string) => createHash("sha256").update(s).digest();

/** Compara en tiempo constante (con huellas del mismo largo), para no filtrar la clave por el tiempo de respuesta. */
export function claveCoincide(recibida: string, esperada: string): boolean {
  return timingSafeEqual(huella(recibida), huella(esperada));
}

/** Extrae el token de «Authorization: Bearer <token>». */
export function tokenBearer(req: Request): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get("authorization") ?? "");
  return m ? (m[1] as string) : null;
}

/**
 * Protege /api/v1/evaluate con VOBO_API_KEY (Bearer). Devuelve null si la clave es válida, o la respuesta de error:
 * - 503 si no hay clave configurada o es demasiado corta (la ruta nunca queda abierta por olvido);
 * - 401 (con WWW-Authenticate) si falta o no coincide. Los mensajes nunca incluyen ninguna clave.
 */
export function exigirClave(req: Request, env: Record<string, string | undefined> = process.env): Response | null {
  const esperada = env.VOBO_API_KEY?.trim();
  if (!esperada || esperada.length < LARGO_MINIMO_CLAVE) {
    return NextResponse.json(
      { error: `La ruta /api/v1/evaluate no está configurada: falta VOBO_API_KEY (mínimo ${LARGO_MINIMO_CLAVE} caracteres).` },
      { status: 503 },
    );
  }
  const recibida = tokenBearer(req);
  if (recibida === null || !claveCoincide(recibida, esperada)) {
    return NextResponse.json(
      { error: "Falta la clave de API o no es válida. Envía «Authorization: Bearer <clave>»." },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="vobo"' } },
    );
  }
  return null;
}
