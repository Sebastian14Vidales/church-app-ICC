# ADR-0020 — Dashboard exclusivo para Admin/Superadmin y rutas de aterrizaje por rol

- **Estado**: Aceptado (implementado)
- **Fecha**: 2026-09-15
- **Custodio**: `chief-architect`
- **Tema**: Restricción de acceso — la página Dashboard (`/`) deja de estar disponible
  para `Profesor`, `Supervisor`, `Lider`, `Pastor`, `Asistente` y `Miembro`; queda
  exclusiva de `Admin`/`Superadmin`. Se introduce el concepto de **ruta de aterrizaje
  por rol** (role-based home) para reemplazar las redirecciones que apuntaban ciegamente
  al dashboard.
- **Flujo**: Feature end-to-end abreviada (AGENTS.md §7): arquitecto descompone →
  `frontend-engineer` implementa → `testing-engineer` agrega cobertura. Sin cambios de
  contrato API ni de backend.

## Contexto

Reporte del usuario:

> *"Para el rol del profesor, supervisores y lideres, quítame el dashboard, solamente
> déjalo para el admin y superadmin."*

Estado previo (verificado en código):

1. La ruta index `/` (`PATHS.dashboard`) **no tenía restricción de roles**: cualquier
   usuario autenticado la veía (`router.tsx`).
2. `Sidebar.tsx` incluía "Dashboard" en `baseNavigation`, visible para todos.
3. **Múltiples puntos redirigían ciegamente al dashboard**: el fallback de `RequireAuth`
   por rol denegado, `GuestOnly` para autenticados, tres redirecciones post-login en
   `Login.tsx` y el wildcard `*` del router.
4. `Dashboard.tsx` contenía ramas internas por rol (`isLiderOnly` → redirect a
   "Mi grupo de vida"; `isSupervisorOnly` → vista de cobertura).

Restringir el dashboard sin tratar el punto 3 habría producido **bucle de redirección**
(rol denegado → dashboard → guard del dashboard → dashboard → …).

## Decisión

### D1 — Ruta index protegida por guard de roles

La ruta index queda envuelta en `RequireAuth allowedRoles={["Admin", "Superadmin"]}`,
siguiendo el patrón existente del router para rutas caladas por rol.

### D2 — Helper de ruta de aterrizaje por rol: `getHomePathForRoles`

Nuevo `frontend/src/lib/role-home.ts` con export nombrado
`getHomePathForRoles(roles: string[]): string`. Prioridad (gana el rol más alto; un
usuario multi-rol aterriza según su rol de mayor privilegio):

| Prioridad | Roles                        | Aterrizaje                |
| --------- | ---------------------------- | ------------------------- |
| 1         | `Admin` / `Superadmin`       | `/` (dashboard)           |
| 2         | `Profesor`                   | `/my-courses`             |
| 3         | `Supervisor`                 | `/life-groups`            |
| 4         | `Lider`                      | `/mi-grupo-de-vida`       |
| 5         | `Pastor`                     | `/members`                |
| 6         | `Asistente` / `Miembro`      | `/my-courses/student`     |
| fallback  | vacíos / desconocidos        | `/profile`                |

Las rutas de aterrizaje coinciden con las rutas que el router ya autoriza a cada rol
(menor fricción: nadie aterriza en una página que volvería a redirigirlo).

### D3 — Reemplazo de todas las redirecciones ciegas al dashboard

- `RouteGuards.tsx`: `RequireAuth` con rol denegado redirige a
  `getHomePathForRoles(user.roles)` (elimina el bucle potencial); `GuestOnly`
  redirige a autenticados a su home por rol.
- `Login.tsx`: las tres redirecciones post-login usan la home por rol del usuario.
- `Sidebar.tsx`: "Dashboard" se construye condicionalmente — primer ítem solo cuando
  `isAdmin` (`Admin` o `Superadmin`); el resto de la navegación no cambia.
