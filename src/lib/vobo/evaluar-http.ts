import { NextResponse, after } from "next/server";
import { accionSchema } from "./accion-schema";
import { resolverAudiencia } from "./audiencias";
import { estadoJev } from "./config";
import { evaluateAction } from "./evaluate";
import type { LimitadorVentana } from "./rate-limit";
import { armarRespuestaEvaluate } from "./respuesta";
import type { AccionAgente } from "./types";
import { construirCarga, debeNotificar, enviarWebhook, urlWebhook } from "./webhook";

export function ipDe(req: Request): string {
  const reenviada = req.headers.get("x-forwarded-for");
  return reenviada?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconocida";
}

function registrarFallo(r: { enviado: boolean; error?: string; estado?: number }) {
  if (!r.enviado) console.warn(`[vobo] el webhook de revisión no se entregó (${r.error ?? "desconocido"}${r.estado ? ` ${r.estado}` : ""})`);
}

export interface OpcionesEvaluar {
  limitador: LimitadorVentana;
  /** Para el mensaje del 429. */
  maximoPorMinuto: number;
}

/**
 * Lógica compartida de POST /api/evaluate (abierta, para la demo) y POST /api/v1/evaluate (con clave): mismo contrato,
 * mismas validaciones y mismo webhook. Cada ruta pone su propio límite y, en la v1, la clave antes de llamar aquí.
 */
export async function manejarEvaluar(req: Request, op: OpcionesEvaluar): Promise<Response> {
  if (!op.limitador.permitir(ipDe(req))) {
    return NextResponse.json({ error: `Demasiadas solicitudes: máximo ${op.maximoPorMinuto} por minuto.` }, { status: 429 });
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

  if (!estadoJev().configurado) {
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
