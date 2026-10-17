# VoBo — el visto bueno antes de que un agente actúe

**VoBo es una compuerta de políticas para los agentes internos de 30X.** Revisa cada acción que propone un agente (correo masivo, WhatsApp masivo, publicación en redes, cambio en el CRM) y responde **PERMITIR**, **PEDIR VOBO humano** o **BLOQUEAR**, siempre con el porqué. Las reglas las aplica el código; **JEV** (el modelo de TypeSafe) opina en milisegundos y solo puede subir el riesgo; ante la duda o un fallo, decide una persona.

Proyecto del equipo VoBo para el Hackathon 30X (reto JEV), 16–18 oct 2026.

- **Demo:** https://vobo-jev.vercel.app/ (usa JEV real, `jev-1.14.0`)
- **Resultados del banco:** https://vobo-jev.vercel.app/resultados
- **Simulación en vivo:** https://vobo-jev.vercel.app/simulacion (un agente propone acciones una tras otra y VoBo decide cada una, con contadores y costo acumulado) y **cola de VoBo humano:** https://vobo-jev.vercel.app/cola (demostración: el estado vive solo en el navegador)
- **Cómo integrarlo:** [`docs/INTEGRACION.md`](docs/INTEGRACION.md): un paso de compuerta dentro de los flujos de n8n (`integraciones/n8n/`), un envoltorio de Python como complemento (`integraciones/python/`), la falla cerrada, lo que es solo diseño y los límites

![VoBo bloquea una acción con promesa de resultados: la decisión, las razones y las respuestas de JEV con su probabilidad](docs/assets/demo-bloquear.jpg)

---

## 1. El problema

30X convierte un embudo gratuito grande (clases abiertas, bootcamps, newsletters y comunidad) en programas de pago. Cada agente que toca ese embudo, sea para enviar un correo, escribir en WhatsApp, cambiar el CRM o publicar, puede dañar la reputación, la entregabilidad o los datos de la base. Según su página de empleo, en 30X «todos crean agentes» [Público].

Qué tan grande es la base y qué tan difícil es convertir en ella (muestra anónima que compartió 30X, [30X]):

| Dato | Cifra |
|---|---|
| Contactos en la base real | unos **32.300**: ≈ 24.800 con deal en el CRM y ≈ 7.500 leads sin deal |
| Deals que siguen «en proceso» | **83%** (248 de los 298 deals de la muestra) |
| Conversión de deal a pago | **3,4%** (10 de 298; IC 95%: 1,8–6,1%) |

Con ese embudo, un mensaje equivocado enviado en masa cuesta reputación en un lugar donde convertir ya es difícil. Además, Gmail exige a quien envía más de 5.000 correos al día una tasa de spam menor a 0,3% [Público, requisitos de Google para remitentes masivos]; con 32.300 contactos, un envío a la base completa cruza ese umbral.

Fuentes y matices de cada cifra: [`docs/BASE_CONOCIMIENTO_30X.md`](docs/BASE_CONOCIMIENTO_30X.md).

## 2. Cómo funciona

```mermaid
flowchart LR
  A["Acción que propone el agente"] --> R["Capa 1 · Reglas duras (código)"]
  A --> J["Capa 2 · JEV: 7 preguntas tipadas en 1 llamada"]
  R -- "piso de reglas" --> C["Capa 3 · riesgo final = max(piso, JEV)"]
  J -- "riesgo según JEV" --> C
  C --> P["PERMITIR"]
  C --> V["PEDIR VOBO humano"]
  C --> B["BLOQUEAR"]
  J -. "fallo o duda" .-> V
```

**Principio de diseño:** JEV opina, el código autoriza y una persona decide los casos dudosos.

1. **Capa 1, reglas duras (TypeScript).** Canal no oficial, destinatarios en la lista de bajas, campos protegidos del CRM, etapa «Ganado», audiencias de más de 5.000 personas, horario de envío, fecha y precio que no coinciden con los del evento o el catálogo, y ofertas pagas a audiencias de baja afinidad. Es idéntica, fila por fila, a una referencia en Python en las 400 acciones del banco (`tests/rules.parity.test.ts`).
2. **Capa 2, JEV.** Una sola llamada con 7 preguntas simples: promesa de resultados, certificación, datos personales de terceros, instrucción a un agente (inyección), afirmaciones sin respaldo, público y tono. Lo que se puede resolver con código (contar, comparar fechas y precios, la lista de bajas) **no** se le pregunta a JEV.
3. **Capa 3, combinador y explicación.** El riesgo final es el más severo entre el piso de reglas y lo que dice JEV, con umbrales más estrictos para lo irreversible. **Un fallo de JEV nunca resulta en PERMITIR:** pasa a una persona. La explicación sale de plantillas fijas sobre los datos, no de un modelo de lenguaje.

