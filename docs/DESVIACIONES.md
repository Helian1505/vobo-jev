# Desviaciones respecto a CLAUDE.md

Aquí se anota todo lo que la realidad cambió frente al instructivo, con fecha y motivo.

| Fecha | Qué | Motivo |
|---|---|---|
| 17 oct 2026 | F0 sin ESLint (`eslint` y `eslint-config-next` no se instalaron). | Next 16 ya no trae `next lint`; el control de calidad es `tsc --noEmit` (estricto) y Vitest. Se puede agregar después si hace falta. |
| 17 oct 2026 | Config de Vitest en `vitest.config.mts` (no `.ts`). | Evita el aviso de Vite sobre módulos ESM cargados como CommonJS. |
| 17 oct 2026 | Versiones: Next 16.4, React 19.3, Tailwind 4.3, Vitest 5, TypeScript 7. | Son las últimas estables que instaló npm; CLAUDE.md no fija versiones. |
