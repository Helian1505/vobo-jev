import { NextResponse, after } from "next/server";
import { accionSchema } from "@/lib/vobo/accion-schema";
import { resolverAudiencia } from "@/lib/vobo/audiencias";
import { estadoJev } from "@/lib/vobo/config";
import { evaluateAction } from "@/lib/vobo/evaluate";
import { LimitadorVentana } from "@/lib/vobo/rate-limit";
import { armarRespuestaEvaluate } from "@/lib/vobo/respuesta";
import type { AccionAgente } from "@/lib/vobo/types";
import { construirCarga, debeNotificar, enviarWebhook, urlWebhook } from "@/lib/vobo/webhook";

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

function registrarFallo(r: { enviado: boolean; error?: string; estado?: number }) {
  if (!r.enviado) console.warn(`[vobo] el webhook de revisión no se entregó (${r.error ?? "desconocido"}${r.estado ? ` ${r.estado}` : ""})`);
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

  // La afinidad de la audiencia la calcula el servidor desde audiencia_id; lo que mande el cliente se ignora.
  const accion = entrada.data as AccionAgente;
  const audiencia = accion.audiencia_id ? resolverAudiencia(accion.audiencia_id) : undefined;
  accion.audiencia_pct_afinidad_baja = audiencia?.pct_afinidad_baja;

  const request_id = crypto.randomUUID();
  const evaluacion = await evaluateAction(accion);
  const respuesta = armarRespuestaEvaluate(accion, evaluacion, request_id);

  // Webhook opcional: avisa a una persona cuando algo queda en PEDIR VOBO o BLOQUEAR. Va después de responder
  // (after) y no puede bloquear ni cambiar la respuesta. Sin VOBO_REVIEW_WEBHOOK_URL no hace nada.
  const destino = urlWebhook();
  if (destino && debeNotificar(evaluacion.decision)) {
    const aviso = () => enviarWebhook({ url: destino, carga: construirCarga(request_id, accion, evaluacion) }).then(registrarFallo);
    try {
      after(aviso);
    } catch {
      void aviso(); // fuera de una solicitud (pruebas): se lanza sin esperar
    }
  }
  return NextResponse.json(respuesta, { headers: { "x-request-id": request_id } });
}
