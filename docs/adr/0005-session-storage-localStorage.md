# ADR-0005 — Sesión compartida entre pestañas con `localStorage`

- **Estado**: Aceptado
- **Fecha**: 2026-07-29
- **Custodio**: `chief-architect`
- **Tema**: Autenticación / UX de sesión (frontend)
- **Apertura delegada por**: `chief-architect` (bug reportado por usuario)
- **Redacción técnica**: `auth-security-engineer`

## Contexto

Se reportó que un usuario autenticado podía abrir una nueva pestaña apuntando a
`/login` y el sistema le permitía iniciar otra sesión. El usuario esperaba que la
nueva pestaña reconociera la sesión activa y lo redirigiera al dashboard, sin
permitir acceder a las pantallas de login.

La causa raíz era el uso de `sessionStorage` para persistir `authToken` y
`authUser` en `frontend/src/lib/auth.tsx`. `sessionStorage` es **por pestaña**:
una pestaña recién abierta no hereda el token de la sesión existente, por lo que
`GuestOnly` veía `isAuthenticated === false` y renderizaba el login.

## Decisión

### D1 — Migración de `sessionStorage` a `localStorage`

Se cambian las operaciones de lectura/escritura/borrado del token y del usuario
autenticado de `sessionStorage` a `localStorage` en `frontend/src/lib/auth.tsx`:

- `readStoredToken()`: `localStorage.getItem(AUTH_TOKEN_KEY)`.
- `readStoredUser()`: `localStorage.getItem(AUTH_USER_KEY)`.
- `persistSession()`: `localStorage.setItem(...)` para ambas claves.
- `clearStoredSession()`: `localStorage.removeItem(...)` para ambas claves.
- Bootstrap: `localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))` tras
  validar `/auth/me`.

### D2 — Sincronización de login/logout entre pestañas

Se añade un listener del evento nativo `storage` en `AuthProvider`:

- Si `AUTH_TOKEN_KEY` o `AUTH_USER_KEY` cambian (o se eliminan) en otra pestaña,
  el tab actual adopta el estado correspondiente.
- Si el token se borra, se ejecuta logout local (`performLogout`).
- Si el token cambia, se actualiza el estado y el header de axios.
- El evento `storage` no se dispara en el tab que originó el cambio, por lo que
  no hay bucles de sincronización.

### D3 — Defensa en profundidad contra login simultáneo

Se añaden dos guardas para evitar que una pantalla de login sobrescriba una sesión
activa ya existente:

1. En `AuthProvider.login()`: si `readStoredToken()` ya devuelve un token, la
   llamada a `login()` retorna sin persistir la nueva sesión.
2. En `frontend/src/pages/auth/Login.tsx`:
   - `useEffect` redirige a dashboard si `isAuthenticated && !isBootstrapping`.
   - `onSubmit` redirige a dashboard si `isAuthenticated` sin llamar al backend.

De esta forma, incluso si `GuestOnly` o `Login.tsx` tuvieran una condición de
carrera, el sistema no permite iniciar dos sesiones desde el cliente.

### D4 — Cancelación de bootstrap en logout

Se añade un `AbortController` al efecto de bootstrap (`/auth/me`) para cancelar
la validación pendiente si el usuario hace logout mientras se valida el token en
una pestaña nueva. Esto evita que una respuesta tardía de `/auth/me` restaure una
sesión que ya fue cerrada.

## Alternativas consideradas

- **Mantener `sessionStorage` y solo mejorar `GuestOnly`**: descartada. No cumple
  el requerimiento funcional: una pestaña nueva nunca vería la sesión de otra.
- **Híbrido `sessionStorage` + sincronización manual**: descartada. Compleja y
  aún dejaría la pestaña nueva sin token hasta recibir un mensaje de broadcast;
  `localStorage` ya resuelve el caso base sin complejidad adicional.
- **Cookies `HttpOnly`**: considerada pero descartada en esta iteración. Cambiaría
  el modelo de auth del backend (de header JWT a cookie) y exigiría una
  refactorización mayor. Queda como backlog estratégico de seguridad para reducir
  la exposición del token en `Storage`.
- **Session affinity por backend/session ID**: descartada. El frontend actual es
  stateless JWT; no existe backend de sesiones.

## Consecuencias

### Positivas

- Sesión reconocida en pestañas nuevas del mismo navegador/origen.
- Logout consistente en todas las pestañas abiertas.
- UX esperada por el usuario: `/login` con sesión activa redirige a dashboard.
- Implementación mínima, sin cambios de contrato ni backend.

### Negativas / trade-offs

- **Persistencia del token**: con `localStorage` el token sobrevive al cierre de
  pestaña/ventana hasta que el JWT expire o el usuario haga logout. Aumenta
  levemente la superficie de ataque en dispositivos compartidos o acceso físico.
  **Mitigaciones**:
  - El backend debe emitir JWT con expiración corta (refresh token o re-login
    periódico).
  - Logout limpia inmediatamente `localStorage` y sincroniza a otras pestañas.
  - Bootstrap valida el token contra `/auth/me` al cargar la app.
- **XSS**: el token sigue siendo accesible por JavaScript del mismo origen, igual
  que con `sessionStorage`. No cambia el modelo de amenaza; sigue siendo crítico
  sanitizar entradas y evitar XSS (AGENTS.md §8).
- **Multi-dispositivo**: el cambio no afecta el comportamiento entre dispositivos
  distintos; cada uno mantiene su propio `localStorage`.

## Riesgos vigilados

- **JWT de larga duración sin refresh**: si el backend emite tokens de larga vida,
  `localStorage` aumenta el riesgo de robo de sesión. Mitigación: configurar
  expiración corta y/o mecanismo de refresh en el backend (`auth-security-engineer`).
- **Logout parcial**: si el evento `storage` falla en algún navegador antiguo, el
  logout podría no sincronizarse. Mitigación: la defensa en profundidad en
  `Login.tsx` y `AuthProvider.login()` evita iniciar sesión sobre una existente;
  el tab no sincronizado simplemente seguirá con su sesión anterior hasta que el
  JWT expire o se recargue.

## Cambios aplicados

- `frontend/src/lib/auth.tsx`:
  - `sessionStorage` → `localStorage`.
  - Listener `storage` para sincronización entre pestañas.
  - Guarda en `login()` contra sesión existente.
  - `AbortController` en bootstrap de `/auth/me`.
- `frontend/src/pages/auth/Login.tsx`:
  - `useEffect` redirige a dashboard si ya está autenticado.
  - `onSubmit` redirige a dashboard sin llamar al backend si ya está autenticado.

## Referencias

- `AGENTS.md §8` (reglas de seguridad: validación de sesión, no exponer secretos).
- `frontend/src/lib/auth.tsx`.
- `frontend/src/pages/auth/Login.tsx`.
- `frontend/src/components/auth/RouteGuards.tsx`.
