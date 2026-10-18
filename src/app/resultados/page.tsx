import type { Metadata } from "next";
import { Insignia } from "@/components/ResultadoPanel";
import { proporcion, type ErrorCaso, type MetricasModo, type ResumenConjunto } from "@/lib/vobo/eval/metricas";
import type { ResultadoBanco } from "@/lib/vobo/eval/resultado";
import { UMBRALES } from "@/lib/vobo/thresholds";
import type { Decision } from "@/lib/vobo/types";
import { miles, pct1 } from "@/lib/vobo/ui-datos";
import devJson from "../../../eval/results/dev.json";
import tuneJson from "../../../eval/results/tune_dev.json";
import testJson from "../../../eval/results/test.json";
import lockJson from "../../../eval/runs/TEST_LOCK.json";
import { Cifras, type Cifra } from "@/components/Cifras";
import { EncabezadoPagina, EncabezadoSeccion, Plegable } from "@/components/EncabezadoPagina";
import { Revelar } from "@/components/Revelar";

export const metadata: Metadata = {
  title: "Resultados del banco — VoBo",
  description: "Qué tan bien frena VoBo las acciones peligrosas: banco de 400 acciones sintéticas, corrida única del test con JEV real.",
};

const test = testJson as unknown as ResultadoBanco;
const dev = devJson as unknown as ResultadoBanco;
const tune = tuneJson as unknown as { perfiles: Record<string, { filas: number }> };

const REPO = "https://github.com/Helian1505/vobo-jev/blob/main";
const MODOS = [
  { id: "solo_reglas", nombre: "Solo reglas", nota: "El código, sin JEV" },
  { id: "solo_jev", nombre: "Solo JEV", nota: "JEV, ignorando el piso de reglas" },
  { id: "combinado", nombre: "Combinado (VoBo)", nota: "El más severo de los dos" },
] as const;
const ORDEN: Decision[] = ["ALLOW", "REVIEW", "BLOCK"];

const fraccion = (k: number, n: number) => `${k} de ${n}`;

function ic(p: { ic95: [number, number] | null }) {
  return p.ic95 ? `IC 95%: ${pct1(p.ic95[0])} a ${pct1(p.ic95[1])}` : "";
}

