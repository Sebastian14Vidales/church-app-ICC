# ADR-0002 — Reconciliación del drift de modelos entre `AGENTS.md §6` y `opencode.json`

- **Estado**: Aceptado
- **Fecha**: 2026-07-21
- **Custodio**: `chief-architect`
- **Tema**: Configuración del ecosistema de Agents (no feature)

## Contexto

Durante la activación inicial del ecosistema se detectó un drift de configuración
entre los dos archivos que definen a los Agents:

- `AGENTS.md §6` (tabla de roles/permisos) declaraba, en su columna "Modelo",
  identificadores heterogéneos: `GLM-5.2`, `Kimi K2.7 Code` y `MiniMax-M2.7`,
  asignando distintos modelos a `backend-engineer`, `database-engineer`,
  `auth-security-engineer`, `realtime-notif-engineer`, `frontend-engineer`,
  `devops-engineer` y `testing-engineer`.
- `opencode.json` (config runtime efectiva) asigna `opencode-go/glm-5.2` a los
  13 agents, sin excepciones.

La causa del drift es que `AGENTS.md` se redactó como especificación ideal de
capacidades por rol (cada agente "desea" un modelo orientado a su tarea),
mientras que `opencode.json` se materializó contra la oferta real del provider
`opencode-go`, donde el único modelo disponible/operativo es `glm-5.2`.

Mantener el drift mezcla dos conceptos distintos —*especificación de capacidades*
vs *configuración runtime*— y abre la puerta a:

- Interpretaciones erróneas: un subagente podría asumir que opera con un modelo
  distinto al efectivo y esperar comportamientos que no obtendrá.
- Inconsistencia documental violatoria de `AGENTS.md §10` ("todos los agentes
  leen este `AGENTS.md` + `opencode.json` al iniciar"): si ambos dicen cosas
  distintas sobre el mismo atributo, no hay fuente de verdad única.
- Dificultad para futuras delegaciones: el arquitecto no puede razonar sobre
  capacidades reales si el documento maestro no refleja el runtime.

## Decisión

**D1 — `opencode.json` es la fuente de verdad runtime; `AGENTS.md §6` refleja
el modelo efectivo del provider actual.**

Se alinea la columna "Modelo" de `AGENTS.md §6` al valor efectivo declarado en
`opencode.json`, que es `GLM-5.2` para los 13 agents. La tabla queda con un
único modelo para todo el ecosistema.

**D2 — La especialización se conserva en la columna "Dueño de área", no en el
modelo.**

Las capacidades diferenciadas por agente (backend, base de datos, auth,
frontend, etc.) se expresan vía:

- La `description` declarada en `opencode.json` por cada agente.
- El prompt/rol descrito en `AGENTS.md` (responsabilidades, lo que puede/no
  puede hacer, cuándo interviene, área de dueño).

El modelo no es el vector de especialización; el prompt y el área de dueño sí.

**D3 — Se documenta la convención para futuras incorporaciones de modelos.**

Cuando el provider `opencode-go` (o uno alternativo) ofrezca modelos
diferenciados y se quiera aprovechar una especialización real, el cambio se
gestionará así:

1. Verificar disponibilidad efectiva en el provider (no basta el nombre).
2. Actualizar `opencode.json` con el `model` correspondiente.
3. Actualizar `AGENTS.md §6` columna "Modelo" en el mismo cambio.
4. Registrar la decisión como un nuevo ADR (o amend de este si es directo).
5. Comunicar a todos los agents que el runtime cambió (vía `AGENTS.md`).

No se vuelve a introducir un valor en `AGENTS.md` que no exista en
`opencode.json`; esa regla queda como invariant del ecosistema.

## Alternativas consideradas

- **Mantener `AGENTS.md §6` con los modelos ideales y aceptar el drift**:
  descartado. Viola `AGENTS.md §10` (los dos archivos deben ser consistentes)
  y confunde a futuras lecturas.
- **Forzar los modelos ideales en `opencode.json`** (`Kimi K2.7 Code`,
  `MiniMax-M2.7`): descartado. No están disponibles en el provider `opencode-go`
  usado hoy; rompería el runtime del ecosistema.
- **Eliminar la columna "Modelo" de `AGENTS.md §6`** y dejar que solo
  `opencode.json` la defina: considerado. Se descarta porque `AGENTS.md` es el
  contrato común que todos los agentes leen al iniciar y conviene que sea
  autosuficiente; mantener la columna, alineada, no añade ruido y centraliza la
  lectura.
- **Crear una columna "Modelo deseado" separada de "Modelo runtime"**:
  descartado por sobreingeniería. Con un solo provider y un solo modelo
  disponible, dos columnas son redundantes.

## Consecuencias

### Positivas

- Fuente de verdad única y consistente entre `AGENTS.md` y `opencode.json`.
- Cualquier agente que lea `AGENTS.md §6` obtiene el mismo modelo que efectivamente
  usará en runtime.
- Reglas claras para futuros cambios de modelo (D3) sin repetir el drift.
- El contrato `AGENTS.md §10` se cumple sin excepciones.

### Negativas / trade-offs

- Se pierde (en el documento) la especialización nominal por modelo. Mitigada
  por D2: la especialización funcional se conserva en `Dueño de área` y en la
  `description` de cada agente en `opencode.json`.
- Un único modelo para todo el ecosistema puede no ser óptimo por tarea a futuro.
  Vigilado por D3: cuando el provider ofrezca variantes, el cambio es un ADR
  explícito.

### Riesgos vigilados

- Confusión de agentesSi en el futuro `AGENTS.md §6` se vuelve a desalinear con
  `opencode.json` → el `chief-architect` debe reconciliar de inmediato
  (invariant D3).
- Asunción de capacidades de modelos ausente → mitigado por D2: el prompt
  describe el comportamiento esperado; el modelo lo ejecuta dentro de sus
  capacidades reales.

## Cambios aplicados en este ADR

- `docs/adr/0002-reconcile-models-drift.md` — este archivo.
- `AGENTS.md §6` — columna "Modelo" unificada a `GLM-5.2` (todos los agents).
  Sin otro cambio en la tabla; "Dueño de área" y "Puede editar código" se
  conservan intactos.

## Apertura de excepciones temporales

Ninguna. Este ADR no declara excepciones a `AGENTS.md`.

## Referencias

- `AGENTS.md §6` (roles y permisos del ecosistema).
- `AGENTS.md §10` (mecanismo de coordinación: lectura común de archivos).
- `opencode.json` (config runtime del ecosistema).