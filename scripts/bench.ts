/**
 * Corre el banco contra JEV y calcula las métricas de CLAUDE.md §9.3.
 *
 *   npm run bench -- --split dev --mode live
 *   npm run bench -- --split test --mode live --corrida-unica        (UNA sola vez; pregunta antes a Helian)
 *   npm run bench -- --split dev --mode mock --limite 20              (solo humo; el mock NUNCA produce métricas)
 *
 * El test se niega a correr si el candado eval/runs/TEST_LOCK.json ya existe (salvo --forzar "motivo").
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { accionDesdeFila } from "../src/lib/vobo/banco";
import { MODELO_POR_DEFECTO } from "../src/lib/vobo/config";
import { parseCsvConEncabezado } from "../src/lib/vobo/csv";
import { evaluarCorrida } from "../src/lib/vobo/eval/corrida";
import { parseEtiquetas } from "../src/lib/vobo/eval/etiquetas";
import { ARCHIVO_ETIQUETAS, sha256Archivo, verificarCongelacion } from "../src/lib/vobo/eval/freeze";
import { construirResultado, textoResumen } from "../src/lib/vobo/eval/resultado";
import type { FilaCorrida } from "../src/lib/vobo/eval/replay";
import { JevReal } from "../src/lib/vobo/jev/client";
import { JevMock } from "../src/lib/vobo/jev/mock";
import { PREGUNTAS } from "../src/lib/vobo/jev/questions";
import { armarState } from "../src/lib/vobo/jev/state";
import { JevError, type JevClient } from "../src/lib/vobo/jev/types";
import { UMBRALES } from "../src/lib/vobo/thresholds";

const raiz = path.resolve(__dirname, "..");

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const bandera = (nombre: string) => process.argv.includes(`--${nombre}`);

function salir(mensaje: string): never {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

const split = argumento("split");
const modoJev = argumento("mode") ?? "live";
const concurrencia = Math.min(5, Math.max(1, Number(argumento("concurrencia") ?? 5)));
const limite = argumento("limite") ? Number(argumento("limite")) : undefined;
const forzar = argumento("forzar");

if (split !== "dev" && split !== "test") salir("Falta --split dev|test.");
if (modoJev !== "live" && modoJev !== "mock") salir("--mode debe ser live o mock.");
if (split === "test" && modoJev !== "live") salir("El test solo se corre con JEV real: el mock nunca produce métricas.");
if (split === "test" && !bandera("corrida-unica")) salir("El test exige --corrida-unica (se corre una sola vez).");
if (split === "test" && limite !== undefined) salir("El test no admite --limite: se corre completo.");

const fecha = new Date().toISOString().slice(0, 16).replace(":", "-");
const rutaLock = path.join(raiz, "eval/runs/TEST_LOCK.json");

function commitActual(): { commit: string; sucio: boolean } {
  try {
    const commit = execSync("git rev-parse HEAD", { cwd: raiz }).toString().trim();
    const sucio = execSync("git status --porcelain", { cwd: raiz }).toString().trim().length > 0;
    return { commit, sucio };
  } catch {
    return { commit: "desconocido", sucio: true };
  }
}

async function main() {
  // 1. verify-freeze
  const v = verificarCongelacion(raiz);
  if (!v.ok) salir(`El hash de las etiquetas no coincide con eval/FREEZE.md (esperado ${v.esperado}, real ${v.real}). Detente y avisa.`);
  console.log(`✓ Etiquetas congeladas intactas (${v.real.slice(0, 12)}…)`);

  // 2. candado del test
  let forzado: string | null = null;
  if (split === "test") {
    if (UMBRALES.estado !== "ajustado_en_dev") {
      salir("data/thresholds.json todavía no se ajustó en dev (estado: inicial_sin_ajustar). Corre npm run tune primero.");
    }
    const git = commitActual();
    const lock = {
      fecha: new Date().toISOString(),
      modelo_pedido: process.env.JEV_MODEL || MODELO_POR_DEFECTO,
      etiquetas_sha256: v.real,
      thresholds_sha256: sha256Archivo(path.join(raiz, "data/thresholds.json")),
      commit: git.commit,
      arbol_con_cambios_sin_commitear: git.sucio,
      forzado: null as string | null,
    };
    if (existsSync(rutaLock)) {
      if (!forzar) salir("El test ya se corrió (eval/runs/TEST_LOCK.json existe). Solo se corre una vez. Con --forzar \"motivo\" queda registrado.");
      forzado = forzar;
      const previo = JSON.parse(readFileSync(rutaLock, "utf8")) as Record<string, unknown>;
      const forzados = Array.isArray(previo.forzados) ? previo.forzados : [];
      writeFileSync(rutaLock, JSON.stringify({ ...previo, forzados: [...forzados, { fecha: lock.fecha, motivo: forzar, commit: lock.commit }] }, null, 2) + "\n");
    } else {
      mkdirSync(path.dirname(rutaLock), { recursive: true });
      writeFileSync(rutaLock, JSON.stringify(lock, null, 2) + "\n", { flag: "wx" });
    }
    console.log(`✓ Candado del test ${forzado ? "(forzado: " + forzado + ")" : "creado"}: eval/runs/TEST_LOCK.json`);
  }

  // 3. datos
  const etiquetas = new Map(parseEtiquetas(readFileSync(path.join(raiz, ARCHIVO_ETIQUETAS), "utf8")).map((e) => [e.id, e]));
  let banco = parseCsvConEncabezado(readFileSync(path.join(raiz, "data/banco_acciones_v1_ciego.csv"), "utf8")).filter((f) => f.split === split);
  if (limite !== undefined) banco = banco.slice(0, limite);
  console.log(`Banco ${split}: ${banco.length} acciones · JEV ${modoJev === "live" ? "REAL" : "SIMULADO (no produce métricas)"} · concurrencia ${concurrencia}`);

  // 4. cliente
  let cliente: JevClient;
  if (modoJev === "mock") {
    cliente = new JevMock();
  } else {
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey) salir("Falta TYPESAFE_API_KEY (.env.local).");
    // El banco usa un tiempo límite más holgado que la demo (3 s): corre llamadas simultáneas.
    cliente = new JevReal({
      apiKey,
      modelo: process.env.JEV_MODEL || MODELO_POR_DEFECTO,
      tiempoLimiteMs: Number(process.env.JEV_TIMEOUT_MS) || 8000,
    });
  }

  // 5. llamadas, máximo `concurrencia` a la vez
  const filas = new Map<string, FilaCorrida>();
  let hechas = 0;
  const cola = [...banco];
  async function trabajador() {
    for (let f = cola.shift(); f; f = cola.shift()) {
      const id = f.id as string;
      const inicio = Date.now();
      try {
        const r = await cliente.consultar(armarState(accionDesdeFila(f)), PREGUNTAS);
        filas.set(id, { id, respuesta: { model: r.model, answers: r.answers, usage: r.usage }, error: null, latencia_ms: r.latencia_ms, llamadas: r.llamadas });
      } catch (e) {
        const codigo = e instanceof JevError ? e.codigo : "desconocido";
        filas.set(id, { id, respuesta: null, error: codigo, latencia_ms: Date.now() - inicio, llamadas: 1 });
      }
      if (++hechas % 25 === 0 || hechas === banco.length) console.log(`  ${hechas}/${banco.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrencia }, trabajador));

  const modelos = [...new Set([...filas.values()].flatMap((f) => (f.respuesta ? [f.respuesta.model] : [])))];
  const fallos = [...filas.values()].filter((f) => !f.respuesta);
  console.log(`Respondieron ${filas.size - fallos.length}/${filas.size}${fallos.length ? ` · fallos: ${[...new Set(fallos.map((f) => f.error))].join(", ")}` : ""}`);

  // 6. se guarda la corrida con las respuestas crudas
  mkdirSync(path.join(raiz, "eval/runs"), { recursive: true });
  const rutaCorrida = `eval/runs/${fecha}_${split}_${modoJev}.json`;
  writeFileSync(
    path.join(raiz, rutaCorrida),
    JSON.stringify({ fecha: new Date().toISOString(), split, modo_jev: modoJev, modelos, filas: banco.map((f) => filas.get(f.id as string)) }) + "\n",
  );
  console.log(`✓ Respuestas crudas guardadas en ${rutaCorrida}`);

  if (modoJev === "mock") {
    console.log("\n⚠ Corrida con JEV SIMULADO: es solo una prueba de humo; no se calculan ni se guardan métricas.");
    return;
  }

  // 7. métricas
  const { casos } = await evaluarCorrida({ banco, etiquetas, filas, umbrales: UMBRALES });
  const resultado = construirResultado(casos, {
    split: split as "dev" | "test",
    modelos,
    etiquetas_sha256: v.real,
    umbrales: { version: UMBRALES.version, estado: UMBRALES.estado, fecha: UMBRALES.fecha },
    corrida: rutaCorrida,
    forzado,
  });
  mkdirSync(path.join(raiz, "eval/results"), { recursive: true });
  writeFileSync(path.join(raiz, `eval/results/${split}.json`), JSON.stringify(resultado, null, 2) + "\n");
  console.log(`✓ Resumen en eval/results/${split}.json\n`);
  console.log(textoResumen(resultado.conjuntos));
}

main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
