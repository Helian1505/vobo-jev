# Base de conocimiento de 30X para VoBo

Versión 1 · sáb 17 oct 2026, 12:45 p.m. (Bogotá) · Equipo VoBo (Helian Fierro, Juan David Cano, Angie Tamara), con Claude.

Este documento reúne lo que sabemos de 30X y de dónde sale cada dato. Es la base para las decisiones del prototipo, el playbook y el pitch. Si un dato de aquí cambia, cambia también donde se usa (política, ejemplos de la demo, README).

**Fuentes:**
- **[30X]** Base de perfiles anónimos que 30X compartió para el reto: `data/perfiles_30x.csv` (697 de los 699 perfiles de la muestra; en la extracción faltan P-295 y P-299).
- **[Público]** Investigación web del 16 oct (30x.com, hackathon.30x.com, prensa y documentación de TypeSafe). No está verificada con 30X.
- **[Inferencia]** Una lectura nuestra a partir de los datos. No es un dato.
- **[Supuesto]** Un valor de demostración que hay que confirmar con 30X.

---

## 1. Qué es 30X

- **[Público]** Escuela de negocios "founder-to-founder" para fundadores, operadores y ejecutivos de Latinoamérica. Pilares: Playbooks, Mentores y Comunidad.
- **[Público]** Producto principal: la Inmersión Ejecutiva (el "Inmersivo"), presencial y de 3 días, con unos 40 founders por cohorte. La web anuncia 13 programas, de USD 1.200 a 6.000.
- **[Público]** Embudo gratuito: clases abiertas y Live Mentoring en Luma, bootcamp gratuito, newsletters y comunidad en WhatsApp. La admisión a los programas es por aplicación.
- **[Público]** ICP declarado: founders, CEOs y C-levels de empresas B2B, SaaS y tech.
- **[Público]** Cultura de IA: la página de empleo dice que "todos crean agentes", y 30X enseña a construir agentes que califican leads y actualizan el CRM. **[Inferencia]** El riesgo que cubre VoBo (un agente que actúa mal sobre la base de contactos) es parte de su operación diaria.

## 2. Oferta: programas

Los nombres son los que aparecen en la base de perfiles **[30X]**. El conteo es sobre los 298 deals de la muestra.

| Programa (campo "Programa" del CRM) | Deals en la muestra | Precio público | Notas |
|---|---|---|---|
| AI Sales | 90 (30%) | — | El programa con más deals |
| 30X Executive Program | 67 (22%) | — | **[Inferencia]** Es la Inmersión Ejecutiva; en "programa sugerido" aparece con ese nombre |
| AI for Executives | 35 (12%) | **USD 2.000** [Público] | Se usa en la regla de precio |
| Sales Machine | 34 (11%) | — | |
| AI Second Brain | 20 (7%) | — | |
| AI for devs | 19 (6%) | USD 1.500 o 2.000 (las fuentes se contradicen) | **[Inferencia]** Equivale a "Hardcore AI" del programa sugerido |
| Free Sales Training | 13 (4%) | **Gratuito** [Supuesto, por el nombre] | **[Inferencia]** En el CRM de 30X, "deal" incluye inscripciones gratuitas |
| Negociación, Ventas con LinkedIn, Multipliers, B2B, Next Fellowship, Fundraising School | de 2 a 6 cada uno | — | |

**Programa sugerido** (lo que 30X recomienda para cada persona, sobre los 697 perfiles) **[30X]**:

| Programa sugerido | Perfiles | Afinidad media |
|---|---|---|
| AI Sales | 211 (30%) | 6,4 |
| Sin programa sugerido | 197 (28%) | 0,9 |
| Inmersión Ejecutiva | 133 (19%) | 7,7 |
| Sales Machine | 100 (14%) | 7,4 |
| Hardcore AI | 35 (5%) | 6,6 |
| Achievers | 21 (3%) | 6,7 |

"Sin programa sugerido" coincide exactamente con una afinidad de 0 a 2: son los 197 casos.

