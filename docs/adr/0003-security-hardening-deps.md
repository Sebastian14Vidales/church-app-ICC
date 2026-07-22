# ADR-0003 — Hardening de seguridad transversal (`helmet` + `express-rate-limit`)

- **Estado**: Aceptado
- **Fecha**: 2026-07-22
- **Custodio**: `chief-architect`
- **Tema**: Seguridad / hardening transversal (no feature de negocio)
- **Apertura delegada por**: `chief-architect` (vía ET-2 del ADR-0001)
- **Redacción técnica**: `devops-engineer`

## Contexto

`AGENTS.md §8` (Reglas de seguridad) exige explícitamente:

> - Usar rate-limiting y helmet (configurados por `devops-engineer`/`auth-security-engineer`).

No obstante, el stack listado en `AGENTS.md §2` no menciona explícitamente estas dependencias
(sólo figuraban como exigencia normativa en §8, no como pertenencia formal al stack). El
mini-ADR presente las **introduce formalmente** al stack tecnológico del backend.

Durante el paso 6 (Auth-Security) del Plan de ejecución del ADR-0001, el
`auth-security-engineer` detectó que:

- **No existe** `helmet` instalado ni aplicado en `backend/src/server.ts`.
- **No existe** `express-rate-limit` ni ningún middleware de rate-limit aplicado a ningún router.
- `AGENTS.md §6` (regla de oro 6) prohíbe introducir dependencias nuevas sin ADR previo del
  `chief-architect`.

Por ello se abrió la **Excepción Temporal ET-2** en `docs/adr/0001-courses-history-refactor.md`
(“Rate-limit + helmet ausentes”): el `auth-security-engineer` dejó en su sitio los comentarios
`TODO[RATELIMIT-PENDING]` en `backend/src/routes/course-assignment.routes.ts` (sobre los
endpoints `POST /api/courses/assignments/:id/close` y `POST /api/courses/assignments/:id/reopen`)
con el patrón sugerido de uso, y delegó al `devops-engineer` la apertura de este mini-ADR y la
materialización de las deps.

La defensa en profundidad vigente mientras tanto descansaba en `authorizeRoles(...)` por endpoint
+ validación de estado en service; era necesaria la capa de rate-limit como *defensa adicional*
según §8.

## Decisión

### D1 — Deps nuevas en producción (`express-rate-limit`, `helmet`)

Se añaden al `backend/package.json` (bloque `dependencies`, NO `devDependencies`):

- `express-rate-limit@^8.6.0`
- `helmet@^8.3.0`

**Justificación de versiones**:

- El backend ya corre sobre **Express 5.2.1** (`backend/package.json` → `"express": "^5.2.1"`).
- `express-rate-limit` v8.x es la major actual y declara compatibilidad explícita con Express 5
  (la v7.x sugerida en el brief original queda atrás como major previo frente al Express 5 del
  proyecto). Se prefiere fijar `^8.6.0` (la última minor publicada en el momento de instalación,
  ya verificada en `node_modules`).
- `helmet` v8.x es la major actual y soporta Express 5 y Node 18+. Se fija `^8.3.0`.
- Ambas son releases estables (no betas, no alphas). No se introduce ninguna otra dep collateral
  nueva (los `/transitive` deps que instala npm no requieren ADR: son subdependencias de las
  autorizadas aquí).

Con estas deps, el stack listado en `AGENTS.md §2` queda implícitamente ampliado con
`express-rate-limit` y `helmet` para la capa backend. El `chief-architect` puede, si lo desea,
reflejarlo textualmente en `§2` en una iteración menor (no bloqueante para ET-2).

### D2 — Aplicación de `helmet()` con config por defecto en `server.ts`

En `backend/src/server.ts`:

- Se importa `helmet` from `"helmet"`.
- Se llama `app.use(helmet())` **antes** de cualquier `app.use("/api/...", router)` y antes del
  montaje de CORS/routers. Helmet aplica headers de hardening (CSP, `X-Content-Type-Options`,
  `X-Frame-Options`, `Strict-Transport-Security`, `noSniff`, etc.) con su config por defecto
  segura. No se deshabilitan defaults salvo la excepción siguiente.

