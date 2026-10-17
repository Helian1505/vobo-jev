/**
 * Convierte data/perfiles_30x.csv en src/generated/perfiles.json para no depender de fs en Vercel
 * (CLAUDE.md §15). El archivo generado se versiona; tests/perfiles.test.ts verifica que esté al día.
 *
 *   npm run build-data
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCsvConEncabezado } from "../src/lib/vobo/csv";
import { perfilesDesdeFilas } from "../src/lib/vobo/perfiles-datos";

const raiz = path.resolve(__dirname, "..");
const filas = parseCsvConEncabezado(readFileSync(path.join(raiz, "data/perfiles_30x.csv"), "utf8"));
const perfiles = perfilesDesdeFilas(filas);

const salida = path.join(raiz, "src/generated/perfiles.json");
mkdirSync(path.dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify(perfiles) + "\n", "utf8");
console.log(`${perfiles.length} perfiles → src/generated/perfiles.json`);
