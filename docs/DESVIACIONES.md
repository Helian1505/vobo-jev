# Desviaciones respecto a CLAUDE.md

Aquí se anota todo lo que la realidad cambió frente al instructivo, con fecha y motivo.

| Fecha | Qué | Motivo |
|---|---|---|
| 17 oct 2026 | F0 sin ESLint (`eslint` y `eslint-config-next` no se instalaron). | Next 16 ya no trae `next lint`; el control de calidad es `tsc --noEmit` (estricto) y Vitest. Se puede agregar después si hace falta. |
| 17 oct 2026 | Config de Vitest en `vitest.config.mts` (no `.ts`). | Evita el aviso de Vite sobre módulos ESM cargados como CommonJS. |
| 17 oct 2026 | Versiones: Next 16.4, React 19.3, Tailwind 4.3, Vitest 5, TypeScript 7. | Son las últimas estables que instaló npm; CLAUDE.md no fija versiones. |
| 17 oct 2026 | Llamada real de humo (1 llamada, `jev-1.14.0`, 7 preguntas, 1.532 tokens de entrada): tardó **6,1 s**, no 70–500 ms. La forma de la respuesta sí coincide con CLAUDE.md §6.1; `legend` y `probabilities` del score empiezan en **0**; `score` es un número decimal (valor esperado, 1,85). Costo de la llamada: USD 0,000064 (≈ USD 0,064 por 1.000 decisiones). | Con el tiempo límite de 3 s (§6.6) todas las llamadas reales caerían a "fallo" y pasarían a VoBo humano. **Pendiente de decisión de Helian:** medir la latencia con unas pocas llamadas más y subir el tiempo límite, o partir las 7 preguntas en llamadas paralelas más cortas. |
| 17 oct 2026 | Medición de latencia con 5 llamadas reales más, secuenciales, textos distintos (`scripts/latencia-jev.ts`): **289, 301, 309, 318 y 655 ms** (mediana 309 ms). Los tokens de salida fueron los mismos en todas (298–303), así que la latencia no depende del texto. Por tanto, los 6,1 s de la primera llamada parecen un arranque en frío aislado (1 de 6 llamadas). | Con esta evidencia no hace falta partir las preguntas en llamadas paralelas. Se propone dejar el tiempo límite de 3 s (el reintento ya cubre un arranque en frío) y hacerlo configurable por variable de entorno para el banco. Pendiente de aprobación de Helian. |
