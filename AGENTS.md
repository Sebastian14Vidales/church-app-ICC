# AGENTS.md — Contrato común del ecosistema de Agents

El presente documento es la **única fuente de verdad** para todos los Agents del proyecto
**ICC Casa de Dios** (sistema web de administración de iglesias cristianas).
Cualquier agente que opere en el repositorio DEBE conocer y respetar las reglas aquí descritas.
El `Chief AI Architect` es el custodio de este archivo; nadie más lo modifica sin su aprobación.

---

## 1. Identidad del proyecto

- **Nombre**: ICC Casa de Dios — Sistema de Administración Eclesial.
- **Dominio funcional**: Administración de iglesias cristianas (miembros, pastores, líderes,
  profesores, cursos bíblicos, asistencia, eventos, ofrendas, grupos de vida, dashboard,
  reportes, notificaciones, configuración, auditoría, logs, archivos, estadísticas).
- **Idioma de negocio**: español. El código, los nombres de identifiadores y los mensajes de
  commit pueden ir en inglés; los strings de UI y correos van en español.
- **Audiencia final**: pastores, líderes, administradores y miembros de la iglesia. La UX debe
  ser respetuosa, accesible y libre de jerga técnica.

---

## 2. Stack tecnológico (no negociable)

| Capa            | Tecnología                                   |
| --------------- | -------------------------------------------- |
| Frontend        | React + TypeScript + Vite                    |
| Estilos         | Tailwind CSS                                 |
| HTTP cliente    | Axios (instancia en `frontend/src/lib/axios.ts`) |
| Backend         | Node.js + Express + TypeScript               |
| Base de datos   | MongoDB + Mongoose                            |
| Tiempo real      | Socket.IO (`backend/src/realtime/socket.ts`) |
| Validación      | Middleware propio + expresa validadores      |
| Hardening HTTP  | helmet + express-rate-limit (ver ADR-0003)   |
| Autenticación   | JWT + sesión / action tokens                 |
| Email           | Nodemailer (`backend/src/services/email.service.ts`) |
| Testing         | Vitest (frontend) + Vitest/Supertest (backend) |
| Lint/Format     | ESLint + Prettier (`.prettierrc` ya existe)   |

No introducir frameworks, ORMs, gestores de estado i18n ni librerías de UI adicionales sin
aprobación explícita del `Chief AI Architect`. Si se necesita, primero se documenta el ADR.

---

## 3. Estructura del repositorio

```
ICC_CASA_DE_DIOS/
├── AGENTS.md                      # este contrato
├── opencode.json                  # config del ecosistema de agents
├── .opencode/
│   └── agent/*.md                 # prompts de los 14 agents
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── server.ts
│   │   ├── config/                # db, seed, env
│   │   ├── controller/            # HTTP handlers (x módulo)
│   │   ├── routes/                # routers Express (x módulo)
│   │   ├── models/                # esquemas Mongoose
│   │   ├── middleware/            # auth, validation
│   │   ├── services/              # lógica de negocio / email
│   │   ├── realtime/              # socket.io
│   │   ├── types/
│   │   └── utils/
│   └── ...
└── frontend/
    ├── src/
    │   ├── api/                   # client API por módulo
    │   ├── components/            # por dominio (auth, dashboard, layout...)
    │   ├── layouts/
    │   ├── lib/                   # axios, auth, realtime
    │   ├── pages/
    │   └── router.tsx
    └── ...
```

### Convenciones ESENCIALES

- **Un solo esquema Mongoose por colección**, en `backend/src/models/<entity>.model.ts`.
- **Un controlador por módulo** (`<module>.controller.ts`) — no megarchivos multi-módulo.
- **Una ruta por módulo** (`<module>.routes.ts`) montada con un prefijo REST coherente.
- **Lógica de negocio en `services/`**, no en controladores; los controladores orquestan y responden.
- **Cada llamada HTTP desde el frontend pasa por `frontend/src/api/`**, nunca por `axios` directo desde componentes.
- **Componentes agrupados por dominio** (`components/auth`, `components/dashboard`, `components/courses`...), no por tipo.
- **Rutas centralizadas en `frontend/src/router.tsx`**, con guards en `components/auth/RouteGuards.tsx`.
- **No lógica de negocio en el cliente**; se llama al backend y se muestra.
- **No lógica de presentación en el backend**; se devuelven datos serializados.
- **Exports nombrados** salvo componentes/pages que usan `export default`.
- **Archivos en PascalCase** para componentes/pages, **kebab-case** para servicios/utilidades.

