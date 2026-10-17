# Sistema de diseño de VoBo (basado en 30X)

VoBo es una solución para 30X, así que la interfaz usa el sistema de diseño de 30X y no uno propio. Este documento dice de dónde sale cada decisión.

## Fuentes

| Fuente | Qué se tomó |
|---|---|
| **hackradar.30x.com** (la plataforma del hackathon) | Los tokens que publica en su CSS: neutros oscuros, texto, bordes, colores de estado en pastel, Inter y Playfair Display, botones de 8 px. No se inició sesión; solo se leyó la página pública de acceso. |
| **30x.com** (el sitio de marca) | El lima del botón «Aplica Ahora» (`#e9ff7b`), Inter Display en títulos con tracking cerrado, pastillas, tarjetas de 12 px y botones de 8 px. |
| **`DESIGN.md` de referencia (estilo Linear)** | Solo la estructura de las superficies (lienzo, tarjeta, campo), bordes finos en lugar de sombras, **un solo acento por pantalla**, pesos de letra hasta 600 y texto de cuerpo en grises. **No** se copió su paleta, su tipografía mono ni sus radios. |
| **impeccable** (`craft-floor`) | Contraste (cuerpo ≥ 4,5:1), nada de bordes de color a un lado, ni texto con degradado, ni emojis como íconos (los íconos son SVG propios); temas para selección, cursor, foco y barra de desplazamiento; un solo momento de movimiento. |
| **emilkowalski/skills** | Curva de salida fuerte `cubic-bezier(0.23, 1, 0.32, 1)`, botones que se hunden al pulsarlos (`scale(0.97)`), transiciones de propiedades concretas (no `all`), entradas de 180 ms y respeto de `prefers-reduced-motion`. |
| **ui-ux-pro-max** (`design-system`) | Tokens en capas: primitivos (valores crudos de 30X) → semánticos (qué significan en VoBo) → uso en componentes. |
| **claude-webkit** | Sin aportes de diseño visual; solo se revisó el flujo del proyecto. |

## Colores

Definidos en `src/app/globals.css`. Los componentes usan solo los semánticos.

| Token semántico | Valor | De dónde sale | Uso |
|---|---|---|---|
| `canvas` | `#0b0b0c` | HackRadar `--brand-black` | Fondo de página |
| `surface` | `#16181c` | HackRadar `--brand-ink-2` | Tarjetas |
| `field` | `#0e1013` | HackRadar `--brand-ink` | Campos y bloques de código |
| `raised` | `#23262e` | HackRadar `--brand-graphite` | Pistas de las barras |
| `line` / `line-strong` | `#2e323b` / `#3a3f4a` | HackRadar `--border` | Bordes finos |
| `fg` | `#f6f4f1` | HackRadar `--brand-paper` | Texto principal |
| `fg-soft` | `#d5d3ce` | HackRadar `--brand-text-soft` | Texto de apoyo |
| `fg-muted` | `#a9ab9e` | HackRadar `--brand-text-dim` | Metadatos (7,6:1 sobre tarjeta) |
| `fg-faint` | `#82876f` | HackRadar `--brand-olive` | Solo placeholders (4,8:1) |
| `accent` | `#e9ff7b` | 30x.com, botón «Aplica Ahora» | Botón principal y una palabra del título |
| `allow` | `#9fd4ae` | HackRadar `--success` | PERMITIR |
| `review` | `#e9c582` | HackRadar `--warning` | PEDIR VOBO |
| `block` | `#f2a19b` | HackRadar `--danger` | BLOQUEAR |

**Decisión sobre el lima.** HackRadar usa un lima más pálido (`#e8ffb7`) y 30x.com uno más vivo (`#e9ff7b`). Usamos el de 30x.com como único acento porque es el de sus botones de acción. Cambiarlo es un solo token (`--color-brand-lime`).

**Estados.** La decisión nunca se comunica solo con color: siempre lleva ícono y texto (PERMITIR, PEDIR VOBO, BLOQUEAR). Los tres pastel pasan con holgura el contraste sobre las superficies oscuras (entre 7,4:1 y 11,7:1).

El gris verdoso `#6e7163` (`moss`) se usa solo en bordes al pasar el cursor. Sobre fondo oscuro da menos de 4:1, así que nunca lleva texto.

## Tipografía

- **Inter** (variable, con eje de tamaño óptico `opsz`): toda la interfaz. Los títulos de panel usan el tamaño óptico grande y tracking `-0.03em`, que es lo que hace 30x.com con Inter Display.
- **Playfair Display 700**: solo el título de la página, como el título de HackRadar.
- Las fuentes están **auto-alojadas** en `src/app/fonts/` (licencia SIL OFL, con su texto al lado). No dependen de Google ni de la red durante el build.

## Forma y movimiento

- Radios: 8 px en botones y campos, 12 px en tarjetas, pastillas completas en insignias. Son los que usa 30x.com.
- Elevación con bordes de 1 px, no con sombras.
- Movimiento: el resultado entra una vez (180 ms, salida fuerte); los botones se hunden al pulsarlos; nada se anima en teclado ni al escribir. Con `prefers-reduced-motion` no hay animación.

## Accesibilidad

Contraste verificado con la fórmula de WCAG: texto principal 16:1 o más, texto secundario 6,5:1 o más, negro sobre lima 17,9:1. Hay enlace «Saltar al contenido», foco visible en lima, medidores con `role="meter"` y nombre, y la página no desborda a 375 px.
