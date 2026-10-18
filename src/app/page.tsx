import Link from "next/link";
import { Insignia } from "@/components/ResultadoPanel";
import { Demo, type AudienciaResumen, type EjemploDemo } from "@/components/Demo";
import { HeroVivo } from "@/components/HeroVivo";
import { Cifras, type Cifra } from "@/components/Cifras";
import { DiagramaPuerta } from "@/components/DiagramaPuerta";
import ejemplosJson from "../../data/ejemplos_demo.json";
import { AUDIENCIAS, resolverAudiencia } from "@/lib/vobo/audiencias";
import { DEAL, PERFILES } from "@/lib/vobo/perfiles";
import { POLICY } from "@/lib/vobo/policy";

const REPO = "https://github.com/Helian1505/vobo-jev";

// Cifras de la corrida única del test (eval/results/test.json, conjunto principal de 145 acciones). No se recalculan aquí.
const CIFRAS: Cifra[] = [
  {
    valor: 3,
    despues: " de 74",
    etiqueta: "acciones peligrosas aprobadas sin persona. Con reglas solas eran 34.",
    nota: "IC 95%: 1,4–11,3% · la meta era 0",
  },
  {
    valor: 83.1,
    decimales: 1,
    despues: "%",
    etiqueta: "de las acciones seguras sale sola, sin molestar a nadie.",
    nota: "59 de 71 · IC 95%: 72,7–90,1%",
  },
  {
    valor: 399,
    despues: " ms",
    etiqueta: "por decisión (latencia típica). No frena al agente.",
    nota: "p50 · p95: 650 ms · 7 preguntas en 1 llamada",
  },
  {
    valor: 0.064,
    decimales: 3,
    antes: "USD ",
    etiqueta: "por cada 1.000 decisiones con JEV real.",
    nota: "1.534 tokens de entrada por decisión",
  },
];

const PASOS_DECISION = [
  {
    numero: "01",
    titulo: "Reglas en código",
    resumen: "Lo que un modelo no debe hacer lo hace el código: contar, comparar y revisar listas.",
    detalle: [
      "Canal no oficial y destinatarios en la lista de bajas → bloquear.",
      "Campos protegidos de HubSpot y la etapa «Ganado» → pedir VoBo o bloquear.",
      "Más de 5.000 destinatarios, fuera de horario, fecha o precio que no cuadran → pedir VoBo.",
      "Oferta paga a una audiencia de afinidad baja → pedir VoBo.",
    ],
  },
  {
    numero: "02",
    titulo: "JEV: 7 preguntas en una llamada",
    resumen: "JEV lee el texto que va a salir y responde preguntas tipadas, cada una con su probabilidad.",
    detalle: [
      "¿Promete resultados? ¿Afirma una certificación oficial?",
      "¿Expone datos personales? ¿Trae una instrucción escondida para el agente?",
      "¿Afirma algo sin respaldo? ¿A qué público va? ¿Qué tono tiene?",
      "JEV solo recibe el texto, el tipo y el canal: nunca a quién va ni sus datos.",
    ],
  },
  {
    numero: "03",
    titulo: "Gana el más severo",
    resumen: "La decisión final es la más estricta entre las reglas y JEV. La IA puede endurecer, nunca aflojar.",
    detalle: [
      "Umbrales más estrictos para lo irreversible (correo y WhatsApp masivos).",
      "Si JEV duda, falla o tarda, decide una persona. Nunca sale solo por un error.",
      "La explicación sale de plantillas sobre los datos, no de otro modelo.",
      "Cada decisión deja su registro con un request_id.",
    ],
  },
];

const PUNTOS_INTEGRACION = [
  {
    titulo: "Una sola puerta, dentro de la herramienta del agente",
    texto: "Las herramientas de salida (correo, WhatsApp, redes, HubSpot) llaman a VoBo antes de ejecutar. El agente no se la puede saltar.",
  },
  {
    titulo: "Las llaves viven solo en la puerta",
    texto: "Los agentes no tienen las credenciales de HubSpot ni de WhatsApp: todo lo que sale pasa por el mismo punto auditable.",
  },
  {
    titulo: "Falla cerrada",
    texto: "Si VoBo no responde, tarda o devuelve algo inválido, la acción espera a una persona. Probado contra servidores caídos y colgados.",
  },
  {
    titulo: "Un solo modelo, con lo mínimo",
    texto: "JEV es el único modelo y solo ve el texto que va a salir. Sin otro LLM y sin datos de las personas.",
  },
];