La política (`data/policy_demo.json`) es de demostración, con supuestos; no es la política real de 30X.

## 3. Por qué JEV

- **Decide, no conversa:** cada pregunta devuelve una respuesta tipada con su probabilidad (`noul`, `choice`, `score`). Eso permite umbrales, escalar la duda y explicar el «cuánto».
- **Una llamada responde las 7 preguntas.** En el test: latencia **p50 de 399 ms y p95 de 650 ms**, con 1.534 tokens de entrada por decisión.
- **Costo:** USD 0,042 por millón de tokens de entrada y la salida es gratis. Medido: **≈ USD 0,064 por 1.000 decisiones**.
- Esa combinación (milisegundos y fracciones de centavo) es lo que permite poner la compuerta delante de *cada* acción de *cada* agente.

## 4. Resultados del banco

400 acciones sintéticas, 250 para ajustar (dev) y 150 para medir (test). **El test se corrió una sola vez, con JEV real (`jev-1.14.0`), y se reporta tal cual.** Conjunto principal: las 150 del test sin las 5 sin mayoría humana (145 acciones: 74 peligrosas y 71 seguras).

| Modo | Peligrosas aprobadas sin persona (meta: 0) | Autonomía | Escaladas a persona | Sobre-bloqueo | Severidad subestimada |
|---|---|---|---|---|---|
| Solo reglas | 34 de 74 | 100% | 17,9% | 0 de 71 | 2 de 42 |
| Solo JEV | 31 de 74 | 83,1% | 15,2% | 2 de 71 | 3 de 42 |
| **Combinado (VoBo)** | **3 de 74** | **83,1%** | **25,5%** | **2 de 71** | **0 de 42** |