- Router wildcard `*`: **se mantiene** apuntando a `PATHS.dashboard`; la cadena
  `* → / → home por rol` resuelve en dos saltos gracias al guard D1. Decisión
  deliberada: el wildcard vive fuera de `RequireAuth` y no conoce roles; un componente
  redirect adicional duplicaría lógica de guard para un caso residual (URL inválida).

### D4 — `Dashboard.tsx` se conserva intacto (defensa en profundidad)

Las ramas internas `isLiderOnly`/`isSupervisorOnly` quedan **inalcanzables** bajo D1
pero se conservan deliberadamente: si alguien montara el componente sin guard (p. ej.
una ruta nueva), seguiría comportándose con seguridad. Se acepta como deuda menor
documentada; no se refactorizó para no ampliar el radio del cambio.

### D5 — Sin cambios de backend

No existen endpoints exclusivos del dashboard: la página consume endpoints ya
existentes (`members`, `courses`, `course-assignments`, `events`, `life-groups`) con
sus propios permisos por rol. La restricción es de **navegación/UX**; la seguridad de
datos sigue viviendo en la autorización por endpoint del backend (defensa en
profundidad, no única barrera).

## Implementación

Implementado sin drift. Archivos tocados:

- `frontend/src/lib/role-home.ts` (nuevo): helper D2.
- `frontend/src/components/auth/RouteGuards.tsx`: fallbacks D3.
- `frontend/src/router.tsx`: guard D1 en la ruta index.
- `frontend/src/components/layout/Sidebar.tsx`: visibilidad condicional D3.
- `frontend/src/pages/auth/Login.tsx`: redirecciones post-login D3 (+ dependencias del
  `useEffect` de sesión pre-existente).
- Tests (`testing-engineer`): `frontend/src/lib/role-home.test.ts` (21 casos, cobertura
  100 %), `frontend/src/components/auth/RouteGuards.test.tsx` (10 casos),
  `frontend/src/components/layout/Sidebar.test.tsx` (19 casos). Suite frontend:
  **120/120 verde** (13 archivos).

## Consecuencias

### Positivas

- El dashboard (métricas globales de iglesia) queda reservado a quienes administran.
- Cada rol aterriza directamente en su herramienta de trabajo tras login.
- Se elimina el acoplamiento implícito "ruta por defecto = dashboard" que hacía
  frágil cualquier restricción futura de rutas.

### Negativas / trade-offs

- `Pastor`, `Asistente` y `Miembro` también pierden el dashboard (implícito en
  "solamente admin y superadmin"); `Pastor` aterriza en `/members`, su única ruta
  autorizada por el router.
- Ramas de rol en `Dashboard.tsx` quedan como código inalcanzable (deuda menor
  aceptada, ver D4).
- Copy de `Login.tsx` ("te llevamos al panel principal") es ahora aproximado para
  no-admins; ajuste cosmético menor, no bloqueante.

## Alternativas consideradas

- **Redirigir a todos los no-admin a `/profile`**: descartada. El perfil es información
  pasiva; obligaría a cada rol a un clic extra para llegar a su herramienta real.
- **Crear una "home" genérica nueva por rol**: descartada. Duplicaría destino de
  navegación sin valor; las páginas por rol ya existen y están guardadas.
- **Dejar el dashboard accesible pero ocultarlo en el menú**: descartada. Ocultar no
  es restringir; el usuario pidió quitar el acceso, y la URL seguiría siendo válida.

## Riesgos vigilados

- Nuevos roles o rutas: `getHomePathForRoles` debe actualizarse en conjunto con
  `router.tsx` (única fuente: este ADR + el helper).
- Si en el futuro se restringen más rutas index-like, evaluar promover el helper a
  contrato compartido con `api-contract-engineer`.

## Referencias

- `frontend/src/lib/role-home.ts`, `frontend/src/components/auth/RouteGuards.tsx`,
  `frontend/src/router.tsx`, `frontend/src/components/layout/Sidebar.tsx`,
  `frontend/src/pages/auth/Login.tsx`.
- `AGENTS.md` §4 (nomenclatura de rutas), §7 (flujo feature end-to-end).
