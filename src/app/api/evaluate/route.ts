import { NextResponse } from "next/server";
import { estadoJev } from "@/lib/vobo/config";
import { manejarEvaluar } from "@/lib/vobo/evaluar-http";
import { LimitadorVentana } from "@/lib/vobo/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAXIMO_POR_MINUTO = 20;
const limitador = new LimitadorVentana(MAXIMO_POR_MINUTO, 60_000);

/** Estado de JEV para el banner de la UI (nunca expone la llave). */
export function GET() {
  return NextResponse.json(estadoJev());
}

/** Ruta ABIERTA para la demo (sin clave; 20 por minuto por IP). Las integraciones usan /api/v1/evaluate. */
export function POST(req: Request) {
  return manejarEvaluar(req, { limitador, maximoPorMinuto: MAXIMO_POR_MINUTO });
}
