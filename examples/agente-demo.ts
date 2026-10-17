/**
 * PATRÓN COMPLEMENTARIO: el agente consulta antes de actuar.
 * No es el paso principal de la integración: el principal es una compuerta DENTRO de los flujos, por la que pasa todo
 * lo que sale hacia afuera (ver integraciones/n8n/ y docs/INTEGRACION.md). Este patrón solo suma una segunda barrera
 * cuando el agente decide por su cuenta, y no cubre las llamadas que el agente haga sin consultar.
 *
 * Agente simulado que pone a VoBo delante de sus herramientas.
 *
 * Es un EJEMPLO de integración: usa solo el contrato HTTP de POST /api/evaluate (ver docs/INTEGRACION.md),
 * no importa nada de src/. Las «herramientas» solo imprimen lo que harían; no envían nada.
 *
 *   npm run dev                                   # en otra terminal (o usa BASE_URL=https://vobo-jev.vercel.app)
 *   npm run agente-demo
 *   BASE_URL=http://localhost:9 npm run agente-demo   # servidor caído: ver la falla cerrada
 *   VOBO_SOMBRA=1 npm run agente-demo                 # modo sombra: consulta a VoBo pero ejecuta todo
 *
 * Reglas de la integración:
 *   PERMITIR      → la herramienta se ejecuta.
 *   PEDIR VOBO    → la acción queda en una cola y espera aprobación de una persona.
 *   BLOQUEAR      → se aborta.
 *   Cualquier cosa rara (red caída, tiempo agotado, 5xx, 4xx, JSON inválido o un schema_version que no
 *   conocemos) cuenta como PEDIR VOBO: la integración FALLA CERRADA, nunca deja pasar por un error.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TIEMPO_LIMITE_MS = Number(process.env.VOBO_TIMEOUT_MS) || 5000;
const SOMBRA = process.env.VOBO_SOMBRA === "1";
const SCHEMA_CONOCIDO = "1";

// ── Contrato (solo lo que este agente necesita) ──────────────────────────────────────────────────────────
interface Accion {
  id?: string;
  tipo_accion: "correo_masivo" | "whatsapp_masivo" | "publicacion_redes" | "crm_update";
  canal: string;
  destinatarios: number;
  segmento_declarado: string;
  hora_envio: string;
  texto: string;
  [campo: string]: unknown;
}

type DecisionApi = "ALLOW" | "REVIEW" | "BLOCK";
type Decision = "PERMITIR" | "PEDIR VOBO" | "BLOQUEAR";

interface VeredictoVobo {
  decision: Decision;
  motivo: string;
  request_id: string | null;
  /** Si no hubo una respuesta válida de VoBo: qué falló. La decisión es entonces PEDIR VOBO (falla cerrada). */
  falla?: string;
}

const NOMBRE: Record<DecisionApi, Decision> = { ALLOW: "PERMITIR", REVIEW: "PEDIR VOBO", BLOCK: "BLOQUEAR" };

/** Consulta a VoBo. Nunca lanza: ante cualquier problema devuelve PEDIR VOBO con la falla anotada. */
async function consultarVobo(accion: Accion): Promise<VeredictoVobo> {
  const fallaCerrada = (falla: string): VeredictoVobo => ({
    decision: "PEDIR VOBO",
    motivo: `No se pudo consultar a VoBo (${falla}); por seguridad pasa a una persona.`,
    request_id: null,
    falla,
  });

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(accion),
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
    });
  } catch (e) {
    const tiempo = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return fallaCerrada(tiempo ? "tiempo agotado" : "error de red");
  }
  if (!res.ok) return fallaCerrada(`HTTP ${res.status}`); // 5xx, 429, 4xx: todo lo que no sea 200 falla cerrado

  let cuerpo: { schema_version?: string; request_id?: string; decision?: string; explicacion?: { titular?: string } };
  try {
    cuerpo = await res.json();
  } catch {
    return fallaCerrada("respuesta que no es JSON");
  }
  if (cuerpo.schema_version !== SCHEMA_CONOCIDO) return fallaCerrada(`schema_version desconocido: ${String(cuerpo.schema_version)}`);
  if (cuerpo.decision !== "ALLOW" && cuerpo.decision !== "REVIEW" && cuerpo.decision !== "BLOCK") return fallaCerrada("decisión inválida");

  return {
    decision: NOMBRE[cuerpo.decision],
    motivo: cuerpo.explicacion?.titular ?? "",
    request_id: cuerpo.request_id ?? null,
  };
}

// ── Cola de aprobación (en memoria; en una integración real sería un sistema de tickets o el webhook de VoBo) ──
interface Pendiente {
  numero: number;
  accion: Accion;
  motivo: string;
  ejecutar: () => Promise<string>;
}

class Cola {
  private pendientes: Pendiente[] = [];
  private siguiente = 1;

  encolar(accion: Accion, motivo: string, ejecutar: () => Promise<string>): number {
    const numero = this.siguiente++;
    this.pendientes.push({ numero, accion, motivo, ejecutar });
    return numero;
  }

  get abiertas(): readonly Pendiente[] {
    return this.pendientes;
  }

  /** Una persona aprueba: recién ahí se ejecuta la herramienta. */
  async aprobar(numero: number): Promise<string> {
    const p = this.quitar(numero);
    return p.ejecutar();
  }

  rechazar(numero: number): void {
    this.quitar(numero);
  }

