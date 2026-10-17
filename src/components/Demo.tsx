"use client";

import { useCallback, useEffect, useState } from "react";
import { ResultadoPanel } from "@/components/ResultadoPanel";
import type { Evaluacion } from "@/lib/vobo/evaluate";
import type { Perfil } from "@/lib/vobo/perfiles-datos";
import {
  CAMPOS_CRM_SUGERIDOS,
  CANALES_SUGERIDOS,
  FORM_VACIO,
  SEGMENTOS,
  TIPOS_ACCION,
  cuerpoDesdeEstado,
  estadoDesdeAccion,
  miles,
  pct,
  type FormEstado,
} from "@/lib/vobo/ui-datos";

export interface EjemploDemo {
  id: string;
  titulo: string;
  intencion: string;
  por_que: string;
  accion: Record<string, unknown>;
}

export interface AudienciaResumen {
  id: string;
  nombre: string;
  perfiles_en_muestra: number;
  destinatarios_estimados: number;
  pct_afinidad_baja: number;
}

interface Props {
  ejemplos: EjemploDemo[];
  audiencias: AudienciaResumen[];
  idsDeals: string[];
  programas: string[];
}

interface EstadoJevUi {
  modo: "mock" | "live";
  configurado: boolean;
  modelo: string;
}

const MAX_TEXTO = 2000;

const claseCampo =
  "mt-1 w-full rounded border border-slate-400 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/30";

function Campo({ etiqueta, ayuda, children, id }: { etiqueta: string; ayuda?: string; children: React.ReactNode; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-900">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-slate-700">{ayuda}</p>}
    </div>
  );
}

