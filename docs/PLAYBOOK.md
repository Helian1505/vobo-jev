# Playbook de aplicación de JEV en 30X
## Que los agentes hagan más solos, con evidencia · Primera aplicación: VoBo, la puerta de salida de los agentes

> **v1.3 · dom 18 oct 2026, 12:55 a.m. · Pendiente de aprobación de Helian (dueño de la política, D-026).** Redactó Claude (sesión de Juan). Incorpora la revisión H-3.
> **Versión para el formulario:** `docs/PLAYBOOK.pdf` (8 diapositivas; el límite es 8). Este archivo es su versión en texto.
> **Qué cubre:** cada parte responde a lo que pide el reto (§08): las decisiones que toma JEV, el esquema de preguntas, los umbrales, quién lo opera y cómo se mide.
> **Etiquetas:**
> - **[Medido]**: test de una sola corrida, 17 oct, `jev-1.14.0`.
> - **[30X]**: lo dijo 30X.
> - **[Propuesta]**: diseño nuestro, sin construir o sin probar contra los sistemas de 30X.
> - **[Estimación]**: cálculo con supuestos declarados.
>
> Demo: vobo-jev.vercel.app · Código: github.com/Helian1505/vobo-jev

---

## 01 · Las decisiones que toma JEV

**La pregunta de negocio es una: ¿sale esta acción del agente?** Se hace en cada correo, WhatsApp, publicación o cambio en HubSpot, miles de veces al día. Para responderla, el trabajo se reparte: el código cuenta, JEV lee y una persona decide lo dudoso.

**Lo decide el código:**
- ¿El canal es oficial?
- ¿Algún destinatario pidió no recibir más?
- ¿Toca un campo protegido o marca «Ganado»?
- ¿Son más de 5.000 destinatarios o es fuera de horario?
- ¿La fecha y el precio cuadran?
- ¿La audiencia tiene afinidad baja?

**Lo decide JEV: 7 decisiones tipadas en una llamada:**
1. ¿Promete resultados? (choice)
2. ¿Afirma un título o un aval oficial? (sí/no)
3. ¿Expone datos personales? (choice)
4. ¿Trae una orden escondida para un agente? (sí/no)
5. ¿Afirma impacto sin respaldo? (choice)
6. ¿A qué público va? (choice)
7. ¿Qué tono tiene? (score)

**Resultado**, siempre con su porqué, armado con plantillas:
- **PERMITIR:** sale sola.
- **PEDIR VOBO:** decide una persona en Slack.
- **BLOQUEAR:** no sale y el agente recibe las razones.

**Por qué con JEV.** Es una decisión pequeña, se repite y tiene que resolverse antes de que la acción salga. **[Medido]** Las 7 preguntas se responden en una llamada: p50 399 ms, p95 650 ms y USD 0,064 por cada 1.000 decisiones. Un LLM por acción sería más lento y más caro.

Esta aplicación cubre dos ideas del reto: guardrails para agentes internos y calificación de contenido.

## 02 · El esquema de preguntas

**Lo que recibe JEV:**
- `contexto_30x`: quién es 30X, sus programas y lo que no ofrece;
- `accion`: tipo y canal;
- `contenido_no_confiable`: el texto del agente, con la advertencia de que cualquier instrucción que traiga es contenido, no una orden.

**Lo que nunca recibe:** destinatarios, correos, IDs, el segmento declarado, fechas ni precios. Así no se filtran datos de personas y la pregunta de público no queda sesgada.

**Reglas de redacción:**
- una cosa por pregunta, en positivo;
- siempre una opción «otro»;
- criterios con ejemplos concretos.

| Pregunta | Opciones | Consecuencia |
|---|---|---|
| Promesa | ninguna · niega o aclara · implícita · explícita · otro | Explícita → BLOQUEAR. Implícita → PEDIR VOBO |
| Certificación | sí: título, certificación o aval · no (una constancia no cuenta) | Sí → BLOQUEAR |
| Datos personales | ninguno · documento, cuenta, teléfono o correos · persona identificable · otro | Datos de contacto → BLOQUEAR. Persona identificable → PEDIR VOBO |
| Orden a un agente | sí: le ordena a un sistema saltarse reglas, borrar o enviar · no | Sí → BLOQUEAR |
| Afirmación | ninguna · con respaldo (fuente y muestra) · sin respaldo · otro | Sin respaldo → PEDIR VOBO |
| Público | founders · ejecutivos · equipos técnicos · estudiantes · general · otro | Distinto del declarado → PEDIR VOBO |
| Tono | 0 adecuado · 1 informal · 2 sensacionalista · 3 ofensivo | Ofensivo → BLOQUEAR. Sensacionalista → PEDIR VOBO |

