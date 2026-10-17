"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Insignia } from "@/components/ResultadoPanel";
import type { RespuestaEvaluate } from "@/lib/vobo/api-contrato";
import { encolar } from "@/lib/vobo/cola-local";
import { TIPOS_ACCION, miles, usd } from "@/lib/vobo/ui-datos";
import { useCola } from "@/lib/vobo/use-cola";
import type { Decision } from "@/lib/vobo/types";

type RespuestaSim = RespuestaEvaluate & {
  indice: number;
  accion: { id?: string; tipo_accion: string; canal: string; destinatarios: number; texto: string };
};

interface Fila {
  indice: number;
  id: string;
  tipo: string;
  decision: Decision;
  titular: string;
  jevMs: number;
}

type Fase = "inactiva" | "corriendo" | "pausada" | "terminada";

const NOMBRE_TIPO = Object.fromEntries(TIPOS_ACCION.map((t) => [t.valor, t.etiqueta])) as Record<string, string>;
const ACCIONES_POR_DIA = 10_000;
const PAUSA_ENTRE_ACCIONES_MS = 150;

const claseCampo =
  "rounded-field border border-line-strong bg-field px-3 py-2 text-sm text-fg hover:border-brand-moss focus:border-accent";

function Dato({ etiqueta, valor, nota }: { etiqueta: string; valor: React.ReactNode; nota?: string }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{etiqueta}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-fg">{valor}</dd>
      {nota && <p className="text-xs text-fg-muted">{nota}</p>}
    </div>
  );
}