function TarjetaPerfil({ p }: { p: Perfil }) {
  const filas: [string, string][] = [
    ["Estado", p.estado],
    ["Etapa del CRM", p.etapa_crm],
    ["Programa", p.programa],
    ["Programa sugerido", p.programa_sugerido],
    ["Afinidad", `${p.afinidad} · ${p.banda_afinidad}`],
    ["Temas de interés", p.temas_interes],
  ];
  return (
    <div className="rounded border border-slate-300 bg-slate-50 p-3 text-sm">
      <p className="font-semibold">
        Perfil {p.id} <span className="font-normal text-slate-700">· muestra anónima de 30X, solo categorías</span>
      </p>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {filas.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-slate-600">{k}</dt>
            <dd>{v && v !== "—" ? v : "Sin dato"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Demo({ ejemplos, audiencias, idsDeals, programas }: Props) {
  const [form, setForm] = useState<FormEstado>(FORM_VACIO);
  const [ejemploId, setEjemploId] = useState("");
  const [resultado, setResultado] = useState<Evaluacion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [jev, setJev] = useState<EstadoJevUi | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const ejemplo = ejemplos.find((e) => e.id === ejemploId);
  const audiencia = audiencias.find((a) => a.id === form.audiencia_id);
  const esMasivo = form.tipo_accion === "correo_masivo" || form.tipo_accion === "whatsapp_masivo";
  const esCrm = form.tipo_accion === "crm_update";
  const esRedes = form.tipo_accion === "publicacion_redes";

  useEffect(() => {
    fetch("/api/evaluate")
      .then((r) => r.json())
      .then(setJev)
      .catch(() => setJev(null));
  }, []);

  // La tarjeta de perfil sigue al perfil_id escrito.
  useEffect(() => {
    if (!/^P-\d{1,5}$/.test(form.perfil_id)) {
      setPerfil(null);
      return;
    }
    let vigente = true;
    fetch(`/api/perfil?id=${encodeURIComponent(form.perfil_id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => vigente && setPerfil(p))
      .catch(() => vigente && setPerfil(null));
    return () => {
      vigente = false;
    };
  }, [form.perfil_id]);

  const evaluar = useCallback(async (estado: FormEstado) => {
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpoDesdeEstado(estado)),
      });
      const cuerpo = await res.json();
      if (!res.ok) {
        const detalles: string[] = cuerpo.detalles ?? [];
        setResultado(null);
        setError([cuerpo.error ?? "No se pudo evaluar la acción.", ...detalles].join(" "));
      } else {
        setResultado(cuerpo as Evaluacion);
      }
    } catch {
      setResultado(null);
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }, []);

  /** Cualquier edición del formulario desliga el ejemplo y deja de mostrar su intención. */
  const cambiar = (parche: Partial<FormEstado>) => {
    setForm((f) => ({ ...f, ...parche }));
    setEjemploId("");
  };

  const elegirEjemplo = (id: string) => {
    setEjemploId(id);
    const e = ejemplos.find((x) => x.id === id);
    if (!e) return;
    const estado = estadoDesdeAccion(e.accion);
    setForm(estado);
    void evaluar(estado);
  };

  const elegirAudiencia = (id: string) => {
    const a = audiencias.find((x) => x.id === id);
    cambiar(a ? { audiencia_id: a.id, destinatarios: String(a.destinatarios_estimados) } : { audiencia_id: "" });
  };

  const textoRestante = MAX_TEXTO - form.texto.length;

  return (
    <div className="space-y-6">
      {jev && jev.modo === "live" && !jev.configurado && (
        <p role="alert" className="rounded border-2 border-red-700 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
          JEV real no configurado: falta la llave en el servidor. Las evaluaciones no funcionarán hasta configurarla.
        </p>
      )}
      {jev && jev.modo === "mock" && (
        <p className="rounded border border-slate-500 bg-slate-100 px-3 py-2 text-sm text-slate-900">
          <strong>JEV SIMULADO.</strong> Esta demo usa un JEV simulado con reglas de palabras clave. Sus resultados no son
          métricas del modelo real.
        </p>
      )}

      <div className="rounded border border-slate-300 bg-white p-4">
        <label htmlFor="ejemplo" className="block text-sm font-semibold">
          Ejemplos de la demo
        </label>
        <select id="ejemplo" value={ejemploId} onChange={(e) => elegirEjemplo(e.target.value)} className={claseCampo}>
          <option value="">Elige un ejemplo o escribe tu propia acción…</option>
          {ejemplos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.id} · {e.titulo}
            </option>
          ))}
        </select>
        {ejemplo && <p className="mt-2 text-sm text-slate-800">{ejemplo.por_que}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <form
          className="space-y-4 rounded border border-slate-300 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void evaluar(form);
          }}
        >
          <h2 className="text-base font-semibold">Acción que propone el agente</h2>

          <Campo id="tipo" etiqueta="Tipo de acción">
            <select
              id="tipo"
              value={form.tipo_accion}
              onChange={(e) => cambiar({ tipo_accion: e.target.value })}
              className={claseCampo}
            >
              {TIPOS_ACCION.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </Campo>

          <Campo id="canal" etiqueta="Canal" ayuda="Los canales oficiales son correo_oficial, whatsapp_oficial, instagram_oficial, linkedin_oficial y crm.">
            <input
              id="canal"
              list="lista-canales"
              value={form.canal}
              onChange={(e) => cambiar({ canal: e.target.value })}
              className={claseCampo}
              required
            />
            <datalist id="lista-canales">
              {CANALES_SUGERIDOS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Campo>

          {esMasivo && (
            <Campo id="programa" etiqueta="Programa ofrecido (opcional)">
              <select
                id="programa"
                value={form.programa_ofrecido}
                onChange={(e) => cambiar({ programa_ofrecido: e.target.value })}
                className={claseCampo}
              >
                <option value="">Ninguno</option>
                {programas.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          {!esRedes && (
            <Campo id="audiencia" etiqueta="Audiencia armada desde los perfiles (opcional)">
              <select
                id="audiencia"
                value={form.audiencia_id}
                onChange={(e) => elegirAudiencia(e.target.value)}
                className={claseCampo}
              >
                <option value="">Sin audiencia: escribo los destinatarios</option>
                {audiencias.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.nombre}
                  </option>
                ))}
              </select>
              {audiencia && (
                <p className="mt-1 text-xs text-slate-800">
                  {audiencia.perfiles_en_muestra} perfiles en la muestra · ≈ {miles(audiencia.destinatarios_estimados)} personas
                  en la base · {pct(audiencia.pct_afinidad_baja)} con afinidad baja
                </p>
              )}
            </Campo>
          )}

          {esCrm && (
            <>
              <Campo id="perfil" etiqueta="Perfil del deal (opcional)" ayuda="Escribe un id como P-298 o elige de la lista.">
                <input
                  id="perfil"
                  list="lista-perfiles"
                  value={form.perfil_id}
                  onChange={(e) => cambiar({ perfil_id: e.target.value.trim(), ...( /^P-\d+$/.test(e.target.value.trim()) ? { destinatarios: "1" } : {}) })}
                  className={claseCampo}
                  placeholder="P-298"
                />
                <datalist id="lista-perfiles">
                  {idsDeals.map((id) => (
                    <option key={id} value={id} />
                  ))}
                </datalist>
              </Campo>
              {perfil && <TarjetaPerfil p={perfil} />}
              <Campo id="campo_crm" etiqueta="Campo del CRM que se cambia">
                <input
                  id="campo_crm"
                  list="lista-campos"
                  value={form.campo_crm}
                  onChange={(e) => cambiar({ campo_crm: e.target.value })}
                  className={claseCampo}
                />
                <datalist id="lista-campos">
                  {CAMPOS_CRM_SUGERIDOS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Campo>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {!esRedes && (
              <Campo id="destinatarios" etiqueta={esCrm ? "Contactos afectados" : "Destinatarios"}>
                <input
                  id="destinatarios"
                  type="number"
                  min={0}
                  value={form.destinatarios}
                  onChange={(e) => cambiar({ destinatarios: e.target.value, audiencia_id: "" })}
                  className={claseCampo}
                />
              </Campo>
            )}
            <Campo id="segmento" etiqueta="Segmento declarado">
              <select
                id="segmento"
                value={form.segmento_declarado}
                onChange={(e) => cambiar({ segmento_declarado: e.target.value })}
                className={claseCampo}
              >
                {SEGMENTOS.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="hora" etiqueta="Hora de envío (Bogotá)">
              <input
                id="hora"
                type="time"
                value={form.hora_envio}
                onChange={(e) => cambiar({ hora_envio: e.target.value })}
                className={claseCampo}
                required
              />
            </Campo>
            {esMasivo && (
              <Campo id="bajas" etiqueta="Destinatarios en la lista de bajas">
                <input
                  id="bajas"
                  type="number"
                  min={0}
                  value={form.en_lista_de_bajas}
                  onChange={(e) => cambiar({ en_lista_de_bajas: e.target.value })}
                  className={claseCampo}
                />
              </Campo>
            )}
          </div>

          {!esCrm && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo id="fecha_real" etiqueta="Fecha real del evento">
                <input
                  id="fecha_real"
                  type="date"
                  value={form.fecha_evento_real}
                  onChange={(e) => cambiar({ fecha_evento_real: e.target.value })}
                  className={claseCampo}
                />
              </Campo>
              <Campo id="fecha_texto" etiqueta="Fecha escrita en el texto">
                <input
                  id="fecha_texto"
                  value={form.fecha_en_texto}
                  onChange={(e) => cambiar({ fecha_en_texto: e.target.value })}
                  className={claseCampo}
                  placeholder="12 de noviembre"
                />
              </Campo>
              <Campo id="precio" etiqueta="Precio en el texto (USD)">
                <input
                  id="precio"
                  type="number"
                  min={0}
                  value={form.precio_en_texto_usd}
                  onChange={(e) => cambiar({ precio_en_texto_usd: e.target.value })}
                  className={claseCampo}
                />
              </Campo>
            </div>
          )}

          <Campo id="texto" etiqueta={esCrm ? "Valor que se escribe" : "Texto del mensaje o la publicación"}>
            <textarea
              id="texto"
              rows={6}
              maxLength={MAX_TEXTO}
              value={form.texto}
              onChange={(e) => cambiar({ texto: e.target.value })}
              className={claseCampo}
            />
            <p className={`mt-1 text-xs ${textoRestante < 100 ? "text-red-800" : "text-slate-700"}`}>
              {miles(textoRestante)} caracteres restantes
            </p>
          </Campo>

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {cargando ? "Evaluando…" : "Evaluar acción"}
          </button>
        </form>

        <div className="rounded border border-slate-300 bg-slate-50 p-4">
          {error && (
            <p role="alert" className="rounded border-2 border-red-700 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
              {error}
            </p>
          )}
          {!error && !resultado && (
            <p className="text-sm text-slate-700">
              {cargando
                ? "Evaluando…"
                : "Elige un ejemplo o completa el formulario y pulsa «Evaluar acción». VoBo responde PERMITIR, PEDIR VOBO o BLOQUEAR, con el porqué."}
            </p>
          )}
          {resultado && !error && (
            <div className={cargando ? "opacity-50" : undefined}>
              <ResultadoPanel evaluacion={resultado} intencion={ejemplo?.intencion} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