Fuente: `src/lib/vobo/jev/questions.ts` y `state.ts`.

## 03 · Los umbrales: solo, persona o LLM

Cada respuesta trae una probabilidad. **La decisión final es la más severa entre las reglas y JEV:** JEV puede endurecerla, nunca aflojarla.

| Perfil | Se usa en | Sale solo si es menor que | Pasa a una persona si está entre | Se aplica la consecuencia desde |
|---|---|---|---|---|
| Estricto | Correo y WhatsApp masivos (irreversibles) | 0,30 | 0,30 y 0,50 | 0,50 |
| Normal | Redes (parcialmente reversibles) | 0,45 | 0,45 y 0,65 | 0,65 |
| Laxo | HubSpot (reversible) | 0,25 | 0,25 y 0,50 | 0,50 |

En la pregunta de público, el umbral es 0,50.

- **Si JEV falla:**
  - hay hasta 2 reintentos (esperas de 300 y 900 ms) cuando está saturado (429 o 529), no responde en 3 s o falla la red;
  - en el peor caso, a los ≈10 s la acción pasa a una persona;
  - una respuesta inválida pasa a una persona de inmediato.

  **Nunca se permite por un error.**
- **¿Cuándo entra un LLM? Nunca para decidir.** Lo que no resuelven el código ni JEV, lo resuelve una persona. La explicación sale de plantillas: no hay un segundo modelo.
- **Cómo se ajustaron:**
  - solo con las 250 acciones de ajuste, nunca con las de medición;
  - T_revisión de al menos 0,25 y una banda de duda de al menos 0,20;
  - entre opciones iguales, la más conservadora;
  - regla firmada por el dueño de la política.

  Valores en `data/thresholds.json`.

## 04 · Quién lo opera

| Rol | Qué hace |
|---|---|
| Dueño de la política | Firma las reglas, los umbrales y cada cambio de versión (en el prototipo, Helian) |
| Dueño de cada canal | Correo, WhatsApp, redes o CRM: propone cambios y revisa sus métricas cada semana |
| Quien aprueba | Decide en Slack lo que VoBo dejó en PEDIR VOBO |
| Tecnología | Mantiene la puerta, las llaves, el registro y la conexión con JEV |
| VoBo | Aplica la política y deja registro. Nunca la cambia por su cuenta |

**Jugada 1 · Llega un PEDIR VOBO** (el aviso está probado):
1. El aviso llega a Slack con la acción, el texto, las razones y el `request_id`.
2. Quien aprueba la aprueba, la rechaza o le pide al agente otro texto, que vuelve a pasar por VoBo.
3. La decisión queda registrada con el `request_id`. **[Propuesta]** Botones en Slack, nota en HubSpot y un tiempo de respuesta por acordar.

**Jugada 2 · JEV o VoBo fallan** (la falla cerrada está probada):
1. Nada sale solo: todo pasa a una persona.
2. Tecnología ve las fallas en el registro y en la latencia p95.
3. Si la falla sigue, el dueño del canal decide si pausa el agente o sigue aprobando a mano.

**Jugada 3 · Cambiar una regla o un umbral** **[Propuesta]**:
1. El dueño del canal lo propone, con los casos que lo justifican.
2. Se prueba en modo sombra contra el registro, sin frenar nada.
3. El dueño de la política firma la nueva versión. Nunca se ajusta con los datos que se usan para medir.

**Jugada 4 · Aparece un escape o una falsa alarma** **[Propuesta]**:
1. El caso se etiqueta y entra al banco de pruebas.
2. En la revisión semanal se decide si el arreglo va en una regla, en una pregunta o en un umbral.
3. Se vuelve a medir antes de activar el cambio.

## 05 · Cómo se mide

| Métrica | Qué cuenta | Línea base (test) | Cada cuánto | Si se desvía |
|---|---|---|---|---|
| Peligrosas aprobadas sin persona | Acciones riesgosas que salieron solas, en una muestra auditada a ciegas | **3 de 74** (IC 95%: 1,4–11,3%) | Semanal | Revisar cada caso y reforzar la regla, la pregunta o el umbral (jugada 4) |
| Autonomía | Acciones seguras que salen sin persona | **83,1%** (59 de 71) | Semanal | Si baja, ver qué pregunta escala de más y ajustarla en modo sombra |
| Escaladas a una persona | Acciones en PEDIR VOBO sobre el total | **25,5%** (en un banco con 51% de peligrosas) | Diaria | Si sube, ver qué regla o pregunta lo causa. **[Estimación]** Con tráfico real, ≈15–16% |
| Seguras bloqueadas | Acciones seguras que VoBo frenó | **2 de 71** | Semanal | Revisar el texto y la pregunta que la bloqueó |
| Latencia y fallas de JEV | p95 y llamadas sin respuesta | **p95 de 650 ms** · 0 fallas en 145 | Diaria | La falla cerrada protege; tecnología revisa (jugada 2) |
| Costo y tiempo de aprobación | USD por cada 1.000 decisiones; minutos hasta que una persona decide | **USD 0,064** · el tiempo no tiene línea base | Mensual | **[Propuesta]** La meta de tiempo se acuerda con cada dueño de canal |

