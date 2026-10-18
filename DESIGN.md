# DESIGN.md — Rediseño de la interfaz de VoBo (v3, sáb 17 oct 2026, 11:15 p.m.)

> **Para Helian.** Este archivo es la referencia del diseño que ya está construido en la rama `rediseno-ui`. **No hay que replicarlo a mano.** Se aplica fusionando la rama, que ya tiene todo el código (sección 1). El resto del documento sirve para entender qué cambió y para mantenerlo igual en cualquier ajuste.
>
> Autor: Claude (sesión de Juan), con Juan David Cano. Aprobado por Juan en la vista previa de la rama.

---

## 1. Cómo aplicarlo a la página que está en línea

**Recomendado: fusionar la rama.** Copiarlo a mano tomaría horas y abriría errores. La rama ya compila en Vercel y no toca la lógica.

1. Abre el pull request `rediseno-ui → main` en GitHub.
2. En tu Claude Code, en el repo:
   ```bash
   git fetch origin && git switch rediseno-ui && git pull
   npm ci                  # instala dependencias
   npm test                # pruebas (paridad de reglas, ejemplos, perfiles, etc.)
   npm run typecheck       # tipos
   npm run build           # compilación de producción
   npm run verify-freeze   # el hash de las etiquetas debe coincidir
   ```
3. Si todo pasa, fusiona el pull request. Vercel publica `main` en `https://vobo-jev.vercel.app`.
4. Comprueba en la URL de producción: inicio, `/demo` (evalúa E09, debe dar BLOQUEAR), `/simulacion`, `/cola`, `/resultados` e `/integracion`. El pie de la demo debe decir `jev-1.14.0` y no «JEV SIMULADO».
5. **Si algo falla después de fusionar**, revierte el merge desde GitHub (botón *Revert*) y la página vuelve a la versión anterior.

**Qué NO cambia la rama:** `src/lib/` (reglas, JEV, combinador, explicación), `src/app/api/`, `data/`, `eval/`, `tests/`, `referencia/`, `integraciones/`, README ni `docs/` (salvo `docs/DESVIACIONES.md`, una fila). Las cifras que muestra salen de `eval/results/test.json`, sin recalcular nada.

---

## 2. Idea del diseño

- **Estructura de Linear** (precisión, líneas finas, poco ruido) **con la marca de 30X** (negro, grises cálidos, Inter Display y el **lima como único acento**).
- **Una idea por pantalla.** Primero el resumen y luego el detalle, plegado.
- **Movimiento con propósito:** las cosas aparecen una vez, con un difuminado suave, y se quedan quietas. Quien tenga activado «reducir movimiento» ve todo quieto.
- **Honestidad visible:** la meta de 0 que no se cumplió, los límites y lo que no está construido se muestran, no se esconden.

---

## 3. Tokens (todo vive en `src/app/globals.css`, bloque `@theme`)

Los componentes usan **solo los nombres semánticos**. Para cambiar un color se cambia en un solo lugar.

### 3.1 Color

| Semántico | Valor | Uso |
|---|---|---|
| `canvas` | `#000000` | Fondo de la página |
| `surface` | `#0a0a0a` | Tarjetas y paneles |
| `field` | `#111111` | Campos y estado *hover* de tarjetas |
| `raised` | `#1a1a1a` | Fondo de barras y celdas destacadas |
| `line` / `line-strong` | `#232323` / `#383838` | Bordes finos (1 px) |
| `fg` | `#f7f5f2` | Texto principal |
| `fg-soft` | `#d4d4d4` | Texto de lectura |
| `fg-muted` | `#a39e93` | Texto secundario |
| `fg-faint` | `#868073` | Etiquetas, metadatos y figuras del fondo (gris cálido de 30X) |
| `accent` | `#e9ff7b` | **Lima de 30X: único acento** (botón principal, VoBo, subrayado del menú) |
| `allow` / `review` / `block` | `#7ee787` / `#f2cc60` / `#ffa198` | Solo para las decisiones PERMITIR / PEDIR VOBO / BLOQUEAR |

