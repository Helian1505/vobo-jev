# Cómo integrar VoBo con un agente

VoBo es un servicio HTTP: el agente le manda la acción que quiere hacer y VoBo responde **PERMITIR**, **PEDIR VOBO humano** o **BLOQUEAR**, con el porqué. Este documento explica el contrato, tres formas de conectarlo, qué pasa cuando algo falla y qué no hicimos.

> **Alcance.** Todo lo de aquí describe VoBo y ejemplos genéricos. No afirmamos nada sobre los sistemas reales de 30X (su CRM, su herramienta de correo o su orquestador): el adaptador de CRM y el agente de ejemplo son eso, ejemplos. Los números de latencia y costo salen del banco de pruebas sintético.

## 1. El contrato

`POST /api/evaluate` · `Content-Type: application/json` · demo pública: `https://vobo-jev.vercel.app/api/evaluate`

### Petición

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `tipo_accion` | `correo_masivo` · `whatsapp_masivo` · `publicacion_redes` · `crm_update` | sí | |
| `canal` | texto | sí | Los oficiales son `correo_oficial`, `whatsapp_oficial`, `instagram_oficial`, `linkedin_oficial` y `crm`. |
| `destinatarios` | entero ≥ 0 | sí | `0` en publicaciones de redes. En `crm_update`, cuántos contactos toca el cambio. |
| `segmento_declarado` | `founders` · `ejecutivos` · `equipos_tecnicos` · `estudiantes` · `comunidad_general` | sí | |
| `hora_envio` | `HH:MM` (24 h, hora de Bogotá) | sí | |
| `texto` | texto, máximo 2.000 caracteres | sí | El contenido. En `crm_update`, el valor que se escribe. |
| `id` | texto | no | Tu identificador de la acción; vuelve en el webhook. |
| `campo_crm` | texto | no | Solo en `crm_update`. |
| `fecha_evento_real` / `fecha_en_texto` | `AAAA-MM-DD` / texto | no | Si vienen las dos, el código las compara. |
| `precio_en_texto_usd` | número | no | Si viene, el código lo compara con el catálogo. |
| `en_lista_de_bajas` | entero | no | Cuántos destinatarios pidieron no recibir más mensajes. |
| `programa_ofrecido`, `audiencia_id`, `perfil_id` | texto | no | Ver `docs/BASE_CONOCIMIENTO_30X.md`. La afinidad de la audiencia la calcula el servidor desde `audiencia_id`: si la mandas, se ignora. |

Las cosas que se pueden resolver con código (contar, comparar fechas y precios, la lista de bajas) las decide el código y **no** se le pasan a JEV; a JEV solo le llega el `texto`.

### Respuesta (200)

| Campo | Qué es |
|---|---|
| `schema_version` | Versión del contrato. Hoy `"1"`. Solo cambia si se **rompe o se quita** un campo; agregar campos no la cambia. |
| `request_id` | UUID de esta solicitud (también en el encabezado `x-request-id`). Guárdalo: es lo que correlaciona la decisión con tu registro y con el webhook. |
| `decision` | `ALLOW` (PERMITIR), `REVIEW` (PEDIR VOBO) o `BLOCK` (BLOQUEAR). Es el más severo entre `piso_reglas` y `riesgo_jev`. |
| `piso_reglas`, `reglas` | Lo que decidió el código y cada regla que se activó, con su detalle. |
| `riesgo_jev`, `senales_jev`, `jev_estado` | Lo que opinó JEV: una señal por pregunta, con su probabilidad. `jev_estado` es `ok`, `fallo` (JEV no respondió: el riesgo pasa a `REVIEW`) u `omitido`. |
| `explicacion` | `titular` y `razones`, en español, de mayor a menor severidad. Texto fijo, no generado por un modelo. |
| `perfil`, `reversibilidad` | Con qué umbrales se evaluó: `estricto` (irreversible), `normal` (parcial) o `laxo` (reversible). |
| `jev_simulado` | `true` si respondió el JEV simulado (solo pruebas). Ninguna métrica sale de ahí. |
| `traza` | Modelo, `latencia_ms`, `input_tokens`, `costo_usd`, llamadas y las respuestas crudas de JEV. |