function TablaMetricas({ conjunto }: { conjunto: ResumenConjunto }) {
  const filas: { etiqueta: string; ayuda: string; valor: (m: MetricasModo) => React.ReactNode }[] = [
    {
      etiqueta: "Peligrosas aprobadas sin persona",
      ayuda: "Acción peligrosa que la compuerta deja pasar. La meta es 0.",
      valor: (m) => (
        <>
          <span className="text-base font-semibold text-fg">{fraccion(m.peligrosas_auto_aprobadas, m.peligrosas)}</span>
          <span className="mt-0.5 block text-xs text-fg-muted">
            {m.techo_regla_del_3 !== null ? `con 0 fallos, techo ≈ ${pct1(m.techo_regla_del_3)}` : pct1(m.peligrosas_auto_aprobadas / m.peligrosas)}
          </span>
        </>
      ),
    },
    {
      etiqueta: "Autonomía",
      ayuda: "De las acciones seguras, las que pasan sin pedir a una persona.",
      valor: (m) => (
        <>
          <span className="text-base font-semibold text-fg">{pct1(m.autonomia.pct)}</span>
          <span className="mt-0.5 block text-xs text-fg-muted">
            {fraccion(m.autonomia.k, m.autonomia.n)} · {ic(m.autonomia)}
          </span>
        </>
      ),
    },
    {
      etiqueta: "Escaladas a una persona",
      ayuda: "Del total, las que quedan en PEDIR VOBO.",
      valor: (m) => (
        <>
          <span className="text-base font-semibold text-fg">{pct1(m.escalado.pct)}</span>
          <span className="mt-0.5 block text-xs text-fg-muted">{fraccion(m.escalado.k, m.escalado.n)}</span>
        </>
      ),
    },
    {
      etiqueta: "Sobre-bloqueo",
      ayuda: "Acción segura que la compuerta bloquea.",
      valor: (m) => (
        <>
          <span className="text-base font-semibold text-fg">{pct1(m.sobre_bloqueo.pct)}</span>
          <span className="mt-0.5 block text-xs text-fg-muted">{fraccion(m.sobre_bloqueo.k, m.sobre_bloqueo.n)}</span>
        </>
      ),
    },
    {
      etiqueta: "Severidad subestimada",
      ayuda: "Debía bloquearse y quedó en PEDIR VOBO (una persona la ve).",
      valor: (m) => (
        <>
          <span className="text-base font-semibold text-fg">{pct1(m.severidad_subestimada.pct)}</span>
          <span className="mt-0.5 block text-xs text-fg-muted">{fraccion(m.severidad_subestimada.k, m.severidad_subestimada.n)}</span>
        </>
      ),
    },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[40rem] border-collapse text-left text-sm">
        <caption className="sr-only">Métricas por modo sobre {conjunto.n} acciones</caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="py-3 pr-4 text-xs font-medium text-fg-muted">
              Métrica
            </th>
            {MODOS.map((m) => (
              <th key={m.id} scope="col" className="px-3 py-3 align-bottom">
                <span className={m.id === "combinado" ? "text-sm font-semibold text-accent" : "text-sm font-semibold text-fg"}>{m.nombre}</span>
                <span className="block text-xs font-normal text-fg-muted">{m.nota}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.etiqueta} className="border-b border-line align-top">
              <th scope="row" className="py-4 pr-4 text-left font-medium text-fg">
                {f.etiqueta}
                <span className="mt-0.5 block text-xs font-normal text-fg-muted">{f.ayuda}</span>
              </th>
              {MODOS.map((m) => (
                <td key={m.id} className={`px-3 py-4 ${m.id === "combinado" ? "bg-surface" : ""}`}>
                  {f.valor(conjunto[m.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Matriz({ titulo, m }: { titulo: string; m: MetricasModo }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-fg">{titulo}</h3>
      <table className="tabular border-collapse text-center text-sm">
        <caption className="sr-only">
          Matriz de confusión: filas, etiqueta del banco; columnas, decisión de VoBo.
        </caption>
        <thead>
          <tr>
            <td />
            <th scope="col" colSpan={3} className="pb-1 text-xs font-medium text-fg-muted">
              Decisión de VoBo
            </th>
          </tr>
          <tr>
            <td />
            {ORDEN.map((d) => (
              <th key={d} scope="col" className="px-1.5 pb-2">
                <Insignia decision={d} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ORDEN.map((et, i) => (
            <tr key={et}>
              <th scope="row" className="pr-3 text-right">
                <span className="mr-2 text-xs font-medium text-fg-muted">Etiqueta</span>
                <Insignia decision={et} />
              </th>
              {ORDEN.map((d, j) => {
                const n = m.confusion[i]?.[j] ?? 0;
                const peligrosaAprobada = et !== "ALLOW" && d === "ALLOW";
                const acierto = i === j;
                return (
                  <td
                    key={d}
                    className={`h-12 w-24 border border-line text-base font-semibold ${
                      peligrosaAprobada && n > 0
                        ? "border-block/50 bg-block/15 text-block"
                        : acierto
                          ? "bg-raised text-fg"
                          : n > 0
                            ? "text-fg-soft"
                            : "text-fg-muted"
                    }`}
                  >
                    {n}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TIPO: Record<ErrorCaso["tipo"], string> = {
  peligrosa_aprobada: "Peligrosa aprobada sin persona",
  sobre_bloqueo: "Sobre-bloqueo",
  severidad_subestimada: "Severidad subestimada",
  otro: "Escalada de más o de menos",
};

function ListaErrores({ errores }: { errores: ErrorCaso[] }) {
  return (
    <ul className="divide-y divide-line">
      {errores.map((e) => (
        <li key={e.id} className="py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <span className="font-mono text-fg">{e.id}</span>
            <span>{TIPO[e.tipo]}</span>
            <span aria-hidden="true">·</span>
            <span>
              etiqueta <Insignia decision={e.etiqueta} /> → decisión <Insignia decision={e.decision} />
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-fg-soft">«{e.texto}»</p>
          <p className="mt-1 text-xs text-fg-muted">
            Familia {e.familia} · origen de la etiqueta: {e.origen.replaceAll("_", " ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ValorJev({ c }: { c: ResumenConjunto }) {
  const v = c.valor_agregado_jev;
  const familias = Object.entries(v.por_familia).sort((a, b) => b[1].dejadas - a[1].dejadas || a[0].localeCompare(b[0]));
  return (
    <div>
      <p className="text-sm leading-relaxed text-fg-soft">
        Las reglas solas dejan pasar <strong className="text-fg">{v.dejadas_pasar_por_reglas}</strong> acciones peligrosas. El combinado
        atrapa <strong className="text-fg">{v.atrapadas_por_jev}</strong> de ellas: ese es el aporte de JEV.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="tabular w-full min-w-[26rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line-strong text-xs text-fg-muted">
              <th scope="col" className="py-2 pr-3 font-medium">Familia del banco</th>
              <th scope="col" className="py-2 pr-3 font-medium">Dejadas pasar por las reglas</th>
              <th scope="col" className="py-2 font-medium">Atrapadas por el combinado</th>
            </tr>
          </thead>
          <tbody>
            {familias.map(([f, x]) => (
              <tr key={f} className="border-b border-line">
                <th scope="row" className="py-2 pr-3 text-left font-mono text-xs font-normal text-fg-soft">{f}</th>
                <td className="py-2 pr-3">{x.dejadas}</td>
                <td className={`py-2 ${x.atrapadas < x.dejadas ? "font-semibold text-block" : ""}`}>{x.atrapadas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Barra horizontal con su etiqueta y su valor; la del combinado (VoBo) va en lima. */
function Barra({ nombre, nota, valor, texto, destacada }: { nombre: string; nota: string; valor: number; texto: string; destacada: boolean }) {
  return (
    <li className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <span>
        <span className={`block text-sm font-semibold ${destacada ? "text-accent" : "text-fg"}`}>{nombre}</span>
        <span className="block text-xs text-fg-faint">{nota}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-raised">
          <span
            className={`barra-crece block h-full rounded-full ${destacada ? "bg-accent" : "bg-fg-faint"}`}
            style={{ width: `${Math.max(1.5, valor * 100)}%` }}
          />
        </span>
        <span className="tabular w-20 text-right text-sm font-semibold text-fg">{texto}</span>
      </span>
    </li>
  );
}

export default function Resultados() {
  const p = test.conjuntos.principal as ResumenConjunto;
  const s = test.conjuntos.secundario as ResumenConjunto;
  const devTodo = dev.conjuntos.todo as ResumenConjunto;
  const devHum = dev.conjuntos.solo_etiqueta_humana as ResumenConjunto;
  const comb = p.combinado;
  const erroresGraves = s.combinado.errores.filter((e) => e.tipo !== "otro");
  const otros = s.combinado.errores.filter((e) => e.tipo === "otro");
  const aprobadas = s.combinado.errores.filter((e) => e.tipo === "peligrosa_aprobada");
  const aprobadasUnico = aprobadas.filter((e) => e.origen === "humano_unico").length;
  const fecha = new Date(test.fecha).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });
  const aPct = (x: number | null) => Math.round((x ?? 0) * 1000) / 10;

  // Todas las cifras salen de eval/results/test.json (conjunto principal); aquí solo se presentan.
  const cifras: Cifra[] = [
    {
      valor: comb.peligrosas_auto_aprobadas,
      despues: ` de ${comb.peligrosas}`,
      etiqueta: "peligrosas aprobadas sin persona. La meta era 0.",
      nota: ic(proporcion(comb.peligrosas_auto_aprobadas, comb.peligrosas)),
    },
    {
      valor: aPct(comb.autonomia.pct),
      decimales: 1,
      despues: "%",
      etiqueta: "de las acciones seguras sale sola.",
      nota: `${fraccion(comb.autonomia.k, comb.autonomia.n)} · ${ic(comb.autonomia)}`,
    },
    {
      valor: aPct(comb.escalado.pct),
      decimales: 1,
      despues: "%",
      etiqueta: "del total va a una persona (PEDIR VOBO).",
      nota: fraccion(comb.escalado.k, comb.escalado.n),
    },
    {
      valor: p.costo_latencia.latencia_p50_ms ?? 0,
      despues: " ms",
      etiqueta: `por decisión (típica). USD ${(p.costo_latencia.costo_por_1000_decisiones_usd ?? 0).toFixed(3).replace(".", ",")} por cada 1.000.`,
      nota: `p95: ${p.costo_latencia.latencia_p95_ms} ms · ${miles(p.costo_latencia.tokens_entrada_media ?? 0)} tokens`,
    },
  ];

  const modos = MODOS.map((m) => ({ ...m, met: p[m.id] }));

  return (
    <div className="space-y-12">
      <EncabezadoPagina etiqueta="Resultados" titulo="Resultados del test">
        <p className="mt-5 text-base leading-relaxed text-fg-soft sm:text-lg">
          Una sola corrida, con JEV real, sobre {p.n} acciones que no se usaron para ajustar. Se reporta tal cual, fallos incluidos.
        </p>
      </EncabezadoPagina>

      {/* 1 · En cuatro números */}
      <section aria-labelledby="t-numeros" className="space-y-6">
        <EncabezadoSeccion id="t-numeros" etiqueta="En cuatro números" titulo={`Lo que hizo VoBo con las ${p.n} acciones.`} nota={`${comb.peligrosas} peligrosas y ${comb.autonomia.n} seguras, según las etiquetas humanas.`} />
        <Cifras cifras={cifras} />
      </section>

      {/* 2 · Por qué combinar */}
      <Revelar>
        <section aria-labelledby="t-comparar" className="space-y-6">
          <EncabezadoSeccion
            id="t-comparar"
            etiqueta="Por qué combinar"
            titulo="Por separado se escapan más de 30. Juntos, 3."
            nota="Mismas acciones, tres formas de decidir."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="hairline rounded-card bg-surface p-5">
              <h3 className="font-display text-lg text-fg">Peligrosas que pasan sin persona</h3>
              <p className="mt-0.5 text-sm text-fg-muted">Menos es mejor · de {comb.peligrosas}</p>
              <ul className="mt-5 space-y-4">
                {modos.map((m) => (
                  <Barra
                    key={m.id}
                    nombre={m.nombre}
                    nota={m.nota}
                    valor={m.met.peligrosas ? m.met.peligrosas_auto_aprobadas / m.met.peligrosas : 0}
                    texto={fraccion(m.met.peligrosas_auto_aprobadas, m.met.peligrosas)}
                    destacada={m.id === "combinado"}
                  />
                ))}
              </ul>
            </div>
            <div className="hairline rounded-card bg-surface p-5">
              <h3 className="font-display text-lg text-fg">Seguras que salen solas</h3>
              <p className="mt-0.5 text-sm text-fg-muted">Más es mejor · de {comb.autonomia.n}</p>
              <ul className="mt-5 space-y-4">
                {modos.map((m) => (
                  <Barra
                    key={m.id}
                    nombre={m.nombre}
                    nota={m.nota}
                    valor={m.met.autonomia.pct ?? 0}
                    texto={pct1(m.met.autonomia.pct)}
                    destacada={m.id === "combinado"}
                  />
                ))}
              </ul>
            </div>
          </div>
          <p className="text-sm text-fg-muted">
            Las reglas atrapan lo que se puede contar (canal, lista de bajas, horario, precio); JEV, lo que hay que leer (promesas, datos
            personales, instrucciones escondidas). Las {comb.peligrosas - comb.peligrosas_auto_aprobadas} restantes se frenaron o fueron a una persona.
          </p>
        </section>
      </Revelar>

      {/* 3 · Lectura honesta */}
      <Revelar>
        <section aria-labelledby="t-honesta" className="space-y-6">
          <EncabezadoSeccion id="t-honesta" etiqueta="Lectura honesta" titulo="Qué no salió bien y qué tan sólido es." />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                titulo: `La meta era 0: pasaron ${comb.peligrosas_auto_aprobadas}`,
                texto:
                  aprobadas.length === 0
                    ? "No hubo peligrosas aprobadas sin persona en el conjunto completo."
                    : `Textos de apariencia inocua que una persona marcó para revisión; ${aprobadasUnico} de ${aprobadas.length} los etiquetó un solo revisor. Están abajo, con su texto.`,
              },
              {
                titulo: "Banco pequeño",
                texto: `Con ${p.n} acciones, cada error mueve las métricas cerca de 0,7 puntos. Es una demostración, no estadística sólida.`,
              },
              {
                titulo: "Datos de prueba",
                texto: "El banco es sintético y la política es de demostración (supuestos), no la política real de 30X.",
              },
            ].map((c) => (
              <div key={c.titulo} className="hairline rounded-card bg-surface p-5">
                <h3 className="font-display text-lg text-fg">{c.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{c.texto}</p>
              </div>
            ))}
          </div>
        </section>
      </Revelar>

      {/* 4 · Detalle, plegado */}
      <Revelar>
        <section aria-labelledby="t-detalle" className="space-y-6">
          <EncabezadoSeccion id="t-detalle" etiqueta="Detalle" titulo="Todo lo demás, para quien quiera revisarlo." nota="Abre cada bloque." />
          <div className="space-y-3">
            <Plegable titulo="Tabla completa de métricas" resumen={`Las cinco métricas para los tres modos · ${p.n} acciones.`}>
              <TablaMetricas conjunto={p} />
            </Plegable>

            <Plegable titulo="Matriz de confusión" resumen="Lo que dijeron las personas frente a lo que decidió VoBo.">
              <p className="mb-5 text-sm text-fg-muted">Filas: etiqueta humana. Columnas: decisión de VoBo. En rojo, las peligrosas aprobadas sin persona.</p>
              <div className="flex flex-wrap gap-x-12 gap-y-8">
                <Matriz titulo={`Principal (${p.n})`} m={p.combinado} />
                <Matriz titulo={`Completo (${s.n}, con las ambiguas)`} m={s.combinado} />
              </div>
            </Plegable>

            <Plegable
              titulo="Qué aporta JEV, por familia"
              resumen={`Las reglas solas dejan pasar ${p.valor_agregado_jev.dejadas_pasar_por_reglas}; el combinado atrapa ${p.valor_agregado_jev.atrapadas_por_jev} de ellas.`}
            >
              <ValorJev c={p} />
            </Plegable>

            <Plegable titulo="Cada error, con su texto" resumen={`${erroresGraves.length} errores importantes y ${otros.length} desacuerdos menores · conjunto completo de ${s.n}.`}>
              <ListaErrores errores={erroresGraves} />
              <details className="mt-4">
                <summary className="text-sm font-medium text-fg-soft hover:text-fg">
                  Ver los otros {otros.length} desacuerdos (escaladas de más, o bloqueadas en vez de escaladas)
                </summary>
                <ListaErrores errores={otros} />
              </details>
            </Plegable>

            <Plegable titulo="Dev y umbrales" resumen="Las 250 acciones con las que se ajustó. No sirven para reportar.">
              <p className="text-sm leading-relaxed text-fg-muted">
                {dev.advertencia} Posible sobreajuste, sobre todo en redes ({tune.perfiles.normal?.filas} filas) y CRM ({tune.perfiles.laxo?.filas}).
              </p>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {[
                  { titulo: `Todo dev (${devTodo.n})`, c: devTodo },
                  { titulo: `Solo sin la propuesta de diseño (${devHum.n})`, c: devHum },
                ].map(({ titulo, c }) => (
                  <div key={titulo} className="rounded-card border border-line p-4">
                    <h3 className="text-sm font-semibold text-fg">{titulo}</h3>
                    <dl className="tabular mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div><dt className="text-xs text-fg-muted">Peligrosas aprobadas</dt><dd className="font-semibold text-fg">{fraccion(c.combinado.peligrosas_auto_aprobadas, c.combinado.peligrosas)}</dd></div>
                      <div><dt className="text-xs text-fg-muted">Autonomía</dt><dd className="font-semibold text-fg">{pct1(c.combinado.autonomia.pct)}</dd></div>
                      <div><dt className="text-xs text-fg-muted">Solo reglas dejan pasar</dt><dd className="font-semibold text-fg">{fraccion(c.solo_reglas.peligrosas_auto_aprobadas, c.solo_reglas.peligrosas)}</dd></div>
                      <div><dt className="text-xs text-fg-muted">Escaladas</dt><dd className="font-semibold text-fg">{pct1(c.combinado.escalado.pct)}</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="tabular w-full min-w-[28rem] border-collapse text-left text-sm">
                  <caption className="mb-2 text-left text-sm font-semibold text-fg">Umbrales ajustados ({UMBRALES.version})</caption>
                  <thead>
                    <tr className="border-b border-line-strong text-xs text-fg-muted">
                      <th scope="col" className="py-2 pr-3 font-medium">Perfil</th>
                      <th scope="col" className="py-2 pr-3 font-medium">T acción (actúa)</th>
                      <th scope="col" className="py-2 pr-3 font-medium">T revisión (duda)</th>
                      <th scope="col" className="py-2 font-medium">T segmento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["estricto", "normal", "laxo"] as const).map((n) => (
                      <tr key={n} className="border-b border-line">
                        <th scope="row" className="py-2 pr-3 text-left font-medium text-fg">{n}</th>
                        <td className="py-2 pr-3">{UMBRALES.perfiles[n].T_accion}</td>
                        <td className="py-2 pr-3">{UMBRALES.perfiles[n].T_revision}</td>
                        <td className="py-2">{UMBRALES.perfiles[n].T_segmento}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Plegable>

            <Plegable titulo="Cómo sabemos que el resultado es creíble" resumen="Banco ciego, etiquetas congeladas, ajuste solo con dev y una sola corrida.">
              <ul className="space-y-3 text-sm leading-relaxed text-fg-soft">
                <li>
                  <strong className="font-semibold text-fg">Banco ciego.</strong> Las 400 acciones se publicaron sin la decisión correcta. De las 150 del test, 129
                  las etiquetaron personas sin ver la propuesta de diseño; 15 siguen una decisión de política de Helian (17 oct) y 6 una corrección por criterio
                  explícito (v1.1). Del dev, 174 usan la propuesta de diseño: por eso no se usa para reportar. Acuerdo entre revisores: κ = 0,51 (moderado), sobre
                  133 filas con dos votos;{" "}
                  <a className="text-fg underline underline-offset-4 hover:text-accent" href={`${REPO}/docs/REVISION_HUMANA.md`}>REVISION_HUMANA.md</a>.
                </li>
                <li>
                  <strong className="font-semibold text-fg">Etiquetas congeladas con hash.</strong> SHA-256{" "}
                  <code className="mono text-xs text-fg">{test.etiquetas_sha256.slice(0, 16)}…</code> en{" "}
                  <a className="text-fg underline underline-offset-4 hover:text-accent" href={`${REPO}/eval/FREEZE.md`}>FREEZE.md</a>. La corrección v1.1 (7 filas) se
                  hizo antes del test y está declarada allí; JEV no se había corrido sobre el banco.
                </li>
                <li>
                  <strong className="font-semibold text-fg">Umbrales ajustados solo con dev.</strong> Después de ver el test no se reajustó nada.
                </li>
                <li>
                  <strong className="font-semibold text-fg">Corrida única.</strong> {fecha}, commit <code className="mono text-xs text-fg">{lockJson.commit.slice(0, 7)}</code>,
                  modelo <code className="mono text-xs text-fg">{test.modelos.join(", ")}</code>. El candado{" "}
                  <a className="text-fg underline underline-offset-4 hover:text-accent" href={`${REPO}/eval/runs/TEST_LOCK.json`}>TEST_LOCK.json</a> impide repetirla.
                </li>
                <li>
                  <strong className="font-semibold text-fg">JEV real, nunca simulado.</strong> Toda métrica de esta página sale de JEV real.
                  {" "}{p.costo_latencia.llamadas_ok} llamadas con respuesta y {p.costo_latencia.llamadas_fallo} fallos.
                </li>
              </ul>
            </Plegable>
          </div>
        </section>
      </Revelar>
    </div>
  );
}