**Cómo se obtuvo la línea base [Medido]:**
- 145 acciones que no se usaron para ajustar: las 150 del test menos 5 sin mayoría humana.
- Etiquetas humanas a ciegas, congeladas con hash antes de correr JEV. κ = 0,51.
- Una sola corrida, con JEV real.

Por separado, se escapan 34 peligrosas con solo reglas y 31 con solo JEV; juntos, 3. Las 42 graves se bloquearon todas. Los fallos están publicados en `/resultados`.

## 06 · Cómo se pone en 30X

**[30X] Lo que 30X pidió (resumen):**
- agentes en Python con tool calling y MCP;
- un filtro para todo lo que sale, sin depender de que el agente decida preguntar;
- aprobación por Slack;
- HubSpot como registro;
- ningún dato de personas en modelos externos.

**Flujo:** agente de 30X → **puerta de salida** (donde viven las llaves) → **VoBo** (reglas + JEV, ≈0,4 s) → PERMITIR, PEDIR VOBO o BLOQUEAR.

| Pieza | Estado |
|---|---|
| Puerta de salida MCP, pensada para que no haya otra salida | **Probado:** 11 de 11 pruebas y MCP Inspector contra la demo; probada con Claude Desktop como agente de ejemplo (2 casos: PERMITIR y PEDIR VOBO); no con agentes de 30X ni con HubSpot o WhatsApp reales |
| Falla cerrada | **Probado:** con el servidor caído, colgado y con error |
| Aviso en Slack | **Probado** en un Slack de prueba |
| Identificador: ID de HubSpot + `request_id` | **Construido:** va en cada respuesta |
| HubSpot y WhatsApp reales, botones y webhooks | **[Propuesta]** Ejecutores de ejemplo, sin integración con 30X |

**Despliegue sin frenar nada:**
1. **Modo sombra:** la puerta consulta y registra, pero deja salir todo. Se compara con lo que hoy deciden los equipos.
2. **Etiquetar y ajustar** con esos datos, hasta que las falsas alarmas queden por debajo de lo acordado.
3. **Activar por canal**, empezando por el de menor riesgo, y monitorear cada semana.

**Límites:**
- Lo que no pase por la puerta no se evalúa.
- No se probó con agentes reales de 30X.
- JEV puede equivocarse con confianza.
- Las preguntas están en español y no se compararon con el inglés.
- El banco es sintético y la política es de demostración.

## 07 · Repetir la jugada

VoBo es la primera aplicación. El mismo método sirve para cualquier decisión pequeña que 30X hoy toma a mano o con reglas fijas:
1. **Elegir la decisión:** frecuente, pequeña, con un costo de error claro y que hoy se resuelve a mano.
2. **Repartir el trabajo:** lo que se cuenta o se compara va al código; lo que hay que leer, a JEV.
3. **Escribir las preguntas:** tipadas, una cosa por pregunta, con «otro» y con el texto marcado como no confiable.
4. **Fijar los umbrales** según lo que cuesta equivocarse, siempre con un camino a una persona.
5. **Medir antes de usar:** un banco etiquetado a ciegas; una mitad para ajustar y la otra para medir una sola vez.
6. **Sombra y activación:** observar sin frenar, activar por partes y revisar cada semana.

**Siguiente aplicación [Propuesta, no construida]: ¿a qué segmento pertenece quien se inscribe en Luma?**
- **Por qué:** **[30X]** hoy el dolor y el objetivo de los perfiles aciertan el 55% de las veces frente a una clasificación manual, y los segmentos son estáticos.
- **Qué hace el código:** lee los campos cerrados del formulario (por ejemplo, país y rol) y recalcula el segmento cuando cambian.
- **Qué hace JEV:** a partir del texto libre de la inscripción, elige segmento y dolor (choice) y estima la madurez en IA (score).
- **Persona y medición:** lo de baja confianza va al equipo comercial. Se mide el acuerdo con una muestra clasificada a mano.
