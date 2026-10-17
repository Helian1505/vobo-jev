import { ETIQUETA_DECISION } from "@/lib/vobo/combine";
import { textoRegla } from "@/lib/vobo/explain";
import type { Evaluacion } from "@/lib/vobo/evaluate";
import type { Senal } from "@/lib/vobo/jev/interpret";
import type { Decision } from "@/lib/vobo/types";
import { ETIQUETA_PREGUNTA, ETIQUETA_REGLA, miles, pct, usd } from "@/lib/vobo/ui-datos";

const ESTILO: Record<Decision, { caja: string; barra: string; icono: string }> = {
  ALLOW: { caja: "border-emerald-700 bg-emerald-50 text-emerald-900", barra: "bg-emerald-600", icono: "✓" },
  REVIEW: { caja: "border-amber-700 bg-amber-50 text-amber-950", barra: "bg-amber-600", icono: "!" },
  BLOCK: { caja: "border-red-700 bg-red-50 text-red-900", barra: "bg-red-600", icono: "✕" },
};

function Insignia({ decision, grande = false }: { decision: Decision; grande?: boolean }) {
  const e = ESTILO[decision];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border-2 font-bold tracking-wide ${e.caja} ${
        grande ? "px-4 py-2 text-2xl" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden="true">{e.icono}</span>
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
  const e = ESTILO[s.decision];
  const ancho = Math.max(2, Math.round(s.prob * 100));
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-medium">{ETIQUETA_PREGUNTA[s.id] ?? s.id}</span>
        <span className="text-xs text-slate-700">
          <span className="font-semibold">{LECTURA_ESTADO[s.estado]}</span> · {lecturaSenal(s)}
        </span>
      </div>
      <div
        className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-200"
        role="meter"
        aria-label={`${ETIQUETA_PREGUNTA[s.id] ?? s.id}: ${pct(s.prob)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(s.prob * 100)}
      >
        <div className={`h-full ${e.barra}`} style={{ width: `${ancho}%` }} />
      </div>
    </li>
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
    <section aria-labelledby="titulo-resultado" className="space-y-5" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <Insignia decision={ev.decision} grande />
        {ev.jev_simulado && (
          <span className="rounded border border-slate-700 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">
            JEV SIMULADO
          </span>
        )}
        {ev.jev_estado === "fallo" && (
          <span className="rounded border border-amber-700 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-950">
            JEV no respondió
          </span>
        )}
      </div>

      <div>
        <h2 id="titulo-resultado" className="text-lg font-semibold">
          {ev.explicacion.titular}
        </h2>
        {ev.explicacion.razones.length > 1 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {ev.explicacion.razones.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {intencion && (
          <p className="mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
            Intención de diseño del ejemplo: <strong>{intencion}</strong> ·{" "}
            {coincide ? "el resultado coincide." : `el resultado fue ${ETIQUETA_DECISION[ev.decision]}.`}
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Reglas activadas (código)</h3>
        {ev.reglas.length === 0 ? (
          <p className="mt-1 text-sm text-slate-700">Ninguna regla se activó.</p>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs text-slate-700">
                  <th scope="col" className="py-1 pr-3 font-semibold">Regla</th>
                  <th scope="col" className="py-1 pr-3 font-semibold">Decisión</th>
                  <th scope="col" className="py-1 font-semibold">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {ev.reglas.map((r) => (
                  <tr key={r.regla} className="border-b border-slate-200 align-top">
                    <td className="py-2 pr-3 font-medium">{ETIQUETA_REGLA[r.regla]}</td>
                    <td className="py-2 pr-3"><Insignia decision={r.decision} /></td>
                    <td className="py-2 text-slate-800">{textoRegla(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1 text-xs text-slate-700">Piso de reglas: {ETIQUETA_DECISION[ev.piso_reglas]}.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Lo que opina JEV {ev.jev_simulado ? "(simulado)" : ""}
        </h3>
        {ev.jev_estado === "ok" ? (
          <>
            <ul className="mt-1 divide-y divide-slate-200">
              {ev.senales_jev.map((s) => (
                <FilaSenal key={s.id} s={s} />
              ))}
            </ul>
            <p className="mt-1 text-xs text-slate-700">
              Riesgo según JEV: {ETIQUETA_DECISION[ev.riesgo_jev]} · perfil de umbrales {ev.perfil} (acción {ev.reversibilidad}).
            </p>
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-medium text-slate-800">Ver respuestas crudas de JEV</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-900 p-3 text-slate-100">
                {JSON.stringify(t.respuestas_crudas, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-700">
            {ev.jev_estado === "fallo"
              ? "No se pudo consultar a JEV; por seguridad la acción pasa a VoBo humano."
              : "JEV no se consultó en esta evaluación."}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded border border-slate-300 bg-white p-3 text-xs text-slate-800 sm:grid-cols-4">
        <div><dt className="text-slate-600">Modelo</dt><dd className="font-semibold">{t.modelo}</dd></div>
        <div><dt className="text-slate-600">Latencia</dt><dd className="font-semibold">{t.latencia_ms} ms</dd></div>
        <div><dt className="text-slate-600">Tokens de entrada</dt><dd className="font-semibold">{miles(t.input_tokens)}</dd></div>
        <div><dt className="text-slate-600">Costo</dt><dd className="font-semibold">{usd(t.costo_usd)}</dd></div>
        <div className="col-span-2 sm:col-span-4">
          <dt className="text-slate-600">Costo por 1.000 decisiones</dt>
          <dd className="font-semibold">≈ {usd(t.costo_usd * 1000)}</dd>
        </div>
      </dl>
    </section>
  );
}