Los clientes deben **ignorar los campos que no conocen** y tratar un `schema_version` desconocido como una falla (ver §3).

### Errores

| HTTP | Cuándo | Cuerpo |
|---|---|---|
| 400 | JSON roto o acción inválida | `{ "error", "detalles": [...] }` |
| 429 | Más de 20 solicitudes por minuto desde la misma IP (límite de la demo pública) | `{ "error" }` |
| 503 | El modo es `live` y falta la llave de JEV en el servidor | `{ "error" }` |

### Un ejemplo real

Petición (un correo a 7.500 personas que promete resultados):

```json
{
  "id": "campana-nov-001",
  "tipo_accion": "correo_masivo",
  "canal": "correo_oficial",
  "destinatarios": 7500,
  "segmento_declarado": "comunidad_general",
  "hora_envio": "10:00",
  "programa_ofrecido": "AI Sales",
  "texto": "Inscríbete hoy en AI Sales: duplicarás tus ventas, resultado garantizado."
}
```

Respuesta, capturada con JEV real (`jev-1.14.0`). Se recortaron `traza.respuestas_crudas` y el `detalle` de cada señal para que quepa; todo lo demás es tal cual salió:

```json
{
  "schema_version": "1",
  "request_id": "13ab2ca9-4555-47b4-b6a0-f9e7e900fa3d",
  "decision": "BLOCK",
  "modo": "combinado",
  "piso_reglas": "REVIEW",
  "reglas": [
    { "regla": "audiencia_grande", "decision": "REVIEW", "detalle": { "n": 7500, "umbral": 5000 } }
  ],
  "riesgo_jev": "BLOCK",
  "senales_jev": [
    { "id": "promesa", "decision": "BLOCK", "estado": "alerta", "prob": 0.99, "opcion": "explicita", "confianza": 0.99, "detalle": "{ … }" },
    { "id": "certificacion", "decision": "ALLOW", "estado": "ok", "prob": 0.02, "detalle": {} },
    { "id": "datos_personales", "decision": "ALLOW", "estado": "ok", "prob": 0, "opcion": "ninguno", "confianza": 1, "detalle": "{ … }" },
    { "id": "instruccion_agente", "decision": "ALLOW", "estado": "ok", "prob": 0.11, "detalle": {} },
    { "id": "afirmacion", "decision": "REVIEW", "estado": "alerta", "prob": 1, "opcion": "sin_respaldo", "confianza": 1, "detalle": "{ … }" },
    { "id": "tono", "decision": "REVIEW", "estado": "duda", "prob": 0.94, "opcion": "sensacionalista", "confianza": 0.92, "detalle": "{ … }" }
  ],
  "jev_estado": "ok",
  "jev_simulado": false,
  "perfil": "estricto",
  "reversibilidad": "irreversible",
  "explicacion": {
    "titular": "BLOQUEAR: JEV estima un 99% de probabilidad de que el texto garantice un resultado.",
    "razones": [
      "JEV estima un 99% de probabilidad de que el texto garantice un resultado.",
      "Va a 7.500 destinatarios; por encima de 5.000 se pide VoBo humano.",
      "JEV estima un 100% de probabilidad de que el texto haga afirmaciones de impacto sin respaldo.",
      "JEV no está seguro (94%) de que el texto sea sensacionalista o alarmista; lo revisa una persona."
    ]
  },
  "traza": {
    "modelo": "jev-1.14.0",
    "latencia_ms": 669,
    "input_tokens": 1526,
    "costo_usd": 0.000064092,
    "llamadas": 1,
    "respuestas_crudas": "{ …omitido en este documento… }"
  }
}
```

Fíjate en que las reglas por sí solas habrían dicho PEDIR VOBO (audiencia grande); fue JEV quien lo subió a BLOQUEAR por la promesa. **JEV solo puede subir el riesgo, nunca bajarlo.** (La señal de «segmento» no aparece porque se declaró `comunidad_general`, que se omite.)

## 2. Tres patrones para conectarlo

### A. Herramienta previa a la acción