**Para la demo:** se usan solo estos programas, con sus nombres reales. **No se muestran sesiones ni segmentos que no aparezcan aquí** (el reto prohíbe "suponer que 30X vende algo que no vende").

## 3. La base de contactos y el embudo

### 3.1 Tamaño
- **[30X]** La base real tiene unas **24.800 personas con deal en el CRM** y unas **7.500 leads sin deal**, en total cerca de **32.300 contactos**.
- **[30X]** La muestra (699 perfiles; 697 en la extracción) se armó en la misma proporción por afinidad que la base real, para que no quede sesgada hacia los mejor calificados.
- **Factores de escala** de la muestra a la base: cada deal de la muestra ≈ **83,2 personas** reales y cada lead ≈ **18,8** (`data/audiencias_demo.json`). Con eso, la demo convierte una audiencia de la muestra en "destinatarios estimados".

### 3.2 Estado de los 298 deals de la muestra **[30X]**

| Estado | Deals | Etapas del CRM |
|---|---|---|
| En proceso | 248 (83%) | En gestión 188 · Calificado 29 · Potencial 18 · Contactado 6 · Registrado 5 · Perdido 2 |
| Oportunidad perdida | 40 (13%) | Cierre perdido 40 |
| Cliente (pagó) | 10 (3,4%; IC 95%: 1,8–6,1%) | Ganado Pagado Completo 8 · Ganado Pago Parcial 2 |

### 3.3 Qué pasa según la afinidad (deals de la muestra) **[30X]**

| Banda de afinidad | Deals | Pagaron | % pagó (IC 95%) | Perdidas | Siguen en proceso |
|---|---|---|---|---|---|
| 9–10 (muy alta) | 40 | 5 | 12,5% (5,5–26,1) | 15 (38%) | 20 (50%) |
| 7–8 (alta) | 67 | 1 | 1,5% (0,3–8,0) | 9 | 57 |
| 4–6 (media) | 62 | 1 | 1,6% (0,3–8,6) | 9 | 52 |
| 0–3 (baja) | 129 | 3 | 2,3% (0,8–6,6) | 7 | 119 (92%) |

**Lectura [Inferencia]:**
- La afinidad muy alta convierte bastante más que el resto.
- Los deals de afinidad baja casi nunca se cierran: 92% sigue "en proceso". Ahí se acumula el volumen de seguimiento, y ahí es donde un agente que envía mensajes en masa más puede quemar la base (quejas de spam, bajas, reputación).
- Con solo 10 clientes en la muestra, la evidencia es débil y los intervalos se traslapan. Sirve para orientar una regla de revisión, no para bloquear.

### 3.4 Por qué la regla de afinidad pide VoBo y no bloquea
De los 10 clientes que pagaron, **3 tenían afinidad 0 o 1 y ningún programa sugerido** (P-067 en AI for devs, P-017 en 30X Executive Program, P-029 en Next Fellowship). Bloquear las ofertas a audiencias de baja afinidad dejaría por fuera a compradores reales. Por eso `oferta_sin_afinidad` es **PEDIR VOBO**: una persona decide si la oferta tiene sentido.

### 3.5 Lo que compraron frente a lo sugerido
De los 7 clientes que tenían programa sugerido, solo 1 compró ese mismo programa (P-294, AI Sales). Si se toma 30X Executive Program como la Inmersión Ejecutiva, son 2. Los demás compraron otro: por ejemplo, P-286 compró AI for Executives y tenía sugerido AI Sales. **[Inferencia]** "Ofrecer un programa distinto al sugerido" no es en sí una señal de riesgo, así que no lo convertimos en regla.

## 4. Quién llega a 30X **[30X]**

**Rol** (solo existe para quien ya tiene deal; 188 perfiles con dato):

| Rol | Perfiles | % |
|---|---|---|
| Fundador, socio o CEO | 107 | 57% |
| Líder comercial o de ventas | 30 | 16% |
| Gerente o jefe de área | 23 | 12% |
| Director, VP o C-level (no dueño) | 15 | 8% |
| Perfil técnico (ingeniería, datos, producto) | 13 | 7% |

