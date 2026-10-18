"use client";

import { useEffect, useState } from "react";

/**
 * Cómo se pone VoBo en 30X, tal como está construido (integraciones/mcp/LEEME.md y docs/INTEGRACION.md):
 * el agente llama a una herramienta de salida → la puerta (donde viven las llaves) consulta a VoBo → tres caminos.
 * Interactivo: los botones (o pasar el mouse por un camino) resaltan ese camino y lo hacen «fluir»; mientras nadie lo
 * toca, recorre los tres solo. Las líneas se dibujan después de las cajas, para que nada quede detrás.
 * En pantallas angostas se muestra la misma estructura como lista.
 */

type Tono = "allow" | "review" | "block";

const CAJA = "fill-surface stroke-line-strong";
const LINEA: Record<Tono, string> = { allow: "stroke-allow", review: "stroke-review", block: "stroke-block" };
const RELLENO: Record<Tono, string> = { allow: "fill-allow", review: "fill-review", block: "fill-block" };
const TEXTO: Record<Tono, string> = { allow: "text-allow", review: "text-review", block: "text-block" };
const BOTON_ACTIVO: Record<Tono, string> = {
  allow: "border-allow/60 bg-allow/10 text-allow",
  review: "border-review/60 bg-review/10 text-review",
  block: "border-block/60 bg-block/10 text-block",
};

// Ejemplos: las tres acciones del inicio, evaluadas con JEV real (jev-1.14.0) el 17 oct.
const CAMINOS: { tono: Tono; y: number; titulo: string; lineas: [string, string]; ejemplo: string }[] = [
  {
    tono: "allow",
    y: 24,
    titulo: "PERMITIR",
    lineas: ["Sale: correo, WhatsApp, redes", "o el cambio en HubSpot."],
    ejemplo: "Recordatorio de la clase abierta a 1.200 contactos: sale solo, en 216 ms.",
  },
  {
    tono: "review",
    y: 144,
    titulo: "PEDIR VOBO (o falla)",
    lineas: ["No sale aún. Aviso en Slack;", "decide una persona."],
    ejemplo: "Oferta de AI Sales a 1.711 contactos con afinidad baja: llega a Slack con el porqué.",
  },
  {
    tono: "block",
    y: 264,
    titulo: "BLOQUEAR",
    lineas: ["No sale. El agente recibe", "las razones."],
    ejemplo: "Nota en HubSpot con una instrucción escondida para el agente: no sale (JEV, 99%).",
  },
];

const PASOS_LISTA = [
  { titulo: "Agente de 30X", texto: "Propone la acción con una herramienta (Python, tool calling o MCP)." },
  { titulo: "Puerta de salida", texto: "La herramienta consulta a VoBo antes de ejecutar. Las llaves de salida viven solo aquí." },
  { titulo: "VoBo", texto: "Reglas en código + JEV, ≈ 0,4 s. Si no responde bien, la acción no sale." },
];