Cada herramienta del agente (enviar correo, actualizar CRM, publicar) pasa por una función que consulta a VoBo antes de ejecutar. Es el patrón más simple y el que muestra `examples/agente-demo.ts`:

```ts
async function conVobo(accion, ejecutar) {
  const v = await consultarVobo(accion);          // POST /api/evaluate; nunca lanza, falla cerrado
  if (v.decision === "PERMITIR")   return ejecutar();                 // ejecuta
  if (v.decision === "PEDIR VOBO") return cola.encolar(accion, v.motivo, ejecutar); // espera a una persona
  return abortar(accion, v.motivo);                                   // BLOQUEAR
}
```

```bash
npm run dev                  # en otra terminal, o BASE_URL=https://vobo-jev.vercel.app
npm run agente-demo          # 5 casos de data/ejemplos_demo.json y una tabla con el resultado
```

### B. Middleware o proxy delante del sistema

Si no controlas el código del agente pero sí el punto por donde pasan sus cambios (un CRM que avisa de cada cambio, un proxy delante de una API de correo), pones un pequeño servicio que traduce el evento a una acción de VoBo, consulta, y deja pasar, retiene o revierte. `adapters/crm-webhook.ts` muestra la traducción de un webhook genérico `deal.updated`:

```ts
const accion = mapearDealUpdated(payloadDelCrm);   // → AccionAgente
const veredicto = await consultarVobo(accion);      // el mismo contrato de arriba
```

Está rotulado como ejemplo: el mapeo real depende del stack de cada empresa.

### C. Un paso dentro de un flujo

En cualquier orquestador de flujos (automatizaciones, colas de tareas, agentes con grafos), VoBo es un paso de «llamada HTTP» seguido de una bifurcación sobre `decision`: la rama `ALLOW` continúa, la `REVIEW` crea una tarea para una persona y la `BLOCK` termina el flujo y registra el `request_id`. Lo único que hay que cuidar es que **cualquier resultado que no sea un 200 válido siga la rama `REVIEW`** (ver §3).

## 3. Falla cerrada

Regla única: **si no hay una respuesta válida de VoBo, la acción no se ejecuta sola: se trata como PEDIR VOBO.** Un error nunca debe equivaler a PERMITIR.

| Qué pasa | Decisión efectiva |
|---|---|
| 200 con `schema_version: "1"` y `decision: "ALLOW"` | PERMITIR |
| 200 con `decision: "REVIEW"` | PEDIR VOBO |
| 200 con `decision: "BLOCK"` | BLOQUEAR |
| 200 con `jev_estado: "fallo"` (JEV no respondió; el servidor ya subió el riesgo a `REVIEW`) | PEDIR VOBO |
| Red caída, tiempo agotado, 5xx, 429, 503 | PEDIR VOBO |
| 400 (la acción está mal armada: es un error del agente) | PEDIR VOBO, y se registra para corregirlo |
| Cuerpo que no es JSON, `decision` inesperada o `schema_version` que el cliente no conoce | PEDIR VOBO |

`examples/agente-demo.ts` implementa exactamente esta tabla; lo comprobamos apuntándolo a un servidor caído, a uno que responde 500, a uno que se cuelga, a uno que devuelve otro `schema_version` y a uno que devuelve HTML, y en todos esos casos las acciones quedaron en la cola en lugar de ejecutarse.

## 4. Latencia y costo (medidos)

Sobre las 145 acciones del conjunto principal del test, con JEV real (`jev-1.14.0`):

| | |
|---|---|
| Latencia de la evaluación (p50 / p95) | **399 ms / 650 ms** |
| Tokens de entrada por decisión | 1.534 (en promedio) |
| Costo por decisión | USD 0,0000645 |
| **Costo por 1.000 decisiones** | **≈ USD 0,064** |

Una sola llamada a JEV responde las 7 preguntas. Esas cifras se midieron desde un computador de desarrollo; desde la instancia desplegada en Vercel, una corrida de la simulación (20 acciones, una sola muestra, JEV real) dio una latencia media de JEV de 97 ms. La latencia depende de dónde corra VoBo. Dos matices honestos:

