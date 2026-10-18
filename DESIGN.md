# VoBo — Sistema de diseño v2 (DESIGN.md) · estructura Linear + marca 30X · sáb 17 oct 2026, 9:45 p.m.

> **Reemplaza a `DISENO_VoBo-30X_v1_17oct.md`** (estructura Ramp, tema claro). Lo pidió Juan a las 9:30 p.m.: la referencia de estructura es **Linear** («midnight precision instrument»), adaptada a las **fuentes y colores medidos en 30x.com**.
> **Uso:** copiar a la raíz del repo como `DESIGN.md` (reemplaza a `docs/DESIGN_30X.md`) y pedirle a Claude Code que rediseñe las pantallas con él **en una rama aparte**, sin tocar la lógica (ver §8).
> **Qué es hecho y qué es propuesta:** los colores y las fuentes de 30X (§1 y §2) son **valores medidos** en 30x.com el 17 oct. La estructura, los espaciados y los componentes vienen de la referencia de Linear y son **recomendación**.

**Tema:** oscuro (como el hero de 30x.com y como Linear).
**Idea:** un tablero de control nocturno y preciso. El negro es el sustrato; el texto es blanco y apretado; **el lima de 30X aparece solo donde hay una acción**. La única «imagen» es el producto mismo: tarjetas de decisión, el flujo agente → VoBo → canales y las cifras del test.

---

## 1. Colores

### Marca 30X (medidos; reemplazan a los de Linear)
| Token | Valor | Reemplaza en Linear | Uso |
|---|---|---|---|
| `--void` | `#000000` | Void `#08090a` | Lienzo de la página |
| `--carbon` | `#0A0A0A` | Carbon `#0f1011` | Barra de navegación, tarjetas |
| `--obsidian` | `#141414` | Obsidian `#161718` | Paneles elevados, panel de resultado |
| `--graphite` | `#232323` | Graphite `#23252a` | Bordes finos (hairline), divisores |
| `--smoke` | `#383838` | Smoke `#383b3f` | Bordes de mayor contraste, separadores de sección |
| `--ash` | `#525252` | Ash `#62666d` | Texto apagado, íconos inactivos (gris medido en 30X) |
| `--taupe` | `#868073` | Fog `#8a8f98` | Metadatos y micro-etiquetas: el **gris cálido** de 30X |
| `--mist` | `#D4D4D4` | Mist `#d0d6e0` | Texto de cuerpo sobre negro |
| `--sand` | `#F7F5F2` | Bone `#e5e5e6` | Texto casi blanco, botón blanco (fondo cálido medido en 30X) |
| `--paper` | `#FFFFFF` | Paper | Titulares |
| **`--lime`** | **`#E9FF7B`** | Acid Lime `#e4f222` | **Único acento:** botón primario, estado activo de la navegación, una palabra destacada en el titular, el foco |
| `--lime-wash` | `rgba(233,255,123,0.08)` | — | Fondo sutil del ítem activo y del ejemplo seleccionado |

### Estados de decisión de VoBo (funcionales, no son de marca)
| Estado | Punto / borde | Fondo del chip (sobre negro) | Texto |
|---|---|---|---|
| PERMITIR | `#3FB950` | `rgba(63,185,80,0.12)` | `#7EE787` |
| PEDIR VOBO | `#D29922` | `rgba(210,153,34,0.12)` | `#F2CC60` |
| BLOQUEAR | `#F85149` | `rgba(248,81,73,0.12)` | `#FFA198` |

**Reglas:**
- **El lima nunca marca un estado.** Si PERMITIR fuera lima, se confundiría con el botón de acción.
- Los colores de estado solo aparecen en chips, puntos y bordes izquierdos de tarjetas; **nunca en texto de cuerpo**.
- Los acentos extra de Linear (teal, violeta, lavanda, coral) **no se usan**.

## 2. Tipografía (30X)
| Rol | Fuente | Peso | Tamaño / interlineado | Tracking |
|---|---|---|---|---|
| Display (hero) | Inter (corte Display con `font-optical-sizing: auto`) | 600 | 64–72 px / 1.0 | −0.04 em (30X; Linear usa −0.022) |
| Titular de sección | Inter Display | 600 | 40–48 px / 1.05 | −0.04 em |
| Subtítulo | Inter Display | 500 | 24–32 px / 1.2 | −0.03 em |
| Cuerpo grande | Inter | 400 | 18–20 px / 1.5 | −0.01 em |
| Cuerpo | Inter | 400 | 16 px / 1.5 | 0 |
| Navegación | Inter Tight | 600 | 14 px | −0.01 em |
| Etiqueta / micro | Inter | 500 | 12 px / 1.4 | −0.02 em, mayúsculas solo en micro-etiquetas |
| **Datos técnicos** (`E09`, `request_id`, `jev-1.14.0`, `399 ms`, probabilidades) | **JetBrains Mono** (en lugar de Berkeley Mono) | 400 | 12–14 px | −0.01 em |