**Objetivo principal** (697 perfiles):

| Objetivo | Perfiles | % |
|---|---|---|
| Automatizar con IA | 306 | 44% |
| Vender más | 143 | 21% |
| Formarse (sobre todo en IA) | 132 | 19% |
| Expandirse a otros países | 50 | 7% |
| Construir una máquina de ventas | 23 | 3% |
| Levantar capital | 14 | 2% |
| Entrar a una red de pares | 10 | 1% |
| Desarrollar liderazgo y equipo | 7 | 1% |
| Delegar y pasar a un rol estratégico | 7 | 1% |
| Transformar el modelo de negocio | 5 | 1% |

**Dolor principal:** el 85% (595) no declaró ninguno. De los 102 que sí lo hicieron:

| Dolor | Perfiles |
|---|---|
| Procesos manuales y rezago tecnológico | 26 |
| Falta de claridad estratégica para escalar | 19 |
| No tiene un proceso comercial estructurado | 17 |
| Vive de referidos y prospecta a mano | 11 |
| El dueño es el cuello de botella | 9 |
| Ventas estancadas | 7 |
| Capital y flujo de caja | 5 |
| Equipo | 4 |
| Expansión sin método | 4 |

**Temas de interés** (cuántos perfiles mencionan cada tema):

| Tema | Perfiles | % |
|---|---|---|
| IA | 488 | 70% |
| Ventas | 448 | 64% |
| Operaciones | 252 | 36% |
| Go-to-market | 211 | 30% |
| Liderazgo | 200 | 29% |
| Marketing | 59 | 8% |
| Levantamiento de capital | 36 | 5% |
| Finanzas | 25 | 4% |
| Producto | 24 | 3% |
| Precios | 23 | 3% |
| Contratación | 22 | 3% |
| Negociación | 17 | 2% |

**País:** el 97% no tiene dato. Entre los que sí: Colombia 14, Estados Unidos 2, Argentina 1, España 1 y Venezuela 1.

**Segmentos de VoBo frente a los roles reales.** El banco de pruebas usa 5 segmentos sintéticos. En la demo, el mapeo es:

| Rol real | Segmento de VoBo |
|---|---|
| Fundador, socio o CEO | founders |
| Director/VP y Gerente | ejecutivos |
| Perfil técnico | equipos_tecnicos |
| Sin dato | comunidad_general |
| Líder comercial | ejecutivos (provisional) |

- El rol de "líder comercial" no tiene segmento propio en el banco: es una brecha conocida y queda en la hoja de ruta.
- El segmento sintético "estudiantes" **no** aparece en los datos de 30X. Se queda en el banco (que se declara sintético), pero **no se usa en la demo, el video ni el pitch**.

## 5. Calidad de los datos (lo que dice 30X y lo que vemos)

- **[30X]** Contra 220 perfiles clasificados a mano, el rol coincide 81%, el dolor 55% y el objetivo 55%. Según 30X, "sirven para ver proporciones, no como dato exacto de cada persona".
- **[30X]** De un lead solo se sabe qué necesita y qué temas le interesan. El rol se llena cuando la persona ya es alumno o tiene deal.
- **[Inferencia, oportunidad para la hoja de ruta]** El 55% de acierto en dolor y objetivo es justo el tipo de decisión repetitiva que JEV puede mejorar: clasificar el texto libre de una inscripción, con su probabilidad, y mandar a una persona los casos de baja confianza. Es el mismo patrón de VoBo (JEV opina, el código decide, una persona resuelve las dudas) aplicado al enrutador de prospectos.
- En la hoja "Resumen" de la copia del archivo hay fórmulas rotas (`#REF!`). No las usamos: todos los números de este documento salen de la hoja de perfiles.

## 6. Operación y herramientas **[Público]**
- Visibles: sitio en Framer, eventos en Luma, comunidad en Circle y WhatsApp, clases por Zoom, portal de alumnos, newsletters en Substack.
- No visibles: el CRM, la herramienta de correo masivo y la pasarela de pago.
- Etapas reales del CRM (base de perfiles): Registrado → Contactado → Potencial → Calificado → En gestión → Ganado (Pago Parcial o Pagado Completo), o Cierre perdido.