### 3.2 Tipografía (igual en todas las páginas)

Fuente: **Inter** auto-alojada (`src/app/fonts/`), con su corte Display por tamaño óptico. Para datos técnicos se usa mono (ids, `request_id`, modelo, latencia).

| Elemento | Clases | Tamaño |
|---|---|---|
| Titular de página (`h1`) | `font-display text-4xl sm:text-5xl` | 36 → 48 px |
| Titular del inicio | `font-display`, `clamp(2.75rem, min(4.6vw, 8.2vh), 4.25rem)` | Se encoge con la ventana para que el primer bloque quepa |
| Etiqueta sobre titulares | `text-xs uppercase tracking-wider text-fg-faint` | 12 px |
| Titular de sección (`h2`) | `font-display text-2xl sm:text-3xl` | 24 → 30 px |
| Título de tarjeta (`h3`) | `font-display text-lg` | 18 px |
| Texto de entrada de página | `text-base sm:text-lg text-fg-soft` | 16 → 18 px |
| Texto de tarjeta | `text-sm text-fg-muted` | 14 px |
| Metadatos | `mono text-[11px] text-fg-faint` | 11 px |

`.font-display` = peso 600, tracking −0,04 em. **Nunca 700.**

### 3.3 Forma y espacio
- Radios: `rounded-field` 6 px (botones, campos), `rounded-card` 12 px (tarjetas), `rounded-full` (insignias).
- Elevación por borde, no por sombra: clase `.hairline` (borde interior de 1 px). La única sombra es `.sombra-flotante` (panel de resultado de la demo).
- Ancho máximo 1200 px; márgenes de 16 a 24 px.
- Espacio entre secciones: `space-y-16 sm:space-y-20` en el inicio y `space-y-8` a `space-y-12` en las páginas internas.

---

## 4. Movimiento (clases en `globals.css`)

| Efecto | Clase | Duración | Dónde |
|---|---|---|---|
| Entrada de cada página con difuminado | `.pagina-entra` (en `src/app/template.tsx`) | 700 ms | Todas las páginas, en cada cambio de pestaña |
| Aparición al hacer scroll (desde abajo, con desenfoque) | `.revelar` + componente `Revelar` | 750 ms, escalonado 110–140 ms | Secciones y tarjetas del inicio, integración y resultados |
| Filas del registro del inicio (entran desde la derecha) | `.fila-entra` | 800 ms, una cada 260 ms | Inicio |
| Insignia de decisión «sello» | `.sello` | 500 ms | Inicio |
| Barras que crecen | `.barra-crece` | 1,1 s | Resultados |
| Línea que «fluye» en el diagrama | `.flujo` | Ciclo de 0,9 s | Integración |
| Figuras del fondo | `.figura-a` / `.figura-b` + `FondoFiguras` | 40–80 s por ciclo, opacidad 12–16% | Todas las páginas, detrás del contenido |
| Tarjeta que se eleva | `.elevar` | 260 ms, solo con mouse | Tarjetas del inicio e integración |
| Cifras que cuentan | componente `Cifras` | 1,1 s | Inicio y resultados |
| Resultado de la demo | `.entra` | 420 ms | Demo |

**Reducir movimiento** (`prefers-reduced-motion`): sin desplazamientos ni desenfoques, figuras quietas, sin flujo ni ciclo automático del diagrama. Queda solo el cambio de opacidad.

---

## 5. Páginas y navegación

**Barra** (fija, con vidrio oscuro): el logo lleva al inicio. Le siguen cinco páginas, en el orden en que se cuenta la historia: **Demo → Simulación → Cola → Resultados → Integración**. A la derecha, «Código en GitHub». No hay anclas ni botones duplicados. En celular, un menú con «Inicio» más las cinco páginas.

Todas las páginas internas arrancan desde arriba con el mismo encabezado (`EncabezadoPagina`): etiqueta, titular y una o dos líneas.