**Interacción con CORS / CSP**: El proyecto sirve una API JSON pura consumida por un frontend
React (no renderiza HTML) y ya configura `cors({ origin: process.env.FRONTEND_URL })` en
`server.ts`. La API no devuelve documentos navegable por browsers, por lo que la
`contentSecurityPolicy` por defecto de helmet **no interfiere** con llamadas XHR/fetch del
frontend (no hay scripts ni styles cross-origin en las respuestas). Verificado el patrón:
CSP headers sólo aplican a respuestas con `Content-Type: text/html` en navegadores; respuestas
`application/json` no son afectadas por CSP. Por tanto **se conserva CSP por defecto** (*no se
deshabilita*), maximizando la protección de headers.

> **Nota para `chief-architect`**: si en una iteración futura el sirviera algún endpoint de
> documentación HTML_ui o un mini Dashboard servido desde Express, `helmet()`'s CSP por defecto
> podría bloquear scripts/styles inline y debería ajustarse (config específica de
> `contentSecurityPolicy.directives`). **Decisiones que requieren ratificación del
> `chief-architect`** abajo en sección homónima.

### D3 — Rate-limit general para `/api/*` (100 req/min por IP)

Se crea una instancia de `express-rate-limit` con:

```ts
const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes. Intenta más tarde." },
});
```

Se monta en `server.ts` sobre el prefijo `/api` (`app.use("/api", generalLimiter)`) **antes** de
los routers y **después** de `helmet()` y `cors()`.

**Exención de `/api/auth/*` (ver §D3bis)**: el bucket del `generalLimiter` NO incluye las rutas de
autenticación; se aplica `skip: (req) => req.originalUrl.startsWith("/api/auth")`. Detalle y
justificación en §D3bis.

**Justificación del umbral `max: 100/min por IP`**:

- Capa de *defensa en profundidad* frente a abuso/fuerza bruta, NO un límite funcional estricto.
- El frontend hace una o pocas llamadas por interacción de usuario; 100/min por IP es holgado
  para uso legítimo de un operador (paste/lists/attendances) y a la vez detecta ráfagas
  maliciosas (enumeración, brute-force de postings, scraping masivo).
- Coincide con el umbral sugerido por defecto en docs de `express-rate-limit` (15 min / 100
  adaptado a 1 min / 100 por ventana corta) y con lo propuesto en el brief del `chief-architect`.
- Acciones administrativas raras (close/reopen) reciben además el limiter **específico** de D4,
  más restrictivo.
- El umbral **se mantiene en 100/min para datos** tras la exención de auth de §D3bis: al separar
  los buckets, el tráfico de datos ya no compite con las ráfagas de boot/login del frontend, por
  lo que 100/min sigue siendo holgado para navegación legítima y restrictivo para abuso. No se
  sube a ciegas (cumple §D3bis "no subir max a ciegas").

**Exclusión de entorno de test** (ver D5).

### D3bis — Exención de `/api/auth/*` del limiter general (fix de bug de navegación)

**Estado**: Parche de bug urgente. Aceptado por `devops-engineer` en coordinación con
`chief-architect`. No requiere nuevo ADR (es la corrección de D3 dentro del mismo ADR-0003).

