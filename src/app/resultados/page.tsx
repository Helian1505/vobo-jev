import type { Metadata } from "next";
import { Insignia } from "@/components/ResultadoPanel";
import { proporcion, type ErrorCaso, type MetricasModo, type ResumenConjunto } from "@/lib/vobo/eval/metricas";
import type { ResultadoBanco } from "@/lib/vobo/eval/resultado";
import { UMBRALES } from "@/lib/vobo/thresholds";
import type { Decision } from "@/lib/vobo/types";
import { miles, pct1, usd } from "@/lib/vobo/ui-datos";
import devJson from "../../../eval/results/dev.json";
import tuneJson from "../../../eval/results/tune_dev.json";
import testJson from "../../../eval/results/test.json";
import lockJson from "../../../eval/runs/TEST_LOCK.json";
import { EncabezadoPagina } from "@/components/EncabezadoPagina";

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

function Seccion({ id, titulo, children, intro }: { id: string; titulo: string; children: React.ReactNode; intro?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-8">
      <h2 id={id} className="display-sans text-2xl font-semibold text-fg">
        {titulo}
      </h2>
      {intro && <div className="mt-2 max-w-3xl text-sm leading-relaxed text-fg-muted">{intro}</div>}
      <div className="mt-5">{children}</div>
    </section>
  );
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

  return (
    <div className="space-y-10">
      <EncabezadoPagina etiqueta="Resultados" titulo="Resultados del banco">
        <p className="mt-5 text-base leading-relaxed text-fg-soft sm:text-lg">
          400 acciones sintéticas, con etiquetas de revisión humana y de decisiones de política (el detalle está en «Cómo sabemos que el resultado es creíble», abajo), partidas en 250 para ajustar (dev) y 150 para medir (test). El test se corrió{" "}
          <strong className="font-semibold text-fg">una sola vez</strong>, con JEV real, y se reporta tal cual, fallos incluidos.
        </p>
      </EncabezadoPagina>

      <section aria-labelledby="lectura" className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 id="lectura" className="display-sans text-xl font-semibold text-fg">
          Lectura honesta
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-fg-soft marker:text-fg-muted">
          <li>
            <strong className="font-semibold text-fg">La meta era 0 peligrosas aprobadas sin persona y no se cumplió:</strong> el combinado dejó pasar{" "}
            {fraccion(comb.peligrosas_auto_aprobadas, comb.peligrosas)} en el conjunto principal ({ic(proporcion(comb.peligrosas_auto_aprobadas, comb.peligrosas))}).
          </li>
          <li>
            {aprobadas.length === 0
              ? "No hubo peligrosas aprobadas sin persona en el conjunto completo."
              : `Los ${aprobadas.length} casos del conjunto completo son textos de apariencia inocua que una persona etiquetó «PEDIR VOBO»; ${aprobadasUnico} de ellos los etiquetó un solo revisor.`}{" "}
            No afirmamos que esas etiquetas estén mal: lo dejamos a la vista para que lo juzgues.
          </li>
          <li>
            Con {p.n} acciones, cada error mueve las métricas cerca de 0,7 puntos. Es una demostración, no estadística sólida. La exactitud de
            la capa de reglas es una prueba unitaria; la evidencia real es lo que aporta JEV.
          </li>
          <li>El banco es sintético y la política es de demostración (supuestos), no la política real de 30X.</li>
        </ul>
      </section>

      <Seccion
        id="principal"
        titulo={`Test · conjunto principal (${p.n} acciones)`}
        intro={
          <>
            Las 150 acciones del test sin las 5 que no tienen mayoría humana (<code className="font-mono text-xs">ambigua = SI</code>). De las {p.n}, {p.combinado.peligrosas} son
            peligrosas (etiqueta PEDIR VOBO o BLOQUEAR) y {p.combinado.autonomia.n} seguras.
          </>
        }
      >
        <TablaMetricas conjunto={p} />
      </Seccion>

      <Seccion
        id="confusion"
        titulo="Matriz de confusión del combinado"
        intro={<>Filas: lo que dijeron las personas. Columnas: lo que decidió VoBo. En rojo, las peligrosas que se aprobaron sin persona.</>}
      >
        <div className="flex flex-wrap gap-x-12 gap-y-8">
          <Matriz titulo={`Principal (${p.n})`} m={p.combinado} />
          <Matriz titulo={`Completo (${s.n}, con las ambiguas)`} m={s.combinado} />
        </div>
      </Seccion>

      <Seccion id="jev" titulo="Qué aporta JEV" intro={<>Las peligrosas del conjunto principal que las reglas solas dejan pasar y el combinado atrapa, por familia de acción del banco.</>}>
        <ValorJev c={p} />
      </Seccion>

      <Seccion
        id="errores"
        titulo="Cada error, con su texto"
        intro={<>Conjunto completo de {s.n} acciones. Primero los que importan; abajo, los desacuerdos menores.</>}
      >
        <ListaErrores errores={erroresGraves} />
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-fg-soft hover:text-fg">
            Otros {otros.length} desacuerdos: acciones escaladas de más a una persona o bloqueadas en vez de escaladas
          </summary>
          <ListaErrores errores={otros} />
        </details>
      </Seccion>

      <Seccion id="costo" titulo="Costo y latencia">
        <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-4 rounded-card border border-line bg-surface p-5 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-fg-muted">Costo por 1.000 decisiones</dt><dd className="mt-0.5 text-base font-semibold text-fg">{usd(p.costo_latencia.costo_por_1000_decisiones_usd ?? 0)}</dd></div>
          <div><dt className="text-xs text-fg-muted">Latencia p50</dt><dd className="mt-0.5 text-base font-semibold text-fg">{p.costo_latencia.latencia_p50_ms} ms</dd></div>
          <div><dt className="text-xs text-fg-muted">Latencia p95</dt><dd className="mt-0.5 text-base font-semibold text-fg">{p.costo_latencia.latencia_p95_ms} ms</dd></div>
          <div><dt className="text-xs text-fg-muted">Tokens de entrada por decisión</dt><dd className="mt-0.5 text-base font-semibold text-fg">{miles(p.costo_latencia.tokens_entrada_media ?? 0)}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-fg-muted">
          {p.costo_latencia.llamadas_ok} llamadas con respuesta y {p.costo_latencia.llamadas_fallo} fallos. Una sola llamada a JEV responde las 7 preguntas.
        </p>
      </Seccion>

      <Seccion
        id="dev"
        titulo="Dev · solo para ajustar, no para reportar"
        intro={
          <>
            Con estas 250 acciones se ajustaron los umbrales. {dev.advertencia} Los umbrales se ajustaron sobre estas mismas filas, así que hay
            sobreajuste posible, sobre todo en redes ({tune.perfiles.normal?.filas} filas) y CRM ({tune.perfiles.laxo?.filas}).
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {[
            { titulo: `Todo dev (${devTodo.n})`, c: devTodo },
            { titulo: `Solo sin la propuesta de diseño (${devHum.n})`, c: devHum },
          ].map(({ titulo, c }) => (
            <div key={titulo} className="rounded-card border border-line bg-surface p-5">
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
        <div className="mt-6 overflow-x-auto">
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
      </Seccion>

      <Seccion
        id="integridad"
        titulo="Cómo sabemos que el resultado es creíble"
        intro={<>Estas reglas son el diferencial del proyecto; cada una se puede comprobar en el repo.</>}
      >
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-fg-soft marker:text-fg-muted">
          <li>
            <strong className="font-semibold text-fg">Banco ciego.</strong> Las 400 acciones se publicaron sin la decisión correcta. De las 150 del test, 129 las
            etiquetaron personas del equipo sin ver la propuesta de diseño; 15 siguen una decisión de política de Helian (17 oct) y 6 una corrección por criterio explícito
            (v1.1, declarada en{" "}
            <a className="text-fg underline underline-offset-4 hover:text-accent" href={`${REPO}/eval/FREEZE.md`}>FREEZE.md</a>). Del dev, 74 son etiquetas humanas, 1 sigue una
            decisión de política y 1 una corrección v1.1; las otras 174 usan la propuesta de diseño, por eso el dev no se usa para reportar. El acuerdo entre revisores
            (κ = 0,51, moderado) se calculó solo sobre las 133 filas obligatorias con dos votos (oro y test), con el piso de reglas aplicado; ver{" "}
            <a className="text-fg underline underline-offset-4 hover:text-accent" href={`${REPO}/docs/REVISION_HUMANA.md`}>REVISION_HUMANA.md</a>.
          </li>
          <li>
            <strong className="font-semibold text-fg">Etiquetas congeladas con hash.</strong> SHA-256{" "}
            <code className="font-mono text-xs text-fg">{test.etiquetas_sha256.slice(0, 16)}…</code>, anotado en{" "}
            <a className="text-fg underline underline-offset-4 hover:text-accent" href={`${REPO}/eval/FREEZE.md`}>FREEZE.md</a>. Antes del test hubo una corrección (v1.1) de 7 filas,
            declarada allí con su sesgo; JEV no se había corrido sobre el banco.
          </li>
          <li>
            <strong className="font-semibold text-fg">Umbrales ajustados solo con dev.</strong> Después de ver el test no se reajustó nada.
          </li>
          <li>
            <strong className="font-semibold text-fg">Corrida única del test.</strong> {fecha}, commit <code className="font-mono text-xs text-fg">{lockJson.commit.slice(0, 7)}</code>, modelo{" "}
            <code className="font-mono text-xs text-fg">{test.modelos.join(", ")}</code>. El candado{" "}
            <a className="text-fg underline underline-offset-4 hover:text-accent" href={`${REPO}/eval/runs/TEST_LOCK.json`}>TEST_LOCK.json</a> impide repetirla.
          </li>
          <li>
            <strong className="font-semibold text-fg">JEV real, nunca simulado.</strong> Toda métrica de esta página sale de JEV real; el JEV simulado solo se usa en pruebas y en la demo sin red.
          </li>
        </ul>
      </Seccion>
    </div>
  );
}