  private quitar(numero: number): Pendiente {
    const i = this.pendientes.findIndex((p) => p.numero === numero);
    if (i < 0) throw new Error(`No hay una acción pendiente con el número ${numero}`);
    return this.pendientes.splice(i, 1)[0] as Pendiente;
  }
}

const cola = new Cola();

// ── conVobo: el único punto por el que pasa toda herramienta ─────────────────────────────────────────────────
interface Resultado {
  estado: "ejecutada" | "en cola" | "abortada" | "ejecutada (sombra)";
  decision: Decision;
  motivo: string;
  request_id: string | null;
  falla?: string;
  detalle?: string;
  numero_en_cola?: number;
}

async function conVobo(accion: Accion, ejecutar: () => Promise<string>): Promise<Resultado> {
  const v = await consultarVobo(accion);
  const base = { decision: v.decision, motivo: v.motivo, request_id: v.request_id, ...(v.falla ? { falla: v.falla } : {}) };

  if (SOMBRA) {
    // Modo sombra: se registra lo que VoBo habría hecho, pero la acción se ejecuta igual.
    return { ...base, estado: "ejecutada (sombra)", detalle: await ejecutar() };
  }
  if (v.decision === "PERMITIR") return { ...base, estado: "ejecutada", detalle: await ejecutar() };
  if (v.decision === "PEDIR VOBO") return { ...base, estado: "en cola", numero_en_cola: cola.encolar(accion, v.motivo, ejecutar) };
  return { ...base, estado: "abortada" };
}

// ── Las 3 herramientas del agente (simuladas: solo dicen lo que harían) ──────────────────────────────────────
const enviar_correo_masivo = (a: Accion) =>
  conVobo(a, async () => `correo enviado a ${a.destinatarios.toLocaleString("es-CO")} destinatarios por «${a.canal}»`);

const actualizar_crm = (a: Accion) =>
  conVobo(a, async () => `CRM actualizado: «${String(a.campo_crm ?? "campo")}» en ${a.destinatarios} contacto(s)`);

const publicar_redes = (a: Accion) => conVobo(a, async () => `publicado en «${a.canal}»`);

const HERRAMIENTA: Record<string, (a: Accion) => Promise<Resultado>> = {
  correo_masivo: enviar_correo_masivo,
  crm_update: actualizar_crm,
  publicacion_redes: publicar_redes,
};
const NOMBRE_HERRAMIENTA: Record<string, string> = {
  correo_masivo: "enviar_correo_masivo",
  crm_update: "actualizar_crm",
  publicacion_redes: "publicar_redes",
};

// ── Corrida: 5 casos de data/ejemplos_demo.json ──────────────────────────────────────────────────────────────
const CASOS = ["E01", "E02", "E04", "E07", "E15"];

function recortar(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

async function main() {
  const { ejemplos } = JSON.parse(readFileSync(path.resolve(__dirname, "../data/ejemplos_demo.json"), "utf8")) as {
    ejemplos: { id: string; titulo: string; accion: Accion }[];
  };

  console.log(`Agente simulado → VoBo en ${BASE_URL}${SOMBRA ? "  (MODO SOMBRA: se ejecuta todo)" : ""}\n`);

  const filas: string[][] = [["Caso", "Herramienta", "Decisión de VoBo", "Qué hizo el agente", "Motivo"]];
  for (const id of CASOS) {
    const ej = ejemplos.find((e) => e.id === id);
    if (!ej) throw new Error(`No existe el ejemplo ${id} en data/ejemplos_demo.json`);
    const r = await HERRAMIENTA[ej.accion.tipo_accion]?.({ ...ej.accion, id: `agente-${id}` });
    if (!r) throw new Error(`El agente no tiene herramienta para ${ej.accion.tipo_accion}`);
    const hizo =
      r.estado === "en cola" ? `en cola (#${r.numero_en_cola}), espera aprobación` : r.estado === "abortada" ? "abortó la acción" : `ejecutó: ${recortar(r.detalle ?? "", 34)}`;
    filas.push([id, NOMBRE_HERRAMIENTA[ej.accion.tipo_accion] ?? "?", r.decision, hizo, recortar(r.falla ? `FALLA CERRADA: ${r.falla}` : r.motivo, 58)]);
  }
  imprimirTabla(filas);

  // Una persona revisa la cola: aprueba la primera y rechaza el resto (para mostrar el camino completo).
  if (cola.abiertas.length > 0) {
    console.log(`\nCola de aprobación (${cola.abiertas.length} pendiente(s)):`);
    const [primera, ...resto] = [...cola.abiertas];
    for (const p of cola.abiertas) console.log(`  #${p.numero} · ${recortar(p.motivo, 90)}`);
    if (primera) console.log(`→ Una persona APRUEBA #${primera.numero}: ${await cola.aprobar(primera.numero)}`);
    for (const p of resto) {
      cola.rechazar(p.numero);
      console.log(`→ Una persona RECHAZA #${p.numero}: no se ejecuta.`);
    }
  }
}

function imprimirTabla(filas: string[][]) {
  const anchos = (filas[0] as string[]).map((_, i) => Math.max(...filas.map((f) => (f[i] ?? "").length)));
  filas.forEach((f, k) => {
    console.log(f.map((c, i) => c.padEnd(anchos[i] ?? 0)).join("  │  "));
    if (k === 0) console.log(anchos.map((a) => "─".repeat(a)).join("──┼──"));
  });
}

main().catch((e) => {
  console.error("Falló el agente:", e instanceof Error ? e.message : e);
  process.exit(1);
});
