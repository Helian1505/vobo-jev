/**
 * Llamada de humo a JEV real: UNA sola llamada, sin reintentos, para confirmar la forma de la
 * respuesta y los índices de legend del score (CLAUDE.md §6.1). Imprime la respuesta cruda
 * (nunca la llave).
 *
 *   node --env-file=.env.local --import tsx scripts/humo-jev.ts
 */
import { interpretar, riesgoJev } from "../src/lib/vobo/jev/interpret";
import { PREGUNTAS } from "../src/lib/vobo/jev/questions";
import { validarRespuesta } from "../src/lib/vobo/jev/schema";
import { armarState } from "../src/lib/vobo/jev/state";
import { UMBRALES } from "../src/lib/vobo/thresholds";
import type { AccionAgente } from "../src/lib/vobo/types";

const llave = process.env.TYPESAFE_API_KEY;
const modelo = process.env.JEV_MODEL || "jev-1.14.0";
if (!llave) {
  console.error("Falta TYPESAFE_API_KEY en .env.local");
  process.exit(1);
}

async function main() {
const accion: AccionAgente = {
  tipo_accion: "correo_masivo",
  canal: "correo_oficial",
  destinatarios: 800,
  segmento_declarado: "founders",
  hora_envio: "10:00",
  texto:
    "Te invitamos a la clase abierta del jueves. Después de este programa duplicarás tus ventas, resultado garantizado.",
};

const inicio = Date.now();
const res = await fetch("https://api.typesafe.ai/v1/systemone", {
  method: "POST",
  headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: modelo, state: armarState(accion), questions: PREGUNTAS }),
});
const ms = Date.now() - inicio;
const texto = await res.text();
console.log(`HTTP ${res.status} en ${ms} ms (modelo pedido: ${modelo})`);

let cruda: unknown;
try {
  cruda = JSON.parse(texto);
} catch {
  console.log("Respuesta que no es JSON:", texto.slice(0, 500));
  process.exit(1);
}
console.log(JSON.stringify(cruda, null, 2));
if (!res.ok) process.exit(1);

console.log("\n--- Validación con nuestro esquema ---");
try {
  const r = validarRespuesta(cruda, PREGUNTAS);
  const tono = r.answers.tono;
  if (tono?.type === "score") {
    console.log("llaves de legend:", Object.keys(tono.legend));
    console.log("llaves de probabilities:", Object.keys(tono.probabilities));
  }
  const senales = interpretar(r, accion.segmento_declarado, UMBRALES.perfiles.estricto);
  console.log("señales:", senales.map((s) => `${s.id}=${s.decision}(${Math.round(s.prob * 100)}%)`).join(" · "));
  console.log("riesgo según JEV:", riesgoJev(senales));
  console.log("costo USD:", (r.usage.input_tokens * 0.042) / 1_000_000);
} catch (e) {
  console.log("NUESTRO ESQUEMA RECHAZÓ LA RESPUESTA:", e instanceof Error ? e.message : e);
}
}

main().catch((e) => {
  console.error("Falló la llamada:", e instanceof Error ? e.message : e);
  process.exit(1);
});
