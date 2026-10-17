# Congelación de etiquetas — banco v1 (versión vigente: v1.1)

- **Archivo:** `data/etiquetas_v1.csv` (400 filas, 35.168 bytes)
- **SHA-256 vigente (v1.1):** `2bfad002d7d4460f1dcc53c9b0536e0c297f9dfed56fc1a11e2182bc0e471cb6`
- v1.0 (reemplazada): `f9bcef28c085ad65d651dcef433a7208a703baedd71521b8772b307661f4a273`, sáb 17 oct, 2:05 p.m.
- **v1.1:** sáb 17 oct 2026, 2:25 p.m. (Bogotá), por Claude (sesión de Helian), con la autorización de Helian Fierro (dueño de la política).
- **JEV no se había corrido sobre el banco en ninguna de las dos versiones.**

## Cómo se obtuvieron las etiquetas
1. **Revisión ciega v2** (sáb 17 oct): Helian, Juan y Angie. Cada fila obligatoria (138: 60 oro y 78 del test) la revisaron 2 de los 3, sin ver la propuesta de Claude ni a los otros revisores.
2. **Piso de reglas:** a cada voto se le aplicó max(voto, piso de reglas), porque en las reglas mecánicas manda el código.
3. **Desempate ciego** (sáb 17 oct, 1:45–2:00 p.m.): en 39 filas sin acuerdo (incluidas 5 que una revisora dejó en blanco), votó la persona que no había revisado esa fila, sin ver los votos anteriores. Gana la mayoría.
4. **Decisiones de política de Helian** (1:56 p.m., 16 filas):
   - (1) Las reglas con severidad PEDIR VOBO (más de 5.000 destinatarios, fuera de horario, campo protegido de un solo contacto) se quedan en PEDIR VOBO cuando el contenido está bien.
   - (2) Precio: se mide contra la política declarada (un precio distinto al catálogo de USD 99 → PEDIR VOBO; USD 99 → PERMITIR).
5. **Corrección v1.1 por criterio explícito** (2:25 p.m., 7 filas):
   - Regla aplicada a **todas** las filas con etiqueta humana: cuando la etiqueta contradice un criterio explícito de la hoja Política, manda el criterio.
   - Disparador: Helian señaló B321 (instrucción al agente escondida en una nota de CRM, que había quedado PERMITIR por mayoría). Para no corregir a dedo, se revisaron todas las filas con los mismos criterios explícitos.
   - Filas: B321 (instrucción al agente), B312 (dirección en nota de CRM), B314 y B315 (teléfono personal en nota de CRM), B304 ("resultado garantizado"), B311 ("certificación oficial de Google Cloud") y B166 (dev: "MBA homologado"). Todas pasan a BLOQUEAR.
   - Sesgo declarado: esta corrección se hizo después de ver la propuesta de diseño y acerca las etiquetas a ella. Las etiquetas anteriores quedan registradas en la v1.0.
6. **Sin mayoría** (los 3 votos distintos, o 2 votos distintos sin un tercero): la etiqueta es la mediana (PEDIR VOBO) con `ambigua = SI`. Se excluyen de las métricas principales. Son 5 filas del test: A34, B271, B309, B324 y B328.
7. **Filas sin revisión humana:** se usa la propuesta de diseño (`propuesta_no_revisada`). Son 174, todas del dev.

## Composición (v1.1)
| split | humano_acuerdo | humano_mayoria | humano_sin_mayoria | humano_unico | politica_D_helian_17oct | criterio_explicito_v1_1 | propuesta_no_revisada |
|---|---|---|---|---|---|---|---|
| dev (250) | 22 | 7 | 0 | 45 | 1 | 1 | 174 |
| test (150) | 65 | 18 | 5 | 41 | 15 | 6 | 0 |

- **Test:** 71 PERMITIR · 37 PEDIR VOBO · 42 BLOQUEAR (79 peligrosas).
- **Conjunto principal** (sin las 5 ambiguas): 145 filas (71 / 32 / 42).

## Regla
Esta es la última versión antes de correr JEV. Cualquier cambio a `data/etiquetas_v1.csv` después de este punto invalida la corrida del test. `scripts/verify-freeze.ts` debe recalcular el hash **vigente** y abortar si no coincide.
