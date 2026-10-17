import { ETIQUETA_DECISION } from "./combine";
import { fechaLegible } from "./fechas";
import type { Senal } from "./jev/interpret";
import { SEV, type Decision, type ReglaActivada } from "./types";

/** Explicación determinista: plantillas fijas sobre datos, sin LLM (CLAUDE.md §7). */
export interface Explicacion {
  titular: string;
  razones: string[];
}

export const MENSAJE_FALLO_JEV = "No se pudo consultar a JEV; por seguridad pasa a VoBo humano.";

const miles = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const pct = (p: number) => Math.round(p * 100);

function menosUnMinuto(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const total = (h * 60 + m - 1 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function textoRegla(r: ReglaActivada): string {
  const d = r.detalle as Record<string, string | number | boolean | undefined>;
  switch (r.regla) {
    case "canal_no_oficial":
      return `El canal «${d.canal}» no es un canal oficial de 30X.`;
    case "en_lista_de_bajas":
      return `${d.k} destinatario(s) pidieron no recibir más mensajes.`;
    case "campo_protegido_masivo":
      return `Cambia «${d.campo}», un campo protegido, en ${miles(Number(d.n))} contactos a la vez.`;
    case "campo_protegido_individual":
      return `Cambia «${d.campo}», un campo protegido; requiere VoBo humano.`;
    case "audiencia_grande":
      return `Va a ${miles(Number(d.n))} destinatarios; por encima de ${miles(Number(d.umbral))} se pide VoBo humano.`;
    case "fuera_de_horario":
      return `Se enviaría a las ${d.hora}; los envíos masivos van de ${d.inicio} a ${menosUnMinuto(String(d.fin))}.`;
    case "fecha_inconsistente":
      return `El texto dice «${d.fecha_texto}», pero el evento es el ${fechaLegible(String(d.fecha_real))}.`;
    case "precio_inconsistente": {
      const para = d.programa ? ` para ${d.programa}` : "";
      return `El texto dice USD ${miles(Number(d.precio_texto))}; el catálogo dice USD ${miles(Number(d.precio_catalogo))}${para}.`;
    }
    case "etapa_ganado_individual":
      return `Marca el deal ${d.perfil_id ?? "seleccionado"} como «${d.etapa}»; eso equivale a registrar un pago y requiere VoBo humano.`;
    case "etapa_ganado_masivo":
      return `Marca ${miles(Number(d.n))} deals como «${d.etapa}» a la vez; registrar pagos en masa no se permite.`;
    case "oferta_sin_afinidad":
      return (
        `Ofrece ${d.programa} a una audiencia donde el ${pct(Number(d.pct))}% tiene afinidad baja (0–3) con 30X; ` +
        `una persona debe decidir si vale la pena. Nota: en la muestra de 30X, los deals de afinidad muy alta pagan cerca de 5 veces más que los de afinidad baja.`
      );
  }
}

/** Lo que JEV estima, redactado para "el texto {descripción}". */
const DESCRIPCION: Record<string, Record<string, string>> = {
  promesa: { explicita: "garantice un resultado", implicita: "sugiera resultados sin garantizarlos" },
  certificacion: { _: "afirme que otorga un título, una certificación oficial o un aval" },
  datos_personales: {
    sensibles_o_contacto: "exponga datos de contacto o sensibles de terceros",
    persona_identificable: "identifique a una persona sin su consentimiento",
  },
  instruccion_agente: { _: "incluya una instrucción para un agente" },
  afirmacion: { sin_respaldo: "haga afirmaciones de impacto sin respaldo" },
  tono: { ofensivo: "sea ofensivo", sensacionalista: "sea sensacionalista o alarmista" },
};

function textoSenal(s: Senal): string | null {
  if (s.estado === "ok") return null;
  if (s.id === "segmento") {
    const d = s.detalle as { declarado?: string; detectado?: string };
    return `JEV estima un ${pct(s.prob)}% de probabilidad de que el texto esté dirigido a «${d.detectado}», y la acción declara «${d.declarado}».`;
  }
  const desc = DESCRIPCION[s.id]?.[s.opcion ?? "_"] ?? DESCRIPCION[s.id]?._ ?? "tenga un problema";
  return s.estado === "alerta"
    ? `JEV estima un ${pct(s.prob)}% de probabilidad de que el texto ${desc}.`
    : `JEV no está seguro (${pct(s.prob)}%) de que el texto ${desc}; lo revisa una persona.`;
}

export interface EntradaExplicacion {
  decision: Decision;
  reglas: ReglaActivada[];
  senales: Senal[];
  jevFallo: boolean;
}

/** Razones de mayor a menor severidad; a igual severidad, primero las reglas y luego JEV. */
export function explicar({ decision, reglas, senales, jevFallo }: EntradaExplicacion): Explicacion {
  const items: { sev: number; texto: string }[] = [];
  for (const r of reglas) items.push({ sev: SEV[r.decision], texto: textoRegla(r) });
  for (const s of senales) {
    const t = textoSenal(s);
    if (t) items.push({ sev: SEV[s.decision], texto: t });
  }
  if (jevFallo) items.push({ sev: SEV.REVIEW, texto: MENSAJE_FALLO_JEV });

  const razones = items
    .map((it, i) => ({ ...it, i }))
    .sort((a, b) => b.sev - a.sev || a.i - b.i)
    .map((it) => it.texto);

  const principal = razones[0];
  const titular =
    decision === "ALLOW" || !principal
      ? `${ETIQUETA_DECISION[decision]}: no se encontraron problemas.`
      : `${ETIQUETA_DECISION[decision]}: ${principal}`;
  return { titular, razones };
}
