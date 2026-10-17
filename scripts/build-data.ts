/**
 * Convierte data/perfiles_30x.csv en src/generated/perfiles.json para no depender de fs en Vercel
 * (CLAUDE.md §15). El archivo generado se versiona; tests/perfiles.test.ts verifica que esté al día.
 *
 *   npm run build-data
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCsvConEncabezado } from "../src/lib/vobo/csv";
import { accionDesdeFila } from "../src/lib/vobo/banco";
import { muestraSimulacion } from "../src/lib/vobo/simulacion-datos";
import { perfilesDesdeFilas } from "../src/lib/vobo/perfiles-datos";

const raiz = path.resolve(__dirname, "..");
const filas = parseCsvConEncabezado(readFileSync(path.join(raiz, "data/perfiles_30x.csv"), "utf8"));
const perfiles = perfilesDesdeFilas(filas);

const salida = path.join(raiz, "src/generated/perfiles.json");
mkdirSync(path.dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify(perfiles) + "\n", "utf8");
console.log(`${perfiles.length} perfiles → src/generated/perfiles.json`);

// Muestra del banco para /simulacion: acciones del split dev (nunca del test), sin etiquetas.
const banco = parseCsvConEncabezado(readFileSync(path.join(raiz, "data/banco_acciones_v1_ciego.csv"), "utf8"));
const simulacion = muestraSimulacion(banco).map(accionDesdeFila);
writeFileSync(path.join(raiz, "src/generated/simulacion.json"), JSON.stringify(simulacion) + "\n", "utf8");
console.log(`${simulacion.length} acciones → src/generated/simulacion.json`);