---

## 4. Nomenclatura

- **Colecciones Mongoose**: singular, PascalCase (`User`, `LifeGroup`, `ClassSession`).
- **Rutas API**: `/api/<recurso-plural>` (p. ej. `/api/life-groups`, `/api/class-sessions`).
- **Hooks React**: `use<Recurso>` (`useMembers`, `useCourses`).
- **Componentes**: `<RecursoAccion>` (`MemberForm`, `EventModal`), o `<Dominio>...`.
- **Endpoints**: verbos REST (`GET /api/members`, `POST /api/events/:id/attendances`).
- **Constantes de entorno**: `UPPER_SNAKE_CASE`, valores en `backend/.env` nunca commiteados.

---

## 5. Manejo de datos

- **Ningún secret, credencial ni `.env` se commitea** ni se hardcodea. Usar `dotenv` y `process.env`.
- **Passwords**: bcrypt + sal; nunca loggear ni devolver hashes en respuesta.
- **Soft-delete**: preferir marca `deletedAt` antes de borrado físico, salvo decisión de arquitectura.
- **Timestamps**: `createdAt`/`updatedAt` activos en todos los esquemas relevantes.
- **Auditoría**: todo cambio sensible se registra vía el módulo de auditoría; no reimplementar.
- **Transacciones MongoDB**: para operaciones multi-documento usar `session.withTransaction`.

---

## 6. Roles y permisos del ecosistema de Agents

| Agent                       | Modelo           | Modalidad | Dueño de área                                  | Puede editar código |
| --------------------------- | ---------------- | --------- | ---------------------------------------------- | ------------------- |
| `chief-architect`           | GLM-5.2          | primary   | Arquitectura global, delegación, coherencia    | No (sólo ADR/docs)   |
| `product-owner`             | GLM-5.2          | subagent  | Voz del negocio: backlog, historias, alcance   | No (sólo docs)       |
| `api-contract-engineer`     | Kimi K2.7 Code   | subagent  | Contratos API frontend↔backend, OpenAPI/tipos   | Sí (tipos, contratos)|
| `backend-engineer`          | Kimi K2.7 Code   | subagent  | Express, controllers, routes, services         | Sí                   |
| `database-engineer`         | Kimi K2.7 Code   | subagent  | Mongoose, esquemas, índices, migraciones       | Sí (`models/`,`config/`)|
| `auth-security-engineer`    | Kimi K2.7 Code   | subagent  | Auth, JWT, roles, permisos, hardening           | Sí (`middleware/auth`, `services/`)|
| `realtime-notif-engineer`   | Kimi K2.7 Code   | subagent  | Socket.IO, notificaciones, eventos en vivo     | Sí (`realtime/`)     |
| `frontend-engineer`         | Kimi K2.7 Code   | subagent  | React: estructura, hooks, layouts, router, páginas, API | Sí (`frontend/src/`)|
| `ui-design-engineer`        | Kimi K2.7 Code   | subagent  | Tailwind, accesibilidad, sistemas de diseño    | Sí (estilos, clases)|
| `testing-engineer`          | MiniMax-M2.7     | subagent  | Vitest, Supertest, cobertura, fixtures          | Sí (`*.test.ts`)     |
| `devops-engineer`           | Kimi K2.7 Code   | subagent  | Docker, scripts, CI, env, deploy                | Sí (infra)           |
| `doc-keeper`                | Kimi K2.7 Code   | subagent  | README, ADRs, doc funcional/empresarial        | Sí (docs)            |
| `quality-engineer`          | Kimi K2.7 Code   | subagent  | Revisión + refactor seguro + debug (audita→corrige) | Sí (tras auditar) |

> Nota: Modelos runtime según disponibilidad del provider `opencode-go`:
> - `GLM-5.2` para chief-architect y product-owner
> - `Kimi K2.7 Code` para el resto de agentes
> - `MiniMax-M2.7` para testing-engineer
>
> Ver [`docs/adr/0002-reconcile-models-drift.md`](docs/adr/0002-reconcile-models-drift.md).

Reglas de oro:

1. **Un solo dueño por área.** Nadie edita archivos fuera de su dominio sin coordinación explícita.
2. **El `Chief AI Architect` no escribe código de feature.** Diseña, delega, revisa coherencia.
3. **El `api-contract-engineer` es la única autoridad sobre la forma de los payloads API.**
   Cambios de contrato se hacen primero ahí; `backend-engineer` y `frontend-engineer` consumen.