- **Lo que aporta JEV:** de las 34 peligrosas que las reglas solas dejan pasar, el combinado atrapa 31.
- **La meta de cero no se cumplió:** 3 de 74 peligrosas se aprobaron sin persona (4,1%; IC 95%: 1,4–11,3%); en el conjunto completo son 4 de 79. Son textos de apariencia inocua que una persona etiquetó «PEDIR VOBO»; tres de los cuatro los etiquetó un solo revisor. No afirmamos que esas etiquetas estén mal. Cada uno aparece con su texto en [`/resultados`](https://vobo-jev.vercel.app/resultados).
- **Autonomía:** el 83,1% de las acciones seguras pasa sin molestar a nadie (IC 95%: 72,7–90,1%).

![Matriz de confusión del combinado](docs/assets/resultados-matriz.jpg)

Con 150 casos, cada error mueve las métricas cerca de 0,7 puntos: es una demostración, no estadística sólida. La exactitud de la capa de reglas es una prueba unitaria; la evidencia real es lo que aporta JEV.

## 5. Integridad del resultado

- **Banco ciego:** las 400 acciones se publicaron sin la decisión correcta. Las 150 del test y 76 del dev las etiquetaron personas del equipo sin ver la propuesta de diseño (acuerdo entre revisores: κ = 0,51, moderado; [`docs/REVISION_HUMANA.md`](docs/REVISION_HUMANA.md)); las otras 174 del dev usan la propuesta de diseño tal cual, por eso el dev no se usa para reportar.
- **División dev/test por plantillas:** los textos del test usan plantillas distintas a las del dev, así que se mide generalización y no memoria.
- **Etiquetas congeladas con hash** (SHA-256 en [`eval/FREEZE.md`](eval/FREEZE.md)). Hubo una corrección (v1.1) de 7 filas antes de correr JEV sobre el banco; está declarada allí, con su sesgo.
- **Umbrales ajustados solo con dev** (`data/thresholds.json`). Después de ver el test no se reajustó nada.
- **Corrida única del test:** el script se niega a repetirla si existe [`eval/runs/TEST_LOCK.json`](eval/runs/TEST_LOCK.json), que registra el commit, el modelo y los hashes de etiquetas y umbrales.
- **Cero métricas con JEV simulado:** el mock sirve para pruebas y para la demo sin red, y la interfaz lo marca siempre como «JEV SIMULADO».
- Las decisiones que se apartaron del plan original están en [`docs/DESVIACIONES.md`](docs/DESVIACIONES.md).

## 6. Límites honestos

- **Las acciones son sintéticas** y la **política es de demostración** (supuestos por confirmar con 30X, p. ej. si 30X otorga certificaciones, el precio de la sesión abierta, el umbral de 5.000 destinatarios o el horario de envíos).
- **Banco pequeño:** 150 acciones en el test. Los intervalos de confianza son amplios.
- **Dev no sirve para reportar:** 174 de sus 250 etiquetas son la propuesta de diseño sin revisión humana, y los umbrales se ajustaron sobre esas mismas filas (sobreajuste posible, sobre todo en redes, con 40 filas, y CRM, con 37).
- **JEV puede equivocarse con confianza**, no sirve para contar ni comparar fechas (eso va en el código), lee literal y no trata el texto como hostil. Por eso la capa de reglas es la que autoriza.
- **Idioma:** las preguntas están en español y no medimos cuánto rinde JEV fuera del inglés; el experimento inglés frente a español quedó pendiente.
- **Latencia:** la primera llamada real tardó 6,1 s (probablemente un arranque en frío); las siguientes, entre 289 y 655 ms. Si una llamada se pasa de 3 s, se reintenta, y si falla, la acción pasa a una persona.
- **Los perfiles de 30X son una muestra con campos imprecisos:** según 30X, el rol coincide 81%, el dolor 55% y el objetivo 55% contra una clasificación manual. Sirven para ver proporciones, no para decidir sobre una persona.
- **Pruebas que no se hicieron:** detector determinista de inyección y prueba del orden de opciones (ambos opcionales).

### Datos y conocimiento

| Qué | Origen |
|---|---|
| Banco de 400 acciones (`data/banco_acciones_v1_ciego.csv`) | **Sintético**, escrito por el equipo |
| 697 perfiles (`data/perfiles_30x.csv`) | **Real y anónimo**, compartido por 30X para el reto: solo categorías, sin nombres, correos ni texto libre |
| Programas, etapas del CRM y cifras del embudo | De esos perfiles y de fuentes públicas; cada dato con su fuente en [`docs/BASE_CONOCIMIENTO_30X.md`](docs/BASE_CONOCIMIENTO_30X.md) |
| Etiquetas (`data/etiquetas_v1.csv`) | Revisión humana del equipo (test y 76 filas de dev); 174 filas de dev son la propuesta de diseño |

Nunca se presenta un perfil como una persona con nombre. El diseño visual sigue el de 30X ([`docs/DESIGN_30X.md`](docs/DESIGN_30X.md)).

## 7. Cómo correrlo

Requiere Node 20 o superior.

```bash
npm install
cp .env.example .env.local      # y pega tu llave en TYPESAFE_API_KEY (nunca la subas)
npm run dev                     # demo en http://localhost:3000
npm test                        # 140+ pruebas, incluida la paridad con la referencia en Python
npm run verify-freeze           # comprueba que las etiquetas congeladas no cambiaron
npm run bench -- --split dev --mode live    # corre el banco dev con JEV real
npm run tune                    # propone umbrales usando solo dev (no hace llamadas nuevas)
npm run agente-demo             # agente simulado con VoBo delante de sus herramientas (patrón complementario; ver docs/INTEGRACION.md)
npm run test:python             # pruebas del envoltorio de Python contra un servidor falso
```

Variables de entorno (`.env.example`):

| Variable | Qué hace |
|---|---|
| `TYPESAFE_API_KEY` | Llave de TypeSafe. Solo vive en el servidor; nunca se expone al navegador. |
| `JEV_MODEL` | Modelo fijo, `jev-1.14.0` (no se usa `jev-latest`: los alias se mueven). |
| `VOBO_JEV_MODE` | `live` (JEV real) o `mock` (simulado, sin red). Sin definir, es `mock`. |
| `JEV_TIMEOUT_MS` | Opcional: tiempo límite por llamada (500–30000). Por defecto 3000. |
| `VOBO_REVIEW_WEBHOOK_URL` | Opcional: si existe, avisa por POST JSON cuando una acción queda en PEDIR VOBO o BLOQUEAR (ver `docs/INTEGRACION.md`). |

El banco de test no se puede volver a correr: `npm run bench -- --split test --corrida-unica` se niega si existe el candado.

## 8. Hoja de ruta

- **Modo sombra → etiquetar → ajustar umbrales → aplicar → monitorear:** poner VoBo primero al lado de un agente real sin frenarlo, etiquetar lo que escala, reajustar con datos reales y solo entonces activarlo.
- **El mismo patrón para el enrutador de prospectos.** Según 30X, el dolor y el objetivo de los perfiles aciertan 55%; JEV podría clasificar el texto libre de una inscripción, con su probabilidad, y mandar a una persona los casos dudosos.
- **Segmento de líderes comerciales:** el 16% de los roles con dato no tiene segmento propio en el banco.
- **Variantes en dev:** instrucciones en inglés frente a español, detector determinista de inyección y prueba del orden de opciones.

## 9. Equipo

Helian Fierro, Juan David Cano y Angie Tamara — equipo **VoBo**. Construido con Claude Code.