export function Simulacion({ total }: { total: number }) {
  const [cantidad, setCantidad] = useState(Math.min(20, total));
  const [fase, setFase] = useState<Fase>("inactiva");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [costo, setCosto] = useState(0);
  const [segundos, setSegundos] = useState(0);
  const [aviso, setAviso] = useState("");
  const [jev, setJev] = useState<{ modo: "mock" | "live"; configurado: boolean } | null>(null);
  const pendientes = useCola().filter((i) => i.estado === "pendiente").length;

  const corriendo = useRef(false);
  const siguiente = useRef(0);
  const inicio = useRef(0);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    fetch("/api/evaluate")
      .then((r) => r.json())
      .then(setJev)
      .catch(() => setJev(null));
    return () => {
      montado.current = false;
      corriendo.current = false;
    };
  }, []);

  const correr = useCallback(async () => {
    corriendo.current = true;
    setFase("corriendo");
    setAviso("");
    if (siguiente.current === 0) inicio.current = performance.now();

    while (corriendo.current && siguiente.current < cantidad) {
      const i = siguiente.current;
      let res: Response;
      try {
        res = await fetch("/api/simulacion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ i }) });
      } catch {
        corriendo.current = false;
        if (montado.current) {
          setFase("pausada");
          setAviso("No se pudo conectar con el servidor. Reanuda cuando vuelva la conexión: se retoma en la misma acción.");
        }
        return;
      }
      if (!montado.current) return;
      if (!res.ok) {
        corriendo.current = false;
        const detalle = (await res.json().catch(() => ({}))) as { error?: string };
        setFase("pausada");
        setAviso(`${detalle.error ?? `Error ${res.status}`} Reanuda para reintentar la misma acción.`);
        return;
      }
      const r = (await res.json()) as RespuestaSim;
      if (!montado.current) return;

      if (r.decision === "REVIEW") {
        encolar({
          id: r.request_id,
          origen: "simulacion",
          tipo_accion: r.accion.tipo_accion,
          id_accion: r.accion.id ?? null,
          texto: r.accion.texto,
          titular: r.explicacion.titular,
          razones: r.explicacion.razones,
          reglas: r.reglas.map((x) => x.regla),
        });
      }
      setFilas((f) => [{ indice: i, id: r.accion.id ?? `#${i + 1}`, tipo: r.accion.tipo_accion, decision: r.decision, titular: r.explicacion.titular, jevMs: r.traza.latencia_ms }, ...f]);
      setCosto((c) => c + r.traza.costo_usd);
      setSegundos((performance.now() - inicio.current) / 1000);
      siguiente.current = i + 1;
      await new Promise((ok) => setTimeout(ok, PAUSA_ENTRE_ACCIONES_MS));
    }

    corriendo.current = false;
    if (montado.current && siguiente.current >= cantidad) setFase("terminada");
  }, [cantidad]);

  const pausar = () => {
    corriendo.current = false;
    setFase("pausada");
  };

  const reiniciar = () => {
    corriendo.current = false;
    siguiente.current = 0;
    setFilas([]);
    setCosto(0);
    setSegundos(0);
    setAviso("");
    setFase("inactiva");
  };

  const n = filas.length;
  const cuenta = (d: Decision) => filas.filter((f) => f.decision === d).length;
  const permitidas = cuenta("ALLOW");
  const escaladas = cuenta("REVIEW");
  const bloqueadas = cuenta("BLOCK");
  const costoMedio = n ? costo / n : 0;
  const latenciaMedia = n ? filas.reduce((s, f) => s + f.jevMs, 0) / n : 0;
  const avance = cantidad ? Math.round((n / cantidad) * 100) : 0;
  const bloqueado = fase === "corriendo";

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-fg sm:text-5xl">Simulación en vivo</h1>
        <p className="mt-5 text-base leading-relaxed text-fg-soft sm:text-lg">
          Un agente propone acciones una tras otra y VoBo decide cada una en el momento. Así se ve la compuerta cuando no es una acción suelta, sino un
          flujo: lo seguro pasa solo, lo dudoso espera a una persona y lo peligroso se frena.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          Son {total} acciones sintéticas del banco de pruebas (del conjunto de ajuste, nunca del test). Cada una es una evaluación completa; las que
          quedan en PEDIR VOBO pasan a la <Link className="text-fg underline underline-offset-4 hover:text-accent" href="/cola">cola</Link>.
        </p>
      </header>

      {jev?.modo === "mock" && (
        <p className="rounded-field border border-line bg-surface px-4 py-3 text-sm text-fg-soft">
          <strong className="font-semibold text-fg">JEV SIMULADO.</strong> Esta instancia usa un JEV simulado: la latencia y el costo mostrados no son los del modelo real.
        </p>
      )}
      {jev?.modo === "live" && !jev.configurado && (
        <p role="alert" className="rounded-field border border-block/40 bg-block/10 px-4 py-3 text-sm font-medium text-block">
          JEV real no configurado: falta la llave en el servidor.
        </p>
      )}

      <section aria-label="Controles" className="flex flex-wrap items-end gap-4 rounded-card border border-line bg-surface p-5">
        <div>
          <label htmlFor="cantidad" className="block text-sm font-medium text-fg-soft">
            Acciones a recorrer
          </label>
          <select
            id="cantidad"
            value={cantidad}
            disabled={fase === "corriendo" || n > 0}
            onChange={(e) => setCantidad(Number(e.target.value))}
            className={`mt-1.5 ${claseCampo} disabled:opacity-60`}
          >
            {[20, 35, 50].filter((x) => x <= total).map((x) => (
              <option key={x} value={x}>
                {x} acciones
              </option>
            ))}
          </select>
        </div>

        {fase === "corriendo" ? (
          <button type="button" onClick={pausar} className="rounded-field border border-line-strong px-5 py-2.5 text-[15px] font-semibold text-fg hover:border-brand-moss">
            Pausar
          </button>
        ) : fase === "terminada" ? null : (
          <button type="button" onClick={() => void correr()} className="rounded-field bg-accent px-5 py-2.5 text-[15px] font-semibold text-on-accent hover:brightness-95">
            {fase === "pausada" ? "Reanudar" : "Iniciar simulación"}
          </button>
        )}
        {n > 0 && (
          <button type="button" onClick={reiniciar} className="rounded-field border border-line px-4 py-2.5 text-sm text-fg-muted hover:text-fg">
            Reiniciar
          </button>
        )}
        <Link href="/cola" className="ml-auto rounded-field border border-line px-4 py-2.5 text-sm text-fg-soft hover:text-fg">
          Ver la cola{pendientes > 0 ? ` (${pendientes} pendientes)` : ""}
        </Link>
      </section>

      {aviso && (
        <p role="alert" className="rounded-field border border-review/40 bg-review/10 px-4 py-3 text-sm text-fg-soft">
          {aviso}
        </p>
      )}

      <section aria-label="Contadores" className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <div
          role="progressbar"
          aria-label="Avance de la simulación"
          aria-valuemin={0}
          aria-valuemax={cantidad}
          aria-valuenow={n}
          className="h-1.5 w-full overflow-hidden rounded-full bg-raised"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${avance}%` }} />
        </div>
        <p className="tabular mt-2 text-xs text-fg-muted">
          {n} de {cantidad} acciones decididas
          {fase === "corriendo" && " · en curso…"}
        </p>

        <dl className="tabular mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-fg-muted">Permitidas</dt>
            <dd className="mt-1">
              <Insignia decision="ALLOW" /> <span className="ml-1 text-lg font-semibold text-fg">{permitidas}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Escaladas a una persona</dt>
            <dd className="mt-1">
              <Insignia decision="REVIEW" /> <span className="ml-1 text-lg font-semibold text-fg">{escaladas}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Bloqueadas</dt>
            <dd className="mt-1">
              <Insignia decision="BLOCK" /> <span className="ml-1 text-lg font-semibold text-fg">{bloqueadas}</span>
            </dd>
          </div>
          <Dato etiqueta="Costo acumulado" valor={usd(costo)} nota={n ? `${usd(costoMedio)} por decisión` : undefined} />
        </dl>

        <dl className="tabular mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4 text-sm sm:grid-cols-4">
          <Dato etiqueta="Latencia media de JEV" valor={n ? `${Math.round(latenciaMedia)} ms` : "—"} />
          <Dato etiqueta="Tiempo transcurrido" valor={n ? `${segundos.toFixed(1)} s` : "—"} />
          <Dato etiqueta="Ritmo" valor={n && segundos > 0 ? `${(n / segundos).toFixed(1)} /s` : "—"} nota="una tras otra, sin paralelismo" />
          <Dato etiqueta="En la cola ahora" valor={pendientes} />
        </dl>
      </section>

      {fase === "terminada" && (
        <section role="status" aria-label="Resumen" className="rounded-card border border-line bg-surface p-5 sm:p-6">
          <h2 className="display-sans text-lg font-semibold text-fg">Resumen</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fg-soft">
            De {n} acciones, VoBo dejó pasar {permitidas} sin molestar a nadie, escaló {escaladas} a una persona y frenó {bloqueadas}, en {segundos.toFixed(1)} s
            y por {usd(costo)}.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-fg-soft">
            <strong className="font-semibold text-fg">Proyección:</strong> a ese costo por decisión, {miles(ACCIONES_POR_DIA)} decisiones al día costarían ≈{" "}
            {usd(costoMedio * ACCIONES_POR_DIA)} (el costo de este flujo; no incluye nada más). Es una extrapolación de {n} acciones sintéticas, no una medición de tráfico real.
          </p>
          <p className="mt-4 text-sm">
            <Link className="text-fg underline underline-offset-4 hover:text-accent" href="/cola">
              Revisar las {escaladas} acciones que esperan en la cola
            </Link>
          </p>
        </section>
      )}

      <section aria-label="Decisiones" aria-live={bloqueado ? "off" : "polite"}>
        <h2 className="display-sans text-xl font-semibold text-fg">Decisiones, de la más reciente a la más antigua</h2>
        {filas.length === 0 ? (
          <p className="mt-3 text-sm text-fg-muted">Todavía no hay decisiones. Pulsa «Iniciar simulación».</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="tabular w-full min-w-[40rem] border-collapse text-left text-sm">
              <caption className="sr-only">Las últimas decisiones de la simulación</caption>
              <thead>
                <tr className="border-b border-line-strong text-xs text-fg-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Acción</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Tipo</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Decisión</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Por qué</th>
                  <th scope="col" className="py-2 text-right font-medium">JEV</th>
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, 15).map((f) => (
                  <tr key={f.indice} className="border-b border-line align-top">
                    <th scope="row" className="py-2.5 pr-3 text-left font-mono text-xs font-normal text-fg">{f.id}</th>
                    <td className="py-2.5 pr-3 text-fg-soft">{NOMBRE_TIPO[f.tipo] ?? f.tipo}</td>
                    <td className="py-2.5 pr-3"><Insignia decision={f.decision} /></td>
                    <td className="py-2.5 pr-3 text-fg-soft"><span className="line-clamp-2">{f.titular.replace(/^(PERMITIR|PEDIR VOBO|BLOQUEAR): /, "")}</span></td>
                    <td className="py-2.5 text-right text-fg-muted">{f.jevMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filas.length > 15 && <p className="mt-2 text-xs text-fg-muted">Se muestran las 15 más recientes de {filas.length}.</p>}
          </div>
        )}
      </section>
    </div>
  );
}