## 7. Contexto de entregabilidad **[Público]**
- Gmail exige a quien envía más de 5.000 correos al día una tasa de spam menor a 0,3%, baja con un clic y atender las bajas en 48 horas. Con 10.000 envíos, 30 denuncias ya son el 0,3%. Eso sustenta el umbral de 5.000 destinatarios de la política.
- **[Inferencia]** Con unos 32.300 contactos y el 83% de los deals "en proceso", cualquier envío masivo de un agente a la base completa cruza ese umbral.

## 8. Decisiones de VoBo que salen de esta base
Aprobadas por Helian el sáb 17 oct a las 12:30 p.m.

| # | Decisión | Evidencia |
|---|---|---|
| 1 | La demo usa los programas, roles y etapas reales de 30X; nada de "estudiantes" ni sesiones inventadas | Secciones 2 y 4; restricción del reto |
| 2 | Regla `oferta_sin_afinidad`: programa pago por canal masivo, con 50% o más de la audiencia en afinidad 0–3 → **PEDIR VOBO** | Secciones 3.3 y 3.4. El umbral de 50% es [Supuesto] |
| 3 | Marcar un deal como "Ganado…" es un cambio protegido (individual → PEDIR VOBO; masivo → BLOQUEAR). Las demás etapas se mueven sin freno | Sección 6: "ganado" equivale a registrar un pago |
| 4 | Precio de referencia por programa cuando es público: AI for Executives USD 2.000 y Free Sales Training gratuito. El resto sigue con el supuesto de sesión abierta a USD 99 | Sección 2 |
| 5 | Los destinatarios de la demo se estiman con los factores de escala de la muestra | Sección 3.1 |
| 6 | No se le pregunta a JEV por datos categóricos (rol, banda, etapa): eso lo resuelve el código | Principio de diseño; sección 5 |
| 7 | Historia de impacto del pitch: unos 32.300 contactos, 83% de los deals en seguimiento y 3,4% de conversión de deal a pago en la muestra. Cada mensaje equivocado en masa cuesta reputación en un embudo donde convertir ya es difícil | Secciones 3 y 7 |
| 8 | Hoja de ruta: JEV para clasificar dolor y objetivo desde texto libre (hoy, 55% de acierto según 30X) | Sección 5 |
| 9 | El repo es público y estos datos van en él (aprobado por Helian) | Material compartido por 30X para el reto, sin datos personales |

## 9. Supuestos que siguen abiertos (para la mentoría)
1. ¿30X otorga certificaciones oficiales o avales? Asumimos que no.
2. Precios de los programas además de AI for Executives. ¿Existe una "sesión abierta" paga (asumimos USD 99)?
3. ¿Más de 5.000 destinatarios en un envío requiere revisión? ¿Hay un horario permitido para los envíos masivos?
4. ¿Qué campos del CRM son sensibles? Asumimos: consentimiento, estado de pago, nivel de acceso, descuento aprobado y etapa "ganado".
5. ¿"30X Executive Program" es la Inmersión Ejecutiva? ¿"AI for devs" es Hardcore AI?
6. ¿Un "deal" en su CRM incluye las inscripciones gratuitas?
7. Cómo se evalúa y premia el reto, y si hay final en vivo o Demo Day (19–20 oct).

## 10. Fuentes
- `perfiles-30x-anonimo.xlsx`: muestra de perfiles compartida por 30X para el reto (17 oct), con sus notas de método. Copia en `data/perfiles_30x.csv`.
- 30x.com (programas, nosotros, empleo); hackathon.30x.com; bootcamp.30x.com; luma.com/crece30X.
- HackRadar 30X: ficha del reto JEV.
- Documentación de TypeSafe (docs.typesafe.ai): API, modelos, confianza y guardrails.
- Google: requisitos para remitentes masivos.