**Síntoma reportado**: al iniciar sesión o navegar, el `generalLimiter` ("Demasiadas solicitudes.
Intenta más tarde.") satura también `/api/auth/*`. El frontend recibe 429 sobre endpoints de auth
y, al interpretarlo como fallo de sesión, cierra la sesión involuntariamente. El usuario legítimo
no puede navegar.

**Causa raíz**: el `generalLimiter` se montaba sobre `app.use("/api", ...)` antes que cualquier
router, sin distinguir tráfico de auth de tráfico de datos. El frontend, al bootear, emite ráfagas
legítimas sobre `/api/auth/*` (login + bootstrap del AuthContext + reintentos del refresh token).
Al compartir bucket con los listados/paginación/dashboards, un operador legítimo agota los 100/min
y el interceptor del frontend cierra sesión al ver 429 en auth.

**Decisión**: `/api/auth/*` queda **fuera** del bucket del `generalLimiter`:

```ts
const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes. Intenta más tarde." },
  skip: (req) => req.originalUrl.startsWith("/api/auth"),
});
if (process.env.NODE_ENV !== "test") app.use("/api", generalLimiter);
```

**Elección de implementación (`skip` vs. reorder de routers)**: se elige `skip` con
`req.originalUrl.startsWith("/api/auth")` en lugar de reordenar el montaje (montar auth routes
antes que el limiter) por las razones siguientes:

1. **Explicitud**: la exención está **docutada en el propio middleware**; cualquier lector de
   `server.ts` ve que `/api/auth/*` no aplica rate-limit sin tener que razonar sobre el orden de
   montaje de Express.
2. **Robustez al reorder**: si un futuro refactor monta otro router antes/después del limiter, la
   exención se preserva por `skip`, no depende de un orden de mounts frágil.
3. **`req.originalUrl` (no `req.path`)**: Express "strips" el mount path de `req.path` para el
   middleware montado en `/api` (p. ej. `/auth/login` en vez de `/api/auth/login`); usar
   `originalUrl` evita el bug sutil de comparar `/auth` vs `/api/auth` y es insensible a futuros
   cambios de prefijo de montaje.
4. **Mantenibilidad**: añadir/quitar rutas de auth al prefijo `/api/auth/*` no requiere tocar el
   limiter — basta con que sigan bajo ese prefijo, que ya es la convención del repo.

**No se elimina el limiter** (sigue siendo defensa en profundidad sobre `/api/*` de datos) y **no
se sube `max` a ciegas**: con el bucket de auth separado, 100/min para datos sigue siendo
razonable (ver justificación de umbral en §D3). Si el `product-owner`/UAT detecta throttling real
en flujo batch de datos, se ajusta en iteración menor.

**Mantenimiento del bypass de test** (D5): el `skip` de auth **se aplica también en test**, pero
como en `NODE_ENV === "test"` el `generalLimiter` no se monta en absoluto (guard `NODE_ENV !==
"test"`), el `skip` de auth es no-op en tests. No rompe los smoke tests actuales ni futuros e2e.

**Backlog derivado (NO parte de este fix — fuera de scope)**:

- **Limiter específico de login/brute-force** sobre `POST /api/auth/login` (p. ej. `max: 10/min`
  por IP+identifier, con `express-slow-down` como complemento opcional). Dominio del
  `auth-security-engineer`. Queda registrado como futura defensa específica de auth; no se instala
  en este fix para no cambiar contrato ni exceder scope.
- **Limiter específico de close/reopen** sobre `/api/course-assignments/.../state` (patrón
  `windowMs: 60_000, max: 20` mencionado en `course-assignment.routes.ts:116-128`): dominio del
  `auth-security-engineer`, ya habilitado por §D4 de este ADR. **No se instala en este fix** — fuera
  de scope, sólo se deja esta nota como recordatorio de precedencia.
- **`RateLimitStore` centralizado** (Mongo/Redis) para deployment multi-instancia: backlog infra
  del `devops-engineer`.

**Verificación de coherencia inter-ADRs**: este fix no afecta a ET-1, ET-2 (ya cerrada) ni ET-3
del ADR-0001; no toca contrato, schemas ni lógica de business. No introduce dependencias nuevas
(cumple `AGENTS.md §6` regla de oro 6).

### D4 — Rate-limit específico para `/close` y `/reopen` (`max: 20/min`)

Se habilita formalmente la creación de un limiter específico:

```ts
const assignmentStateLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas solicitudes de cambio de estado. Intenta más tarde." },
});
```

a montar en `backend/src/routes/course-assignment.routes.ts` sobre:

- `POST /api/courses/assignments/:id/close`
- `POST /api/courses/assignments/:id/reopen`

**Justificación de `max: 20/min por IP`**:

- El cierre/reapertura es una acción **administrativa rara**: una vez por curso al finalizar y
  eventual corrección; en condiciones operativas normales un operador no ejecuta más de 20
  mutaciones/minuto.
- Se aplica **además** del `authorizeRoles(...)` (defensa en profundidad): el endpoint `/reopen`
  ya está restringido a `Superadmin` y `/close` a roles `TEACHING_ROLES + Admin + Superadmin`; el
  limiter específico reduce el abuso de reaberturas en cascada y bombas 4xx desde una sesión
  comprometida.
- El limiter específico se **monta por orden antes** del `authorizeRoles` (middleware de
  rate-limit primero, luego autorización) para short-circuitar 429 antes de procesar JWT/rol.

**Alcance de este ADR**: el devops-engineer (suscriptor de este ADR) **instala la dep** y deja el
limiter general en server.ts. La **aplicación concreta del limiter específico** a
`/close` y `/reopen` (montaje en el router y retiro de los `TODO[RATELIMIT-PENDING]`) es dominio
del `auth-security-engineer`, que lo ejecutará en su próxima iteración sin tocar
`package.json`. Este ADR lo habilita formalmente.

### D5 — Bypass en tests (`NODE_ENV === "test"`)

El rate-limit general **no se aplica** en entorno de test, mediante guard directo en
`server.ts`:

```ts
if (process.env.NODE_ENV !== "test") app.use("/api", generalLimiter);
```

**Razones**:

- El suite de 27 smoke tests del `testing-engineer` (`backend/tests/routers/*.smoke.test.ts`)
  NO importa `server.ts`; cada test construye una app Express aparte vía el helper
  `mountUnderCoursesPrefix` (`backend/tests/_setup/test-helpers.ts`), mockeando controllers y
  auth middleware. Por ello, los tests son en sí inmunes a helmet/general-limiter.
- No obstante, el bypass de rate-limit en `NODE_ENV === "test"` es una **doble defensa** para:
  (a) no romper futuros tests end-to-end que sí monten `server.ts` real; (b) seguir el patrón
  recomendado por `express-rate-limit` (que sugiere `skip: () => process.env.NODE_ENV === "test"`).
- `helmet()` se **mantiene aplicado** en test (no afecta a Supertest: sus headers no rompen
  assertions de status/body; los smoke tests asserts son `res.status` y `res.body`, no headers).

Esto cierra la preocupación de ET-2 respecto a que "la introducción no debe romper los 27
smoke tests".

## Alternativas consideradas

- **Rate-limit en reverse proxy (NGINX/CDN) en lugar de middleware Express**: descartada. El
  backend actualmente se sirve directamente por Node+Express; **no existe proxy en el deploy
  actual** del proyecto (verificado: no hay configuración NGINX/Caddy/Traefik en el repo). Añadir
  un proxy sólo para rate-limit sería infraestructura nueva fuera de scope.
- **WAF/edge-level rate-limit (Cloudflare, AWS WAF)**: descartada por la misma razón: no hay
  deploy gestionado con WAF en el proyecto; exigiría un servicio externo y secretos de cuenta
  fuera de alcance. Adecuado como *segunda capa* en el futuro cuando el deploy crezca, no como
  sustitutivo hoy.
- **Middleware propio de rate-limit (Memoria / Redis adaptado)**: descartada. Reinventaría
  `express-rate-limit` (ya probado, mantenido, con headers estándar `RateLimit-*`). Viola el
  principio de no reinventar (`AGENTS.md §5` análogo) y exigiría testear bottlenecks/memory
  leaks.
- **`express-slow-down` (delay en lugar de reject)**: descartado como sustitutivo. Considerado
  sólo como complemento futuro sobre endpoints de login/brute-force; este ADR se limita a
  dep+config de los dos exigidos por `AGENTS.md §8`. Queda como backlog del
  `auth-security-engineer`.
- **`helmet` deshabilitado solo en dev, completo en prod**: descartado. Helmet por defecto no
  rompe nada en dev (la API no sirve HTML); mantenerlo uniforme simplifica config y reduce
  divergencia.

## Consecuencias

### Positivas

- Cumplimiento de `AGENTS.md §8` ("Usar rate-limiting y helmet"). **Cierra la Excepción
  Temporal ET-2** de ADR-0001 (ver abajo).
- Hardening de headers HTTP vía helmet (`X-Content-Type-Options`, `X-Frame-Options`, `HSTS`,
  `noSniff`, CSP, etc.) con config por defecto segura.
- Defensa en profundidad contra ráfagas maliciosas sobre cualquier `/api/*` (limiter general)
  y contra abuso de mutaciones administrativas de close/reopen (limiter específico, futuro por
  `auth-security-engineer`).
- Coherencia con el ecosistema de deps Express 5 (ambas libs son compatibles con Express 5).

### Negativas / trade-offs

- **Overhead mínimo** en cada request: helmet añade ~6-10 headers; express-rate-limit almacena
  contadores en memoria (por defecto, sin `store` externo) — adecuado para un backend con una
  instancia; en deployment multi-instancia habría que configurar `rate-limit-mongo` o un
  `Store` Redis (fuera de scope de este ADR; backlog infra).
- **Estado de rate-limit en memoria**: a reinicios del proceso los contadores se resetean. Es
  un trade-off aceptable para uptime del proyecto; un `RateLimitMongoStore` es backlog futuro.
- **Estado inicial de cobertura**: este ADR **no añade tests nuevos** (la integración de
  helmet/limiter general en `server.ts` no es cubierta por los smoke tests existentes, que
  usan app aparte). Se delega al `testing-engineer` una iteración de tests de integración sobre
  `server.ts` (p.ej. verificar headers helmet presentes y 429 bajo ráfaga) — backlog, no
  bloquea Cierre de ET-2 (el comportamiento funcional no cambia; helmet/limiter son
  protecciones transversales no observadas por contrato).
- **CSP estricta** podría afectar futuros endpoints HTML servidos desde Express (no existe hoy).
  Vigilado; ver sección "Decisiones que requieren ratificación".

### Riesgos vigilados

- **429 quirúrgico en uso legítimo**: si un operador supera 100/min en flujo batch (subir
  miembros a varias asignaciones), podría recibir 429. Mitigado: el flujo real no alcanza la
  tasa; si se detecta en UAT, subir `max` o excluir prefix concretos — backlog.
- **Estado compartido en multi-instancia**: si el deploy escala a >1 backend, los contadores
  son por instancia (los límites se relajan proporcionalmente). Backlog: `RateLimitStore`
  centralizado.
- **CSP rompiendo un futuro endpoint HTML**: vigilado por la nota D2.

## Cambios aplicados en este ADR

- `docs/adr/0003-security-hardening-deps.md` — este archivo.
- `backend/package.json` — `dependencies`: añadidos `express-rate-limit@^8.6.0` y
  `helmet@^8.3.0`. `scripts`: sin cambios (los ya existentes `lint`/`typecheck`/`test` cubren
  verificación).
- `backend/package-lock.json` — actualizado por `npm install`.
- `backend/src/server.ts` — añadidos imports de `helmet` y `rateLimit` (de `express-rate-limit`);
  montado `app.use(helmet())` al inicio y `app.use("/api", generalLimiter)` (guardado por
  `NODE_ENV !== "test"`). CORS y routers no se modifican. `connectDB` y routers no se tocan.

### Cambios del fix del bug de navegación (§D3bis)

- `docs/adr/0003-security-hardening-deps.md` — añadida sección §D3bis (exención de `/api/auth/*`,
  justificación de `skip` vs. reorder, nota de backlog de limiters específicos).
- `backend/src/server.ts` — añadido `skip: (req) => req.originalUrl.startsWith("/api/auth")` al
  `generalLimiter`, con comentario explicativo. **No** se reordenan routers; **no** se elimina el
  limiter; **no** se sube `max`. CORS, routers, `helmet()` y bypass de test (`NODE_ENV !== "test"`)
  sin cambios.

## No se hace en este ADR (delegaciones)

- **Aplicación del limiter específico a `/close` y `/reopen` y retiro de los
  `TODO[RATELIMIT-PENDING]`** en `backend/src/routes/course-assignment.routes.ts`: dominio del
  `auth-security-engineer`. Este ADR lo habilita (la dep ya está instalada, los versiones son
  las del package.json, no se necesita nuevo ADR). El limiter específico (`max: 20`, patrón del
  comentario `TODO[RATELIMIT-PENDING]`) lo monta el `auth-security-engineer` en su próxima
  iteración, sin tocar `package.json`.
- **Tests de integración sobre `server.ts`** (helmet headers presentes, 429 behaviour):
  backlog del `testing-engineer`, no bloqueante para ET-2.
- **Documentación de setup/deploy con helmet+rate-limit**: backlog del `doc-keeper` (README,
  runbook deploy) en su iteración de docs de infra.

## Cierre de la Excepción Temporal ET-2 del ADR-0001

Con la materialización de D1 (deps instaladas) + D2 (helmet aplicado) + D3 (limiter general
aplicado, con bypass en test) + D5 (bypass verificado), **la Excepción Temporal ET-2 declarada
en `docs/adr/0001-courses-history-refactor.md` queda cerrada en lo referente a la deuda tras
versal de rate-limit + helmet**.

El `auth-security-engineer` puede ahora:

1. Retirar los comentarios `TODO[RATELIMIT-PENDING]` en
   `backend/src/routes/course-assignment.routes.ts` (líneas ~115 y ~148).
2. Montar el `assignmentStateLimiter` (`max: 20`, patrón del TODO) como middleware **antes** de
   `authorizeRoles(...)` en `/assignments/:id/close` y `/assignments/:id/reopen`.
3. No requiere instalar nada nuevo: `express-rate-limit` está ya en `backend/package.json`.

La sub-parte de "rate-limit específico en `/close`/`/reopen`" del ET-2 se cierra con esa
aplicación; mientras tanto, el limiter general de D3 ya provee 100/min como defensa genérica
sobre `/api/*`, de modo que no queda hueco de seguridad en el intervalo.

`ET-1` (auditoría ausente) y `ET-3` (drift mensaje 403) **no** son afectadas por este ADR y
siguen vigentes.

## Decisiones que requieren ratificación del `chief-architect`

1. **Versión de `express-rate-limit` fijada en `^8.6.0` en lugar de `^7.x`** sugerida en el
   brief. Razón: v8.x es la major actual y su compatibilidad con Express 5 (v5.2.1 del proyecto)
   es documentada; v7.x está un major atrás. Si existe política de fijar a la mínima major
   establecida en otro ADR (no encontrada), confirmar `^8.x`. No bloquea ET-2: la dep funciona.
2. **Conservación de `contentSecurityPolicy` (CSP) por defecto de helmet** (no deshabilitada en
   dev ni en prod). Razón: la API es JSON pura, CSP no afecta respuestas JSON en navegadores.
   Ratificar que se acepta mantener CSP estricta para futuros endpoints HTML servidos desde
   Express; o, alternativamente, instruir al `devops-engineer` a deshabilitar CSP en dev (quieto
   en prod). Por defecto mantuve CSP activa — instruir si debe cambiarse.
3. **`max: 100/min` del limiter general propuesto en el brief**: confirmado en uso, ajustar si el
   `product-owner`/UAT encuentra fricción real (no detectada a la fecha).
4. **No reflejar aún `helmet`/`express-rate-limit` en `AGENTS.md §2`**: este ADR lo introduce al
   stack implícitamente. El `chief-architect` puede, en una iteración menor de `AGENTS.md`,
   listarlos textualmente en la tabla §2 (capa "Hardening HTTP" / "Rate-limiting"). No
   bloqueante.

## Ratificación del `chief-architect` (post redacción del `devops-engineer`)

Tras recibir el reporte del `devops-engineer`, ratifico las cuatro decisioness que dejó
pendientes:

1. **Versiones `^8.6.0` (`express-rate-limit`) y `^8.3.0` (`helmet`)** — **Aprobadas**. La
   argumentación es correcta: Express 5.2.1 del proyecto requiere la major v8 compatible;
   fijar `^7.x` fue una sugerencia del brief que ya quedó atrás. No downgrade.
2. **CSP por defecto conservada** (no deshabilitada en dev ni prod) — **Aprobada**. La API
   es JSON pura; CSP no afecta respuestas JSON en navegadores. Se mantiene la vigilancia
   documentada en D2 sobre futuros endpoints HTML servidos desde Express.
3. **`max: 100/min` del limiter general** — **Aprobado**. Defensa en profundidad, no
   fricción operativa detectada. Si el `product-owner`/UAT reporta throttling en flujo
   batch (p. ej. subir miembros a muchas asignaciones), se ajusta en iteración menor.
4. **Reflejar `helmet`/`express-rate-limit` en `AGENTS.md §2`** — **Hecho en el mismo
   commit** que la ratificación de este ADR. Se añade una fila "Hardening HTTP" a la tabla
   del stack para no dejar el ecosistema sin fuente de verdad alineada (invariante
   §10 — los dos archivos deben ser consistentes).

Con estas ratificaciones, **ET-2 queda cerrada** en lo referente a la deuda tras versal de
rate-limit + helmet. La sub-parte "limiter específico en `/close`/`/reopen`" la aplica el
`auth-security-engineer` en su próxima iteración sin tocar `package.json` (la dep ya está
instalada por este ADR).

## Referencias

- `AGENTS.md §2` (stack tecnológico — fila "Hardening HTTP" añadida en esta iteración).
- `AGENTS.md §6` regla de oro 6 (no introducir deps sin ADR).
- `AGENTS.md §8` (Reglas de seguridad: rate-limit + helmet).
- `AGENTS.md §9` (calidad mínima: typecheck/lint/test).
- `docs/adr/0001-courses-history-refactor.md` — sección "ET-2 — Rate-limit + helmet ausentes".
- `backend/src/server.ts` (montaje Express).
- `backend/src/routes/course-assignment.routes.ts` (comentarios `TODO[RATELIMIT-PENDING]`).
- `backend/package.json` (deps instaladas).