- **Pesos permitidos:** 400, 500 y 600. Nunca 700 o más (regla de Linear, compatible con 30X).
- **Se elimina la serif actual** (Playfair Display) de los titulares: no es de la marca 30X.
- Carga: Inter, Inter Tight y JetBrains Mono desde Google Fonts o `next/font/google`, con `display: swap`.

## 3. Espaciado, forma y elevación (Linear)
- **Base de 4 px.** Ritmo 8 / 12 / 16 / 24 / 32 / 48 / 64 / **96** (separación entre secciones).
- **Ancho máximo:** 1200 px. Padding de tarjeta: 24 px.
- **Radios:** botones e inputs 6 px · tarjetas 12 px · pastillas 9999 px. Nada mayor a 12 px en tarjetas.
- **Elevación por bordes, no por sombras:** borde interior de 1 px `--graphite` (`box-shadow: inset 0 0 0 1px var(--graphite)`). La única sombra real es la del panel flotante del resultado (`0 4px 32px rgba(0,0,0,0.6)`).
- **Única excepción decorativa:** un «piso» degradado muy sutil bajo la tarjeta del producto en el hero (de `--void` a `rgba(233,255,123,0.06)`).

## 4. Componentes
| Componente | Especificación |
|---|---|
| **Barra de navegación (fija)** | `position: sticky; top: 0`, `backdrop-filter: blur(12px)`, fondo `rgba(0,0,0,0.72)`, borde inferior hairline al hacer scroll. Izquierda: marca «VoBo» (Inter 600 16 px) + «para 30X» en `--taupe`. Centro: Cómo funciona · Demo · Simulación · Resultados · Integración (Inter Tight 14 px, `--mist`; activo con subrayado lima de 2 px). Derecha: botón primario lima «Probar la demo». En móvil: menú hamburguesa |
| **Botón primario** | Fondo `--lime`, texto `#0A0A0A`, Inter 600 14 px, radio 6 px, padding 10×16. **Uno por vista.** Hover: brillo +5% y desplazamiento de 1 px |
| **Botón secundario** | Transparente, borde 1 px `--graphite`, texto `--mist`. Hover: borde `--smoke` |
| **Chip de ejemplo** | Pastilla `rgba(255,255,255,0.05)`, texto `--mist` 13 px, con el ID en mono (`E09`) y un punto del color de la decisión esperada. Seleccionado: borde lima + `--lime-wash` |
| **Tarjeta de decisión** | Fondo `--carbon`, borde interior hairline, radio 12 px, **borde izquierdo de 3 px del color del estado**. Arriba: canal y tipo (micro-etiqueta `--taupe`) + `request_id` en mono. Centro: chip de estado grande + titular de la explicación. Abajo: razones en lista y probabilidades de JEV como barras finas (4 px) |
| **Barra de probabilidad** | Pista `--graphite`, relleno `--mist`, o del color del estado si supera el umbral; marca vertical en el umbral (T_acción) |
| **Tarjeta de métrica** | Número en Inter Display 600 48 px blanco + etiqueta 13 px `--taupe` + nota en mono 12 px (p. ej., «IC 95%: 1,4–11,3%») |
| **Badge** | Radio 4 px, fondo `rgba(255,255,255,0.05)`, texto 12 px `--taupe` |
| **Input** | Fondo `rgba(255,255,255,0.02)`, borde 1 px `rgba(255,255,255,0.08)`, radio 6 px; foco: borde `--lime` |
| **Panel lateral pegajoso** | En la demo, el resultado queda `position: sticky; top: 88px` en escritorio, para no tener que hacer scroll |

## 5. Imágenes (adaptadas, sin fotos)
Como en Linear: **el producto es la imagen.** Todo se construye en SVG o HTML, sin fotos de stock:
1. **Hero:** tarjeta grande que simula un turno de VoBo: tres tarjetas de decisión que entran una tras otra (PERMITIR → PEDIR VOBO → BLOQUEAR), con contador de ms y costo.
2. **Diagrama «la puerta de salida»:** Agente → **VoBo** (reglas en código + JEV) → HubSpot · WhatsApp · Redes, con una flecha lateral «lo dudoso → Slack» y una línea punteada «registro». Líneas hairline y nodos con borde fino; VoBo es el único nodo con borde lima.
3. **Íconos:** de línea, 1,5 px, en `--mist` (un solo estilo).