| Ruta | Contenido |
|---|---|
| `/` Inicio | (1) Hero que cabe en la ventana: titular, dos botones y el «registro de decisiones» con 3 acciones reales evaluadas con JEV el 17 oct. (2) Cuatro cifras del test. (3) «Cómo funciona» en 3 tarjetas plegables. (4) «Recorre VoBo»: 5 tarjetas a las 5 páginas. (5) Lectura honesta. |
| `/demo` | Antes estaba en `/#demo`. 16 ejemplos como botones, formulario con ajustes avanzados plegados y resultado fijo al lado en escritorio. Llama a JEV real. |
| `/simulacion` | Sin cambios de lógica; encabezado común y texto más corto. |
| `/cola` | Sin cambios de lógica; encabezado común y nota más corta. |
| `/resultados` | (1) Cuatro números. (2) «Por qué combinar»: barras con solo reglas, solo JEV y VoBo (34 / 31 / 3 de 74 peligrosas pasan; autonomía 100 / 83,1 / 83,1%). (3) Lectura honesta en 3 tarjetas. (4) Detalle en 6 bloques plegables: tabla completa, matriz de confusión, aporte de JEV, cada error con su texto, dev y umbrales, integridad. **No se quitó ningún dato.** |
| `/integracion` | Nueva. Diagrama interactivo (agente → puerta de salida → VoBo → PERMITIR / PEDIR VOBO / BLOQUEAR, más el registro). Cuatro principios y la tabla «Qué está construido y qué no», tomada de `docs/INTEGRACION.md`. |

---

## 6. Componentes nuevos o cambiados (`src/components/`)

| Archivo | Qué hace |
|---|---|
| `Nav.tsx` | Barra por páginas, menú móvil, contador de pendientes en «Cola» |
| `EncabezadoPagina.tsx` | `EncabezadoPagina` (h1 de página), `EncabezadoSeccion` (h2 con etiqueta y nota) y `Plegable` (bloque desplegable) |
| `HeroVivo.tsx` | Registro de 3 decisiones reales del inicio (servidor, sin estado) |
| `Cifras.tsx` | Franja de cifras que cuentan al entrar en pantalla |
| `DiagramaPuerta.tsx` | Diagrama de integración (SVG): botones o mouse resaltan un camino, recorre los tres solo hasta que alguien elige y muestra debajo el ejemplo real. En celular se ve como lista |
| `Revelar.tsx` | Aparición al hacer scroll (IntersectionObserver). Sin JavaScript, el contenido se ve igual (regla `noscript` en `layout.tsx`) |
| `FondoFiguras.tsx` | 10 figuras SVG decorativas, fijas detrás del contenido; `aria-hidden`, sin clics |
| `Demo.tsx` | Ejemplos como botones con su intención, ajustes avanzados plegados y panel de resultado fijo |
| `src/app/template.tsx` | Envuelve cada página para el difuminado de entrada |

---

## 7. Reglas de contenido que el diseño respeta

- **Cifras** solo de `eval/results/test.json` (conjunto principal de 145 acciones): 3 de 74 · 83,1% · 25,5% · p50 399 ms · p95 650 ms · USD 0,064 por 1.000 · 1.534 tokens. Se escriben con coma decimal.
- **Principio D-013:** «JEV opina, el código autoriza y una persona decide lo dudoso». Nunca «JEV decide».
- **HubSpot** se nombra, pero nunca se dice «integrado con HubSpot» (D-027). La ejecución en HubSpot y WhatsApp es un ejemplo, no está conectada.
- **Perfiles:** «muestra de perfiles de ejemplo compartida para el reto (anónima, solo categorías)» (D-028).
- No se citan incidentes de 30X (D-015). No se usa otro modelo (D-025). No se habla de n8n como integración principal.
- El pie de todas las páginas dice que las acciones son sintéticas y la política es de demostración.

---

## 8. Pendiente o por verificar

- **Celular:** no se pudo verificar desde la sesión de Claude. Revisar en un teléfono antes de grabar.
- **Guion y tomas:** la demo ahora está en `/demo`. Donde el guion diga «bajar hasta la demo», ahora es «clic en Demo».
- Las clases `.pulso` y `.tarjeta-entra` quedaron sin uso. Se pueden borrar después de la entrega.
