/**
 * Recalcula el SHA-256 de data/etiquetas_v1.csv y lo compara con el vigente de eval/FREEZE.md.
 * Aborta (código 1) si no coincide: cualquier cambio a las etiquetas invalida la corrida del test.
 *
 *   npm run verify-freeze
 */
import path from "node:path";
import { verificarCongelacion } from "../src/lib/vobo/eval/freeze";

const v = verificarCongelacion(path.resolve(__dirname, ".."));
if (!v.ok) {
  console.error("✗ El hash de las etiquetas NO coincide con eval/FREEZE.md.");
  console.error(`  esperado: ${v.esperado ?? "(no se encontró «SHA-256 vigente» en FREEZE.md)"}`);
  console.error(`  real:     ${v.real}`);
  console.error("  Detente y avisa: las etiquetas congeladas no se editan.");
  process.exit(1);
}
console.log(`✓ Etiquetas congeladas intactas (SHA-256 ${v.real.slice(0, 16)}…).`);
