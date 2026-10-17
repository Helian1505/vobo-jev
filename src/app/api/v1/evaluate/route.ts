import { NextResponse } from "next/server";
import { exigirClave } from "@/lib/vobo/clave-api";
import { ipDe, manejarEvaluar } from "@/lib/vobo/evaluar-http";
import { LimitadorVentana } from "@/lib/vobo/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAXIMO_POR_MINUTO = 300;
const limitador = new LimitadorVentana(MAXIMO_POR_MINUTO, 60_000);
// Frena a quien prueba claves a ciegas: más de 10 intentos fallidos por minuto desde la misma IP.
const intentosFallidos = new LimitadorVentana(10, 60_000);

/**
 * Ruta PROTEGIDA para integraciones: mismo contrato que /api/evaluate pero con «Authorization: Bearer <VOBO_API_KEY>».
 * Sin VOBO_API_KEY configurada responde 503: nunca queda abierta. Una sola clave compartida, sin cuotas por cliente.
 */
export async function POST(req: Request) {
  const rechazo = exigirClave(req);
  if (rechazo) {
    if (rechazo.status === 401 && !intentosFallidos.permitir(ipDe(req))) {
      return NextResponse.json({ error: "Demasiados intentos con una clave inválida. Espera un minuto." }, { status: 429 });
    }
    return rechazo;
  }
  return manejarEvaluar(req, { limitador, maximoPorMinuto: MAXIMO_POR_MINUTO });
}