4. **El `quality-engineer` audita antes de editar**: el diagnóstico precede siempre al fix.
   En cambios que crucen dominios, coordina con el dueño del área; en refactors mayores pide
   aprobación al arquitecto.
5. **El `product-owner` no edita código**: define el _qué_ y el _por qué_; el arquitecto
   descompone el _cómo_.
6. **Ningún agente introduce dependencias nuevas** sin ADR aprobado por el arquitecto.
7. **Toda implementación nueva debe acompañarse de pruebas** (`testing-engineer` puede exigirlo).
8. **Toda feature nueva debe documentarse** antes de cerrar el ciclo (`doc-keeper`).
9. **No se trabaja sobre `frontend/dist/`**: es build, regenerable. No se commitea salvo build.

---

## 7. Flujos canónicos

### Feature nueva end-to-end

1. `Product Owner` redacta la historia con criterios de aceptación y la prioriza en `docs/backlog/`.
2. `Chief AI Architect` descompone, asigna, registra en `docs/adr/` el planteo.
3. `api-contract-engineer` define payload/tipos y documenta el endpoint.
4. `Database Engineer` modela el esquema si requiere persistencia nueva.
5. `Backend Engineer` implementa controller + route + service respetando el contrato.
6. `Auth-Security Engineer` revisa/asegura permisos y validación de entrada.
7. `Frontend Engineer` implementa página/hook + llamada API conforme al contrato.
8. `UI Design Engineer` valida estilos y accesibilidad en las vistas nuevas.
9. `Testing Engineer` añade pruebas (backend + frontend); bloquea merge si fallan.
10. `Quality Engineer` audita el conjunto; corrige hallazgos (o los deriva al dueño).
11. `Doc Keeper` actualiza README, ADR y doc funcional.
12. `Product Owner` valida la entrega contra los criterios de aceptación.
13. `Chief AI Architect` cierra el ciclo y actualiza la visión.

### Incidencia / bug

1. `Quality Engineer` reproduce, aísla causa raíz y aplica la corrección (o la deriva al dueño).
2. `Testing Engineer` añade regresión.
3. `Quality Engineer` verifica ausencia de drift; `Doc Keeper` registra post-mortem.

### Refactor mayor

1. `Quality Engineer` propone plan al `Chief AI Architect`.
2. Aprobado → ejecuta en pasos, sin cambio de comportamiento.
3. `Testing Engineer` garantiza verde antes/después.
4. `Quality Engineer` verifica ausencia de drift final.

---

## 8. Reglas de seguridad (aplican a todos)

- Nunca loggear, retornar ni commitear secretos, tokens, passwords ni hashes.
- Validar SIEMPRE la entrada del cliente con whitelist de campos esperados.
- Autorizar por rol/permiso antes de cualquier mutación sensible.
- Sanitizar HTML y entradas de texto largo; prevenir XSS/NoSQL injection.
- Usar rate-limiting y helmet (configurados por `devops-engineer`/`auth-security-engineer`).
- No exponer stack traces al cliente en producción.

---

## 9. Calidad mínima exigida

- `npm run lint` y `npm run typecheck` deben pasar en backend y frontend.
- `npm test` debe pasar; cobertura objetivo ≥ 80% en capas críticas.
- No se mergea nada rojo, ni con `console.log` de depuración, ni con `any` sin justificar.
- Commits en presente imperativo, en inglés, prefijados por el agente (p. ej. `[backend]`, `[frontend]`, `[auth]`).
- PR/diff con descripción, riesgo, plan de pruebas y `Doc Keeper` notificado.

---

## 10. Mecanismo de coordinación

- **Lista de tareas**: cada agente debe usar `todowrite` cuando su trabajo tenga ≥3 pasos.
- **Transferencias**: cuando un agente termine su parte, NO continúe a otras áreas; reporta al
  usuario / arquitecto para que delegue al siguiente dueño.
- **Conflicto de contrato o reglas**: se escala al `Chief AI Architect`, que es el único que
  puede modificar `AGENTS.md` o declarar una excepción temporal.
- **Contexto compartido**: todos los agentes leen este `AGENTS.md` + `opencode.json` al iniciar.

---

_Custodio: `Chief AI Architect`. Última revisión pendiente de primera activación del ecosistema._