## 6. Arquitectura de la página de inicio (nueva distribución)
| # | Sección | Contenido | Interacción |
|---|---|---|---|
| 0 | **Navegación fija** | Ver §4 | Resalta la sección visible (scroll-spy) |
| 1 | **Hero** | Micro-etiqueta «Reto JEV · Hackathon 30X». Titular: «La puerta de salida de los **agentes** de 30X» (una palabra en lima). Subtítulo: «Cada correo, WhatsApp, publicación o cambio en HubSpot pasa por VoBo. JEV decide en milisegundos: lo seguro sale solo, lo dudoso llega a una persona con su porqué y lo indebido no sale.» CTA lima «Probar la demo» + secundario «Ver resultados». A la derecha o debajo: la tarjeta animada (§5.1) | Animación en bucle; se pausa al pasar el mouse |
| 2 | **Franja de cifras** | 4 tarjetas de métrica: **34 → 3** peligrosas sin persona (de 74) · **83,1%** seguras salen solas · **399 ms** p50 · **USD 0,064** por 1.000 decisiones. Nota: «Test de una sola corrida, JEV real. Detalle en Resultados.» | Las cifras cuentan hacia arriba al entrar en pantalla (una vez) |
| 3 | **Cómo decide** | Tres columnas: 1 Reglas en código (lo que un modelo no debe hacer) · 2 JEV, 7 preguntas tipadas en una llamada · 3 El más severo gana; ante la duda, una persona | Cada tarjeta se expande con su detalle |
| 4 | **Pruébalo (demo)** | Izquierda: **chips de ejemplos** (E16, E05, E09, E02, E12, …) en lugar del menú desplegable + formulario compacto (tipo, canal, destinatarios y texto visibles; el resto en «Ajustes avanzados», plegado). Derecha: **panel de resultado pegajoso** con la tarjeta de decisión | Un clic en un chip llena el formulario y evalúa; el resultado aparece con una transición corta |
| 5 | **Cómo se pone en 30X** | El diagrama (§5.2) + 4 puntos: puerta única dentro de la herramienta del agente · llaves solo en la puerta · falla cerrada · JEV solo ve el texto. Enlace a `docs/INTEGRACION.md` y a la puerta MCP | Hover en cada nodo del diagrama muestra su explicación |
| 6 | **Evidencia** | Resumen de resultados con la frase honesta («la meta era 0 y no se cumplió: 3 de 74») + botón a `/resultados` | — |
| 7 | **Footer** | Datos sintéticos, política de demostración, muestra de perfiles de ejemplo para el reto, enlaces a repo, playbook y equipo | — |

Las páginas `/simulacion`, `/cola` y `/resultados` heredan los tokens y componentes (navegación fija, tarjetas, tablas con filas hairline y números en mono), sin cambiar su contenido ni su lógica.

## 7. Movimiento
- Transiciones de 150–250 ms con `ease-out`. Nada que rebote.
- Respetar `prefers-reduced-motion`: sin animaciones y con las cifras finales directo.
- La animación del hero y el conteo de cifras son las únicas animaciones «de marketing».

## 8. Reglas para implementarlo sin romper nada
1. **Rama aparte** (`rediseno-ui`). Vercel genera una URL de vista previa; **no se fusiona a `main` hasta que Juan la apruebe** y las pruebas pasen.
2. **Solo** `src/app/**` (páginas y `globals.css`), `src/components/**`, fuentes y `DESIGN.md`. **No tocar** `src/lib/vobo/**`, `src/app/api/**`, `data/`, `eval/`, `scripts/` ni `tests/` (salvo una prueba de UI que haya que ajustar por un texto, sin cambiar lo que comprueba).
3. Mantener los textos honestos que ya existen (banner de JEV real o simulado, «acciones sintéticas», «política de demostración», la frase de integridad de `/resultados`) y **todas las cifras exactamente iguales**.
4. Frases prohibidas: «cero», «integrado con HubSpot», incidentes de 30X, n8n como integración principal.
5. Accesibilidad: contraste AA (el lima solo como fondo de botón o sobre negro), foco visible, navegación con teclado, `alt`/`aria-label` en el diagrama.
6. Antes de fusionar: `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run verify-freeze`, y probar en escritorio y en móvil (375 px).
