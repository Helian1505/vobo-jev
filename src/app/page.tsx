import Link from "next/link";
import { HeroVivo } from "@/components/HeroVivo";
import { Cifras, type Cifra } from "@/components/Cifras";
import { Revelar } from "@/components/Revelar";

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

// El mismo orden que la barra de navegación: probar, verlo en flujo, la persona decide, la evidencia y cómo se conecta.
const RECORRIDO = [
  { href: "/demo", titulo: "Demo", texto: "Elige una acción y mira la decisión con su porqué." },
  { href: "/simulacion", titulo: "Simulación", texto: "Un agente propone acciones seguidas; VoBo decide cada una." },
  { href: "/cola", titulo: "Cola", texto: "Lo que pidió VoBo espera aquí a que una persona decida." },
  { href: "/resultados", titulo: "Resultados", texto: "El test completo, corrido una sola vez, fallos incluidos." },
  { href: "/integracion", titulo: "Integración", texto: "Dónde va VoBo en el flujo de 30X y qué está construido." },
];

export default function Home() {
  return (
    <div className="space-y-16 sm:space-y-20">
      {/* 1 · Hero: ocupa el alto de la ventana (menos la barra) y su contenido se encoge con ella para que quepa entero. */}
      <section
        id="inicio"
        aria-labelledby="titulo-inicio"
        className="piso-hero -mx-4 -mt-8 px-4 pb-6 pt-8 sm:-mx-6 sm:-mt-12 sm:px-6 lg:flex lg:min-h-[calc(100svh-4rem)] lg:items-center lg:py-8"
      >
        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-fg-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              Reto JEV · Hackathon 30X
            </p>
            <h1
              id="titulo-inicio"
              className="font-display mt-5 text-[40px] leading-[1.03] text-fg sm:text-[52px] lg:text-[clamp(2.75rem,min(4.6vw,8.2vh),4.25rem)]"
            >
              La puerta de salida de los <span className="text-accent">agentes</span> de 30X.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-fg-soft lg:text-[clamp(1rem,2.3vh,1.125rem)]">
              Cada correo, WhatsApp, publicación o cambio en HubSpot que un agente quiere hacer pasa primero por VoBo. En
              milisegundos, las reglas y JEV lo revisan: lo seguro sale solo, lo dudoso llega a una persona con su porqué y lo
              indebido no sale.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/demo"
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
          </div>
          <HeroVivo />
        </div>
      </section>

      {/* 2 · Cifras */}
      <section aria-labelledby="titulo-cifras">
        <Revelar>
          <EncabezadoSeccion
            id="titulo-cifras"
            etiqueta="Resultados del test"
            titulo="Más autonomía para los agentes, con evidencia."
            nota="Una sola corrida, con JEV real, sobre 145 acciones que no se usaron para ajustar."
          />
        </Revelar>
        <Revelar retraso={120} className="mt-8">
          <Cifras cifras={CIFRAS} />
        </Revelar>
      </section>

      {/* 3 · Cómo decide */}
      <section id="como-funciona" aria-labelledby="titulo-como">
        <Revelar>
          <EncabezadoSeccion
            id="titulo-como"
            etiqueta="Cómo funciona"
            titulo="JEV opina, el código autoriza y una persona decide lo dudoso."
            nota="Abre cada paso para ver el detalle."
          />
        </Revelar>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {PASOS_DECISION.map((p, i) => (
            <Revelar key={p.numero} retraso={i * 140} className="h-full">
              <details className="elevar group hairline h-full rounded-card bg-surface p-5 open:bg-field">
                <summary className="flex flex-col">
                  <span className="flex items-center justify-between">
                    <span className="mono text-xs text-fg-faint">{p.numero}</span>
                    <span className="gira inline-block text-lg leading-none text-accent" aria-hidden="true">+</span>
                  </span>
                  <span className="font-display mt-3 text-xl text-fg">{p.titulo}</span>
                  <span className="mt-2 text-sm leading-relaxed text-fg-muted">{p.resumen}</span>
                  <span className="mt-4 text-sm font-medium text-fg-soft group-hover:text-fg">
                    <span className="group-open:hidden">Ver detalle</span>
                    <span className="hidden group-open:inline">Ocultar detalle</span>
                  </span>
                </summary>
                <ul className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm leading-relaxed text-fg-soft">
                  {p.detalle.map((d) => (
                    <li key={d} className="flex gap-2.5">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </Revelar>
          ))}
        </div>
      </section>

      {/* 4 · Recorrido: las mismas páginas que la barra, en el mismo orden */}
      <section aria-labelledby="titulo-recorrido">
        <Revelar>
          <EncabezadoSeccion
            id="titulo-recorrido"
            etiqueta="Recorre VoBo"
            titulo="De una acción suelta a todo el flujo."
            nota="Las mismas cinco páginas de la barra, en el mismo orden."
          />
        </Revelar>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {RECORRIDO.map((r, i) => (
            <li key={r.href}>
              <Revelar retraso={i * 110} className="h-full">
                <Link href={r.href} className="elevar group hairline flex h-full flex-col rounded-card bg-surface p-5 hover:bg-field">
                  <span className="flex items-center justify-between">
                    <span className="mono text-xs text-fg-faint">0{i + 1}</span>
                    <span
                      className="text-fg-faint transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </span>
                  <span className="font-display mt-3 text-lg text-fg">{r.titulo}</span>
                  <span className="mt-1.5 text-sm leading-relaxed text-fg-muted">{r.texto}</span>
                </Link>
              </Revelar>
            </li>
          ))}
        </ol>
      </section>

      {/* 5 · Evidencia */}
      <Revelar>
      <section aria-labelledby="titulo-evidencia" className="hairline rounded-card bg-surface p-6 sm:p-8">
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
      </Revelar>
    </div>
  );
}

/** Encabezado de sección del inicio: etiqueta, titular y una nota corta a la derecha. Mismo patrón en todas. */
function EncabezadoSeccion({ id, etiqueta, titulo, nota }: { id: string; etiqueta: string; titulo: string; nota?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
      <div className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-faint">{etiqueta}</p>
        <h2 id={id} className="font-display mt-3 text-3xl leading-[1.08] text-fg sm:text-[38px]">
          {titulo}
        </h2>
      </div>
      {nota && <p className="max-w-xs text-sm leading-relaxed text-fg-muted lg:text-right">{nota}</p>}
    </div>
  );
}
