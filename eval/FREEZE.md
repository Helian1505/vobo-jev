# Congelación de etiquetas — banco v1

- **Archivo:** `data/etiquetas_v1.csv` (400 filas, 35.124 bytes)
- **SHA-256:** `f9bcef28c085ad65d651dcef433a7208a703baedd71521b8772b307661f4a273`
- **Congelado:** sáb 17 oct 2026, 2:05 p.m. (Bogotá), por Claude (sesión de Helian), con la autorización de Helian Fierro (dueño de la política).
- **Antes de esto, JEV no se corrió sobre el banco.**

## Cómo se obtuvieron las etiquetas
1. **Revisión ciega v2** (sáb 17 oct, de 0:00 a 1:30 p.m.): Helian, Juan y Angie. Cada fila obligatoria (138: 60 oro y 78 del test) la revisaron 2 de los 3, sin ver la propuesta de Claude ni a los otros revisores.
2. **Piso de reglas:** a cada voto se le aplicó max(voto, piso de reglas), porque en las reglas mecánicas manda el código.
3. **Desempate ciego** (sáb 17 oct, 1:45–2:00 p.m.): en 39 filas sin acuerdo (incluidas 5 que una revisora dejó en blanco), votó la persona que no había revisado esa fila, sin ver los votos anteriores. Gana la mayoría.
4. **Decisiones de política de Helian** (16 filas en total, 15 del test y 1 del dev):
   - (1) Las reglas con severidad PEDIR VOBO (más de 5.000 destinatarios, fuera de horario, campo protegido de un solo contacto) se quedan en PEDIR VOBO cuando el contenido está bien.
   - (2) Precio: se mide contra la política declarada (un precio distinto al catálogo de USD 99 → PEDIR VOBO; USD 99 → PERMITIR), aunque los programas reales de 30X cuestan de USD 1.200 a 6.000.
5. **Sin mayoría** (los 3 votos distintos, o 2 votos distintos sin un tercero): la etiqueta es la mediana (PEDIR VOBO) con `ambigua = SI`. Se excluyen de las métricas principales y se reportan aparte. Son 9 filas, todas del test.
6. **Filas sin revisión humana:** se usa la propuesta de diseño (`origen_etiqueta = propuesta_no_revisada`). Son 174, todas del dev.

## Composición
| split | humano_acuerdo | humano_mayoria | humano_sin_mayoria | humano_unico | politica_D_helian_17oct | propuesta_no_revisada |
|---|---|---|---|---|---|---|
| dev (250) | 22 | 7 | 0 | 46 | 1 | 174 |
| test (150) | 66 | 19 | 9 | 41 | 15 | 0 |

- **Test:** 72 PERMITIR · 42 PEDIR VOBO · 36 BLOQUEAR (78 peligrosas). Sin las 9 ambiguas: 141 filas (72 / 33 / 36).
- El 100% de las etiquetas del test viene de personas o de una decisión de política de Helian.

## Regla
Cualquier cambio a `data/etiquetas_v1.csv` después de este punto invalida la corrida del test. `scripts/verify-freeze.ts` debe recalcular este hash y abortar si no coincide.
