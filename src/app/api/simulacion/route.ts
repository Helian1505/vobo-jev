import { NextResponse } from "next/server";
import type { RespuestaEvaluate } from "@/lib/vobo/api-contrato";
import { estadoJev } from "@/lib/vobo/config";
import { evaluateAction } from "@/lib/vobo/evaluate";
import { LimitadorVentana } from "@/lib/vobo/rate-limit";
import { armarRespuestaEvaluate } from "@/lib/vobo/respuesta";
import { SIMULACION } from "@/lib/vobo/simulacion";

export const runtime = "nodejs";
export const maxDuration = 30;

// La simulación hace muchas llamadas seguidas: tiene su propio límite, más holgado que el de /api/evaluate.
const limitador = new LimitadorVentana(120, 60_000);

function ipDe(req: Request): string {
  const reenviada = req.headers.get("x-forwarded-for");
  return reenviada?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconocida";
}

/**
 * POST /api/simulacion { "i": 0 } → evalúa la acción número i de la muestra del banco dev (SIMULACION).
 * Solo evalúa acciones de esa muestra, nunca texto que mande quien llama; el costo por llamada es de fracciones de centavo.
 */
export async function POST(req: Request) {
  if (!limitador.permitir(ipDe(req))) {
    return NextResponse.json({ error: "Demasiadas solicitudes: máximo 120 por minuto en la simulación." }, { status: 429 });
  }

  let i: unknown;
  try {
    i = ((await req.json()) as { i?: unknown }).i;
  } catch {
    return NextResponse.json({ error: "El cuerpo debe ser JSON." }, { status: 400 });
  }
  if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= SIMULACION.length) {
    return NextResponse.json({ error: `«i» debe ser un entero entre 0 y ${SIMULACION.length - 1}.` }, { status: 400 });
  }

  if (!estadoJev().configurado) {
    return NextResponse.json({ error: "JEV real no configurado: falta TYPESAFE_API_KEY." }, { status: 503 });
  }

  const accion = SIMULACION[i]!;
  const evaluacion = await evaluateAction({ ...accion });
  const respuesta: RespuestaEvaluate & { indice: number; accion: { id?: string; tipo_accion: string; canal: string; destinatarios: number; texto: string } } = {
    ...armarRespuestaEvaluate(accion, evaluacion, crypto.randomUUID()),
    indice: i,
    accion: { id: accion.id, tipo_accion: accion.tipo_accion, canal: accion.canal, destinatarios: accion.destinatarios, texto: accion.texto },
  };
  return NextResponse.json(respuesta);
}