export default function Home() {
  const ejemplos = ejemplosJson.ejemplos as EjemploDemo[];

  // Las cifras de cada audiencia las calcula el servidor desde los perfiles; el navegador no recibe los 697 perfiles.
  const audiencias: AudienciaResumen[] = AUDIENCIAS.flatMap((a) => {
    const r = resolverAudiencia(a.id);
    return r
      ? [
          {
            id: r.id,
            nombre: r.nombre,
            perfiles_en_muestra: r.perfiles_en_muestra,
            destinatarios_estimados: r.destinatarios_estimados,
            pct_afinidad_baja: r.pct_afinidad_baja,
          },
        ]
      : [];
  });

  const idsDeals = PERFILES.filter((p) => p.relacion === DEAL).map((p) => p.id);
  const programas = [...POLICY.programas_pagos, "Free Sales Training"];

  return (
    <div className="space-y-24 sm:space-y-28">
      {/* 1 · Hero */}
      <section id="inicio" aria-labelledby="titulo-inicio" className="piso-hero -mx-4 -mt-10 px-4 pt-10 sm:-mx-6 sm:-mt-14 sm:px-6 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-fg-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              Reto JEV · Hackathon 30X
            </p>
            <h1 id="titulo-inicio" className="font-display mt-6 text-[42px] leading-[1.02] text-fg sm:text-6xl lg:text-[68px]">
              La puerta de salida de los <span className="text-accent">agentes</span> de 30X.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-soft">
              Cada correo, WhatsApp, publicación o cambio en HubSpot que un agente quiere hacer pasa primero por VoBo. En
              milisegundos, las reglas y JEV lo revisan: lo seguro sale solo, lo dudoso llega a una persona con su porqué y lo
              indebido no sale.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="#demo"
                className="rounded-field bg-accent px-5 py-3 text-[15px] font-semibold text-on-accent transition hover:brightness-105"
              >
                Probar la demo
              </Link>
              <Link
                href="/resultados"
                className="rounded-field border border-line-strong px-5 py-3 text-[15px] font-medium text-fg-soft transition hover:border-fg-faint hover:text-fg"
              >
                Ver resultados →
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="Las tres decisiones posibles">
              <li><Insignia decision="ALLOW" /></li>
              <li><Insignia decision="REVIEW" /></li>
              <li><Insignia decision="BLOCK" /></li>
            </ul>
          </div>
          <HeroVivo />
        </div>
      </section>

      {/* 2 · Cifras */}
      <section aria-labelledby="titulo-cifras">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 id="titulo-cifras" className="font-display text-2xl text-fg sm:text-3xl">
            Más autonomía para los agentes, con evidencia.
          </h2>
          <p className="max-w-md text-sm text-fg-muted">
            Una sola corrida del test, con JEV real, sobre 145 acciones que no se usaron para ajustar.
          </p>
        </div>
        <Cifras cifras={CIFRAS} />
      </section>

      {/* 3 · Cómo decide */}
      <section id="como-funciona" aria-labelledby="titulo-como">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-faint">Cómo funciona</p>
        <h2 id="titulo-como" className="font-display mt-3 max-w-3xl text-3xl text-fg sm:text-[44px] sm:leading-[1.05]">
          JEV opina, el código autoriza y una persona decide lo dudoso.
        </h2>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PASOS_DECISION.map((p) => (
            <details key={p.numero} className="group hairline rounded-card bg-surface p-6 open:bg-field">
              <summary className="flex h-full flex-col">
                <span className="mono text-xs text-fg-faint">{p.numero}</span>
                <span className="font-display mt-4 text-xl text-fg">{p.titulo}</span>
                <span className="mt-2 text-sm leading-relaxed text-fg-muted">{p.resumen}</span>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-fg-soft group-hover:text-fg">
                  <span className="gira inline-block text-lg leading-none text-accent" aria-hidden="true">+</span>
                  <span className="group-open:hidden">Ver detalle</span>
                  <span className="hidden group-open:inline">Ocultar detalle</span>
                </span>
              </summary>
              <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm leading-relaxed text-fg-soft">
                {p.detalle.map((d) => (
                  <li key={d} className="flex gap-2.5">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-faint" aria-hidden="true" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      {/* 4 · Demo */}
      <section id="demo" aria-labelledby="titulo-demo">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-faint">Pruébalo</p>
        <div className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 id="titulo-demo" className="font-display max-w-2xl text-3xl text-fg sm:text-[44px] sm:leading-[1.05]">
            Elige una acción y mira qué decide VoBo.
          </h2>
          <p className="max-w-sm text-sm text-fg-muted">
            Cada evaluación llama a JEV real. Los ejemplos usan programas, etapas y audiencias de 30X.
          </p>
        </div>
        <Demo ejemplos={ejemplos} audiencias={audiencias} idsDeals={idsDeals} programas={programas} />
      </section>

      {/* 5 · Integración */}
      <section id="integracion" aria-labelledby="titulo-integracion">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-faint">Cómo se pone en 30X</p>
        <h2 id="titulo-integracion" className="font-display mt-3 max-w-3xl text-3xl text-fg sm:text-[44px] sm:leading-[1.05]">
          Un paso antes de todo lo que sale hacia afuera.
        </h2>
        <div className="hairline mt-10 rounded-card bg-surface p-4 sm:p-8">
          <DiagramaPuerta />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PUNTOS_INTEGRACION.map((p) => (
            <div key={p.titulo} className="hairline rounded-card bg-surface p-5">
              <p className="font-display text-base text-fg">{p.titulo}</p>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{p.texto}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-fg-muted">
          Ejemplos probados (no conectados a los sistemas de 30X):{" "}
          <a className="text-fg-soft underline underline-offset-4 hover:text-fg" href={`${REPO}/tree/main/integraciones/mcp`}>
            puerta de salida MCP en Python
          </a>
          {" · "}
          <a className="text-fg-soft underline underline-offset-4 hover:text-fg" href={`${REPO}/blob/main/docs/INTEGRACION.md`}>
            guía de integración
          </a>
          .
        </p>
      </section>

      {/* 6 · Evidencia */}
      <section aria-labelledby="titulo-evidencia" className="hairline rounded-card bg-surface p-6 sm:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-fg-faint">Lectura honesta</p>
            <h2 id="titulo-evidencia" className="font-display mt-3 text-2xl text-fg sm:text-3xl">
              La meta era 0 y no se cumplió: pasaron 3 de 74.
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-fg-soft">
              Son textos de apariencia inocua que una persona etiquetó para revisión; los publicamos con su texto. Las 42
              acciones graves del test se frenaron todas. El banco es sintético y la política es de demostración.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <Link
              href="/resultados"
              className="rounded-field border border-line-strong px-5 py-3 text-[15px] font-medium text-fg transition hover:border-fg-faint"
            >
              Ver todos los resultados →
            </Link>
            <Link href="/simulacion" className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg">
              O mira 20 acciones seguidas en la simulación
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
