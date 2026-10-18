/**
 * Cómo se pone VoBo en 30X, tal como está construido (integraciones/mcp/LEEME.md y docs/INTEGRACION.md):
 * el agente llama a una herramienta de salida → la puerta (donde viven las llaves) consulta a VoBo → tres caminos.
 * Las líneas se dibujan después de las cajas y terminan en su borde, para que nada quede detrás.
 * En pantallas angostas se muestra la misma estructura como lista (el SVG sería ilegible).
 */

const CAJA = "fill-surface stroke-line-strong";

type Tono = "allow" | "review" | "block";

const LINEA: Record<Tono, string> = { allow: "stroke-allow", review: "stroke-review", block: "stroke-block" };
const TEXTO: Record<Tono, string> = { allow: "fill-allow", review: "fill-review", block: "fill-block" };

const CAMINOS: { tono: Tono; y: number; titulo: string; lineas: [string, string] }[] = [
  { tono: "allow", y: 20, titulo: "PERMITIR", lineas: ["Sale: correo, WhatsApp, redes", "o el cambio en HubSpot."] },
  { tono: "review", y: 140, titulo: "PEDIR VOBO (o falla)", lineas: ["No sale aún. Aviso en Slack;", "decide una persona."] },
  { tono: "block", y: 260, titulo: "BLOQUEAR", lineas: ["No sale. El agente recibe", "las razones."] },
];

const PASOS_LISTA = [
  { titulo: "Agente de 30X", texto: "Propone la acción con una herramienta (Python, tool calling o MCP)." },
  { titulo: "Puerta de salida", texto: "La herramienta consulta a VoBo antes de ejecutar. Las llaves de salida viven solo aquí." },
  { titulo: "VoBo", texto: "Reglas en código + JEV, ≈ 0,4 s. Si no responde bien, la acción no sale." },
];

export function DiagramaPuerta() {
  return (
    <>
      <svg viewBox="0 0 1000 450" className="hidden h-auto w-full md:block" role="img" aria-labelledby="diagrama-titulo diagrama-desc">
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
              <path d="M0 0L10 5L0 10z" className={t === "neutra" ? "fill-fg-faint" : TEXTO[t]} />
            </marker>
          ))}
        </defs>

        {/* Cajas */}
        <rect x={10} y={135} width={200} height={90} rx={12} className={CAJA} />
        <text x={30} y={173} className="fill-fg" fontSize={17} fontWeight={600}>Agente de 30X</text>
        <text x={30} y={197} className="fill-fg-muted" fontSize={12.5}>Python · tool calling o MCP</text>

        <rect x={250} y={135} width={190} height={90} rx={12} className={CAJA} />
        <text x={270} y={173} className="fill-fg" fontSize={17} fontWeight={600}>Puerta de salida</text>
        <text x={270} y={197} className="fill-fg-muted" fontSize={12.5}>Las llaves viven aquí</text>

        <rect x={500} y={120} width={200} height={120} rx={12} className="fill-surface stroke-accent" strokeWidth={1.5} />
        <text x={522} y={162} className="fill-fg" fontSize={24} fontWeight={600}>VoBo</text>
        <text x={522} y={188} className="fill-fg-muted" fontSize={12.5}>Reglas en código + JEV</text>
        <text x={522} y={210} className="fill-fg-faint" fontSize={12}>≈ 0,4 s · falla cerrada</text>

        {CAMINOS.map((c) => (
          <g key={c.tono}>
            <rect x={770} y={c.y} width={220} height={90} rx={12} className={CAJA} />
            <text x={790} y={c.y + 30} className={TEXTO[c.tono]} fontSize={12.5} fontWeight={600} letterSpacing="0.04em">
              {c.titulo}
            </text>
            <text x={790} y={c.y + 54} className="fill-fg-soft" fontSize={13}>{c.lineas[0]}</text>
            <text x={790} y={c.y + 72} className="fill-fg-soft" fontSize={13}>{c.lineas[1]}</text>
          </g>
        ))}

        <rect x={250} y={380} width={740} height={56} rx={12} className={CAJA} strokeDasharray="4 4" />
        <text x={270} y={413} className="fill-fg" fontSize={14} fontWeight={600}>Registro de cada decisión</text>
        <text x={470} y={413} className="fill-fg-muted" fontSize={12.5}>request_id + ID de HubSpot · el CRM solo como registro</text>

        {/* Líneas, encima de las cajas y terminando en su borde */}
        <path d="M210 180 H246" className="stroke-fg-faint" strokeWidth={1.25} fill="none" markerEnd="url(#punta-neutra)" />
        <text x={214} y={170} className="fill-fg-faint" fontSize={10.5}>llama</text>
        <path d="M440 180 H496" className="stroke-fg-faint" strokeWidth={1.25} fill="none" markerEnd="url(#punta-neutra)" />
        <text x={446} y={170} className="fill-fg-faint" fontSize={10.5}>consulta</text>

        <path d="M700 180 H735" className="stroke-fg-faint" strokeWidth={1.25} fill="none" />
        {CAMINOS.map((c) => (
          <path
            key={c.tono}
            d={`M735 180 V${c.y + 45} H766`}
            className={LINEA[c.tono]}
            strokeWidth={1.5}
            fill="none"
            markerEnd={`url(#punta-${c.tono})`}
          />
        ))}

        <path d="M600 240 V376" className="stroke-fg-faint" strokeWidth={1.25} strokeDasharray="4 4" fill="none" markerEnd="url(#punta-neutra)" />
      </svg>

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
            <p className={`text-xs font-semibold tracking-wide ${c.tono === "allow" ? "text-allow" : c.tono === "review" ? "text-review" : "text-block"}`}>
              {c.titulo}
            </p>
            <p className="mt-1 text-sm text-fg-soft">
              {c.lineas[0]} {c.lineas[1]}
            </p>
          </li>
        ))}
        <li className="rounded-field border border-dashed border-line p-4 text-sm text-fg-muted">
          <span className="font-medium text-fg">Registro de cada decisión:</span> request_id + ID de HubSpot.
        </li>
      </ol>
    </>
  );
}