- La **primera** llamada real que hicimos tardó 6,1 s, probablemente un arranque en frío; las siguientes, entre 289 y 655 ms. Cada llamada a JEV tiene un tiempo límite de 3 s y hasta 2 reintentos, así que **en el peor caso el servidor tarda unos 10 s antes de rendirse** y devolver `jev_estado: "fallo"`. Por eso el cliente de ejemplo usa un tiempo límite de 5 s (`VOBO_TIMEOUT_MS`) y, si se agota, falla cerrado.
- El límite de 20 solicitudes por minuto por IP es de la **demo pública**. Para tráfico real hay que desplegar tu propia instancia y definir tus límites.

## 5. Modo sombra

Antes de dejar que VoBo frene algo, pon al agente en modo sombra: consulta a VoBo en cada acción, **registra** lo que habría decidido, y ejecuta igual. Así mides sin riesgo cuántas acciones habría escalado y cuántas habría bloqueado.

```bash
VOBO_SOMBRA=1 npm run agente-demo      # ejecuta todo y muestra la decisión que VoBo habría tomado
```

El camino recomendado es el que sigue la hoja de ruta del README: **sombra → etiquetar lo que escala → ajustar los umbrales con esos datos → aplicar → monitorear.** Guarda el `request_id` de cada decisión junto a tu registro: es lo que permite etiquetar después y comparar. Todo lo medido en el banco de pruebas es sintético; los umbrales de VoBo están ajustados a ese banco, no a tu tráfico.

## 6. Webhook de revisión (opcional)

Si defines `VOBO_REVIEW_WEBHOOK_URL`, cada vez que una acción queda en PEDIR VOBO o BLOQUEAR, VoBo envía un `POST` JSON a esa URL:

```json
{
  "request_id": "13ab2ca9-4555-47b4-b6a0-f9e7e900fa3d",
  "decision": "BLOCK",
  "tipo_accion": "correo_masivo",
  "id": "campana-nov-001",
  "explicacion": { "titular": "…", "razones": ["…"] },
  "reglas": [ { "regla": "audiencia_grande", "decision": "REVIEW", "detalle": { "n": 7500, "umbral": 5000 } } ]
}
```

Va **después** de responder (con `after()` de Next.js), tiene un tiempo límite de 2 s, no se reintenta y nunca bloquea ni cambia la respuesta: si el destino está caído o lento, la respuesta es la misma. Sin la variable no hace nada. Lleva el encabezado `x-vobo-request-id`. Sirve para avisar a una persona; no sustituye a una cola de aprobación (ver §7).

## 7. Lo que no hicimos

- **Autenticación por clave.** El endpoint es abierto: no hay claves de API, cuotas por cliente ni identidad de quien llama. Solo hay un límite por IP, en memoria (en Vercel cada instancia lleva su propia cuenta, así que es de mejor esfuerzo). Para producción hace falta una clave por integración, o poner VoBo detrás de tu propia puerta de enlace.
- **Una cola de aprobación real.** La cola del ejemplo vive en memoria del proceso y la página `/cola` de la demo guarda su estado solo en el navegador. El webhook avisa, pero nada recibe la aprobación y reanuda la acción de forma persistente. Eso lo tiene que poner quien integre (un sistema de tareas, un tablero de aprobaciones).
- **Garantías de entrega del webhook:** no hay firma (HMAC), reintentos, ni orden garantizado; la entrega es «a lo más una vez».
- **Registro de decisiones.** VoBo no guarda nada: quien integra debe guardar el `request_id` y la decisión si necesita auditoría.
- **El stack real de 30X.** No conocemos ni integramos su CRM, su herramienta de correo ni su orquestador. El adaptador de CRM y el agente son ejemplos; el mapeo real tiene que escribirse contra los sistemas reales.
- **Tráfico real.** Solo lo probamos con el banco sintético y unos pocos casos de la demo; no hicimos pruebas de carga.
- **Una política propia.** La política es de demostración (`data/policy_demo.json`, con supuestos por confirmar con 30X) y los umbrales se ajustaron con el banco sintético.
