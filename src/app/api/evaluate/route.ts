import { NextResponse } from "next/server";
import { accionSchema } from "@/lib/vobo/accion-schema";
import { estadoJev } from "@/lib/vobo/config";
import { evaluateAction } from "@/lib/vobo/evaluate";
import { LimitadorVentana } from "@/lib/vobo/rate-limit";
import type { AccionAgente } from "@/lib/vobo/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const limitador = new LimitadorVentana(20, 60_000);

function ipDe(req: Request): string {
  const reenviada = req.headers.get("x-forwarded-for");
  return reenviada?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconocida";
}

/** Estado de JEV para el banner de la UI (nunca expone la llave). */
export function GET() {
  return NextResponse.json(estadoJev());
}

export async function POST(req: Request) {
  if (!limitador.permitir(ipDe(req))) {
    return NextResponse.json({ error: "Demasiadas solicitudes: máximo 20 por minuto." }, { status: 429 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo debe ser JSON." }, { status: 400 });
  }

  const entrada = accionSchema.safeParse(cuerpo);
  if (!entrada.success) {
    return NextResponse.json(
      { error: "Acción inválida.", detalles: entrada.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }

  const estado = estadoJev();
  if (!estado.configurado) {
    return NextResponse.json({ error: "JEV real no configurado: falta TYPESAFE_API_KEY." }, { status: 503 });
  }

  const evaluacion = await evaluateAction(entrada.data as AccionAgente);
  return NextResponse.json(evaluacion);
}