export function DiagramaPuerta() {
  const [activo, setActivo] = useState<Tono>("allow");
  const [automatico, setAutomatico] = useState(true);

  // Mientras nadie interactúa, recorre los tres caminos. Con «reducir movimiento», se queda quieto.
  useEffect(() => {
    if (!automatico || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reloj = window.setInterval(() => {
      setActivo((a) => (a === "allow" ? "review" : a === "review" ? "block" : "allow"));
    }, 2800);
    return () => window.clearInterval(reloj);
  }, [automatico]);

  const elegir = (t: Tono) => {
    setAutomatico(false);
    setActivo(t);
  };

  const caminoActivo = CAMINOS.find((c) => c.tono === activo) ?? CAMINOS[0]!;

  return (
    <div>
      <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <div role="group" aria-label="Ver un camino del diagrama" className="flex flex-wrap gap-2">
          {CAMINOS.map((c) => (
            <button
              key={c.tono}
              type="button"
              aria-pressed={activo === c.tono}
              onClick={() => elegir(c.tono)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${
                activo === c.tono ? BOTON_ACTIVO[c.tono] : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
              }`}
            >
              {c.titulo}
            </button>
          ))}
        </div>
        <p className="text-xs text-fg-faint">{automatico ? "Recorre los caminos solo · elige uno para fijarlo" : "Camino fijado"}</p>
      </div>

      <svg viewBox="0 0 1000 450" className="mt-4 hidden h-auto w-full md:block" role="img" aria-labelledby="diagrama-titulo diagrama-desc">
        <title id="diagrama-titulo">Cómo se pone VoBo en 30X</title>
        <desc id="diagrama-desc">
          El agente de 30X propone una acción con una herramienta. La herramienta es la puerta de salida: consulta a VoBo antes de
          ejecutar, y las llaves de salida viven solo ahí. VoBo aplica reglas en código y consulta a JEV. Si permite, la acción
          sale. Si pide visto bueno o falla, no sale y una persona decide desde un aviso en Slack. Si bloquea, no sale y el agente
          recibe las razones. Cada decisión queda en un registro con el request_id y el ID de HubSpot.
        </desc>
        <defs>
          {(["neutra", "allow", "review", "block"] as const).map((t) => (
            <marker key={t} id={`punta-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0L10 5L0 10z" className={t === "neutra" ? "fill-fg-faint" : RELLENO[t]} />
            </marker>
          ))}
          <linearGradient id="vobo-relleno" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e9ff7b" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#e9ff7b" stopOpacity="0.02" />
          </linearGradient>
          <filter id="vobo-brillo" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        {/* Cajas del flujo */}
        <rect x={10} y={135} width={200} height={90} rx={14} className={CAJA} />
        <text x={30} y={172} className="fill-fg-faint" fontSize={10.5} fontWeight={600} letterSpacing="0.08em">01</text>
        <text x={30} y={195} className="fill-fg" fontSize={17} fontWeight={600}>Agente de 30X</text>
        <text x={30} y={213} className="fill-fg-muted" fontSize={12}>Python · tool calling o MCP</text>

        <rect x={250} y={135} width={190} height={90} rx={14} className={CAJA} />
        <text x={270} y={172} className="fill-fg-faint" fontSize={10.5} fontWeight={600} letterSpacing="0.08em">02</text>
        <text x={270} y={195} className="fill-fg" fontSize={17} fontWeight={600}>Puerta de salida</text>
        <text x={270} y={213} className="fill-fg-muted" fontSize={12}>Las llaves viven aquí</text>

        <rect x={510} y={130} width={180} height={100} rx={16} fill="#e9ff7b" opacity={0.18} filter="url(#vobo-brillo)" />
        <rect x={500} y={120} width={200} height={120} rx={16} fill="url(#vobo-relleno)" className="stroke-accent" strokeWidth={1.5} />
        <text x={522} y={156} className="fill-accent" fontSize={10.5} fontWeight={600} letterSpacing="0.08em">03</text>
        <text x={522} y={184} className="fill-fg" fontSize={26} fontWeight={600} letterSpacing="-0.02em">VoBo</text>
        <text x={522} y={206} className="fill-fg-muted" fontSize={12.5}>Reglas en código + JEV</text>
        <text x={522} y={224} className="fill-fg-faint" fontSize={11.5}>≈ 0,4 s · falla cerrada</text>

        {CAMINOS.map((c) => {
          const on = c.tono === activo;
          return (
            <g
              key={c.tono}
              className="atenuable cursor-pointer"
              style={{ opacity: on ? 1 : 0.4 }}
              onMouseEnter={() => elegir(c.tono)}
              onClick={() => elegir(c.tono)}
            >
              <rect x={770} y={c.y} width={220} height={88} rx={14} className={on ? `fill-surface ${LINEA[c.tono]}` : CAJA} strokeWidth={on ? 1.5 : 1} />
              <rect x={770} y={c.y + 18} width={3} height={52} rx={1.5} className={RELLENO[c.tono]} />
              <text x={790} y={c.y + 29} className={RELLENO[c.tono]} fontSize={12} fontWeight={700} letterSpacing="0.06em">
                {c.titulo}
              </text>
              <text x={790} y={c.y + 53} className="fill-fg-soft" fontSize={12.5}>{c.lineas[0]}</text>
              <text x={790} y={c.y + 70} className="fill-fg-soft" fontSize={12.5}>{c.lineas[1]}</text>
            </g>
          );
        })}

        <rect x={250} y={382} width={740} height={54} rx={14} className={CAJA} strokeDasharray="4 4" />
        <text x={270} y={414} className="fill-fg" fontSize={14} fontWeight={600}>Registro de cada decisión</text>
        <text x={470} y={414} className="fill-fg-muted" fontSize={12.5}>request_id + ID de HubSpot · el CRM solo como registro</text>

        {/* Líneas, encima de las cajas y terminando en su borde */}
        <path d="M210 180 H246" className="flujo stroke-fg-faint" strokeWidth={1.25} fill="none" markerEnd="url(#punta-neutra)" />
        <text x={213} y={170} className="fill-fg-faint" fontSize={10.5}>llama</text>
        <path d="M440 180 H496" className="flujo stroke-fg-faint" strokeWidth={1.25} fill="none" markerEnd="url(#punta-neutra)" />
        <text x={446} y={170} className="fill-fg-faint" fontSize={10.5}>consulta</text>
        <path d="M700 180 H735" className={`flujo atenuable ${LINEA[activo]}`} strokeWidth={1.5} fill="none" />

        {CAMINOS.map((c) => {
          const on = c.tono === activo;
          return (
            <path
              key={c.tono}
              d={`M735 180 V${c.y + 44} H766`}
              className={`atenuable ${LINEA[c.tono]} ${on ? "flujo" : ""}`}
              style={{ opacity: on ? 1 : 0.3 }}
              strokeWidth={on ? 2 : 1.25}
              fill="none"
              markerEnd={`url(#punta-${c.tono})`}
            />
          );
        })}

        <path d="M600 240 V378" className="stroke-fg-faint" strokeWidth={1.25} strokeDasharray="4 4" fill="none" markerEnd="url(#punta-neutra)" />
      </svg>

      <p className="mt-4 hidden min-h-[1.5rem] text-sm text-fg-soft md:block" aria-live="polite">
        <span className={`font-semibold ${TEXTO[caminoActivo.tono]}`}>{caminoActivo.titulo}.</span>{" "}
        <span className="text-fg-muted">Ejemplo real de la demo:</span> {caminoActivo.ejemplo}
      </p>

      <ol className="space-y-3 md:hidden" aria-label="Cómo se pone VoBo en 30X">
        {PASOS_LISTA.map((p, i) => (
          <li key={p.titulo} className={`rounded-field border p-4 ${i === 2 ? "border-accent" : "border-line"}`}>
            <p className="font-display text-base text-fg">
              <span className="mono mr-2 text-xs text-fg-faint">{i + 1}</span>
              {p.titulo}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{p.texto}</p>
          </li>
        ))}
        {CAMINOS.map((c) => (
          <li key={c.tono} className="ml-4 rounded-field border border-line p-4">
            <p className={`text-xs font-semibold tracking-wide ${TEXTO[c.tono]}`}>{c.titulo}</p>
            <p className="mt-1 text-sm text-fg-soft">
              {c.lineas[0]} {c.lineas[1]}
            </p>
          </li>
        ))}
        <li className="rounded-field border border-dashed border-line p-4 text-sm text-fg-muted">
          <span className="font-medium text-fg">Registro de cada decisión:</span> request_id + ID de HubSpot.
        </li>
      </ol>
    </div>
  );
}
