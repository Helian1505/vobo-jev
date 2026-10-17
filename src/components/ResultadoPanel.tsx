import { IconoDecision } from "@/components/iconos";
import { ETIQUETA_DECISION } from "@/lib/vobo/combine";
import { textoRegla } from "@/lib/vobo/explain";
import type { Evaluacion } from "@/lib/vobo/evaluate";
import type { Senal } from "@/lib/vobo/jev/interpret";
import type { Decision } from "@/lib/vobo/types";
import { ETIQUETA_PREGUNTA, ETIQUETA_REGLA, miles, pct, usd } from "@/lib/vobo/ui-datos";

/** Cada decisión: texto + ícono + color (nunca solo color). Colores pastel de estado de HackRadar. */
export const ESTILO: Record<Decision, { caja: string; barra: string; texto: string }> = {
  ALLOW: { caja: "border-allow/40 bg-allow/10 text-allow", barra: "bg-allow", texto: "text-allow" },
  REVIEW: { caja: "border-review/40 bg-review/10 text-review", barra: "bg-review", texto: "text-review" },
  BLOCK: { caja: "border-block/40 bg-block/10 text-block", barra: "bg-block", texto: "text-block" },
};

export function Insignia({ decision, grande = false }: { decision: Decision; grande?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border font-semibold ${ESTILO[decision].caja} ${
        grande ? "px-4 py-2 text-lg tracking-tight" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      <IconoDecision decision={decision} tamano={grande ? 20 : 13} />
      {ETIQUETA_DECISION[decision]}
    </span>
  );
}

const LECTURA_ESTADO = { alerta: "Alerta", duda: "Duda", ok: "Sin riesgo" } as const;

function lecturaSenal(s: Senal): string {
  const d = s.detalle as { declarado?: string; detectado?: string };
  if (s.id === "segmento") {
    return s.estado === "alerta"
      ? `parece dirigido a «${d.detectado}», no a «${d.declarado}» (${pct(s.prob)})`
      : `público más probable: ${s.opcion ?? "—"} (${pct(s.prob)})`;
  }
  if (s.id === "tono") {
    return s.estado === "ok" ? `adecuado, ${pct(s.prob)} de riesgo` : `${s.opcion === "ofensivo" ? "ofensivo" : "sensacionalista"} (${pct(s.prob)})`;
  }
  if (s.estado === "ok") return `${pct(s.prob)} de riesgo`;
  if (s.opcion) return `${s.opcion.replaceAll("_", " ")} · ${pct(s.prob)}`;
  return `probabilidad de sí: ${pct(s.prob)}`;
}

function FilaSenal({ s }: { s: Senal }) {
  const ancho = Math.max(2, Math.round(s.prob * 100));
  const nombre = ETIQUETA_PREGUNTA[s.id] ?? s.id;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-medium text-fg">{nombre}</span>
        <span className="text-xs text-fg-muted">
          <span className={s.estado === "ok" ? "font-medium text-fg-soft" : `font-semibold ${ESTILO[s.decision].texto}`}>
            {LECTURA_ESTADO[s.estado]}
          </span>{" "}
          · {lecturaSenal(s)}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-raised"
        role="meter"
        aria-label={`${nombre}: ${pct(s.prob)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(s.prob * 100)}
      >
        <div className={`h-full rounded-full ${ESTILO[s.decision].barra}`} style={{ width: `${ancho}%` }} />
      </div>
    </li>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h3 className="text-sm font-semibold text-fg">{titulo}</h3>
      {children}
    </section>
  );
}

export function ResultadoPanel({
  evaluacion: ev,
  intencion,
}: {
  evaluacion: Evaluacion;
  /** Intención de diseño del ejemplo activo (solo se muestra después de evaluar). */
  intencion?: string;
}) {
  const t = ev.traza;
  const coincide = intencion === ETIQUETA_DECISION[ev.decision];
  return (
    <div className="entra space-y-5" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <Insignia decision={ev.decision} grande />
        {ev.jev_simulado && (
          <span className="rounded-full border border-line-strong px-2.5 py-1 text-xs font-semibold text-fg-soft">JEV SIMULADO</span>
        )}
        {ev.jev_estado === "fallo" && (
          <span className="rounded-full border border-review/40 bg-review/10 px-2.5 py-1 text-xs font-semibold text-review">
            JEV no respondió
          </span>
        )}
      </div>

      <div>
        <h2 className="display-sans text-xl font-semibold leading-snug text-fg">{ev.explicacion.titular}</h2>
        {ev.explicacion.razones.length > 1 && (
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-fg-soft marker:text-fg-muted">
            {ev.explicacion.razones.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {intencion && (
          <p className="mt-4 rounded-field border border-line bg-field px-3 py-2 text-sm text-fg-soft">
            Intención de diseño del ejemplo: <strong className="font-semibold text-fg">{intencion}</strong> ·{" "}
            {coincide ? "el resultado coincide." : `el resultado fue ${ETIQUETA_DECISION[ev.decision]}.`}
          </p>
        )}
      </div>

      <Seccion titulo="Reglas activadas (código)">
        {ev.reglas.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">Ninguna regla se activó.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-fg-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Regla</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Decisión</th>
                  <th scope="col" className="py-2 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {ev.reglas.map((r) => (
                  <tr key={r.regla} className="border-b border-line align-top last:border-0">
                    <td className="py-3 pr-3 font-medium text-fg">{ETIQUETA_REGLA[r.regla]}</td>
                    <td className="py-3 pr-3"><Insignia decision={r.decision} /></td>
                    <td className="py-3 text-fg-soft">{textoRegla(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-fg-muted">Piso de reglas: {ETIQUETA_DECISION[ev.piso_reglas]}.</p>
      </Seccion>

      <Seccion titulo={ev.jev_simulado ? "Lo que opina JEV (simulado)" : "Lo que opina JEV"}>
        {ev.jev_estado === "ok" ? (
          <>
            <ul className="mt-1 divide-y divide-line">
              {ev.senales_jev.map((s) => (
                <FilaSenal key={s.id} s={s} />
              ))}
            </ul>
            <p className="mt-2 text-xs text-fg-muted">
              Riesgo según JEV: {ETIQUETA_DECISION[ev.riesgo_jev]} · umbrales {ev.perfil} (acción {ev.reversibilidad}).
            </p>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-medium text-fg-soft hover:text-fg">Ver respuestas crudas de JEV</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-field border border-line bg-field p-3 font-mono text-[12px] leading-relaxed text-fg-soft">
                {JSON.stringify(t.respuestas_crudas, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <p className="mt-2 text-sm text-fg-muted">
            {ev.jev_estado === "fallo"
              ? "No se pudo consultar a JEV; por seguridad la acción pasa a VoBo humano."
              : "JEV no se consultó en esta evaluación."}
          </p>
        )}
      </Seccion>

      <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-3 rounded-field border border-line bg-field p-4 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-fg-muted">Modelo</dt><dd className="mt-0.5 font-medium text-fg">{t.modelo}</dd></div>
        <div><dt className="text-xs text-fg-muted">Latencia</dt><dd className="mt-0.5 font-medium text-fg">{t.latencia_ms} ms</dd></div>
        <div><dt className="text-xs text-fg-muted">Tokens de entrada</dt><dd className="mt-0.5 font-medium text-fg">{miles(t.input_tokens)}</dd></div>
        <div><dt className="text-xs text-fg-muted">Costo</dt><dd className="mt-0.5 font-medium text-fg">{usd(t.costo_usd)}</dd></div>
        <div className="col-span-2 border-t border-line pt-3 sm:col-span-4">
          <dt className="text-xs text-fg-muted">Costo por 1.000 decisiones</dt>
          <dd className="mt-0.5 font-medium text-fg">≈ {usd(t.costo_usd * 1000)}</dd>
        </div>
      </dl>
    </div>
  );
}
