# ADR-0019 — Hardening de render frontend: selección estable, defaults de React Query y scroll único

- **Estado**: Aceptado
- **Fecha**: 2026-09-12
- **Custodio**: `chief-architect`
- **Tema**: Incidencia UX — flash en selects de todos los formularios + doble
  scroll con espacio en blanco en el módulo de asistencias.
- **Flujo**: Incidencia / bug (AGENTS.md §7). Diagnóstico de causa raíz por
  `chief-architect`; corrección delegada a `frontend-engineer`.

## Contexto

Reportes del usuario:

1. *"Algo está pasando con el select de todos los formularios que muestra un
   flasheo rapidísimo como si se quitara y luego se volviera a mostrar."*
2. *"En el módulo de asistencias para los profesores, me sale un doble scroll,
   lo cual me genera un campo o espacio en blanco debajo de todo el front."*

Cadena de causa raíz (verificada en código):

- **Flash de selects**: todos los `<Select>` (HeroUI) controlados por
  react-hook-form pasaban `selectedKeys={field.value ? [field.value] : []}` —
  un array con referencia nueva en cada render. React Aria interpreta cada
  referencia nueva como cambio de selección y resetea su estado interno → el
  trigger parpadea. Amplificadores: `QueryClient` con defaults
  (`refetchOnWindowFocus: true`, `staleTime: 0`) refrescaba todas las queries
  en cada foco de ventana (re-renders masivos); `AuthProvider` recreaba el
  objeto `value` del contexto y `login`/`logout` sin memoizar en cada render
  (re-render de todos los consumidores de `useAuth`).
- **Doble scroll**: `LoadingSpinner` con `className="min-h-screen"` dentro del
  `<main>` de `AppLayout` (que ya mide ~100vh − header, con wrapper `py-8`):
  un hijo de 100vh genera un scrollable de ~100vh+64px → scrollbar interna +
  área en blanco bajo el spinner (persistente mientras React Query reintenta
  con backoff). Segunda fuente: `StudentQuickViewModal` combinaba
  `scrollBehavior="inside"` con un div interno `max-h-[72vh] overflow-y-auto`
  → doble scroll dentro del modal.

## Decisión

### D1 — Selección estable: componente compartido `FormSelect` + hook `useStableSelection`

- `frontend/src/hooks/useStableSelection.ts`: normaliza el valor de selección a
  un `Set<string>` memoizado (referencia estable entre renders).
- `frontend/src/components/common/FormSelect.tsx`: envuelve `useController`
  (react-hook-form) + `useStableSelection` + `Select` de HeroUI. Soporta
  selección simple y múltiple. Todos los formularios migrados
  (`MemberForm`, `CourseForm`, `AssignCourseForm`, `MyCoverage`, `MyLifeGroup`,
  selector de año de `Reports` vía hook directo).
- Regla futura: ningún `<Select>` controlado con array literal inline. Los
  selects fuera de react-hook-form usan `useStableSelection` directamente.

### D2 — Defaults globales de React Query

`App.tsx` configura el `QueryClient` con:

- `refetchOnWindowFocus: false` — fin de los refetch masivos al recuperar foco.
- `staleTime: 60_000` — datos considerados frescos 60s (menos chatter).
- `retry: 2` — reintentos moderados.

Cualquier vista que necesite frescura estricta la pide explícitamente
(`refetchInterval`/`staleTime` propio en su `useQuery`). Sin dependencias
nuevas.

### D3 — Contexto de auth memoizado

`lib/auth.tsx`: `login`/`logout` con `useCallback`; `value` del contexto con
`useMemo`. Menos re-renders en cascada de `useAuth`.

### D4 — Patrón de scroll único

- El único contenedor de scroll vertical de la app es el `<main>` de
  `AppLayout`. Los estados de carga dentro de páginas NO fuerzan `min-h-screen`
  (se usan alturas moderadas, p. ej. `min-h-[40vh]`). Aplicado en
  `AttendanceView`, `RouteGuards`, `Members`, `Reports`, `MyLifeGroup`,
  `MyCoverage`.
- En modales, una sola zona de scroll: `StudentQuickViewModal` delega al
  `scrollBehavior="inside"` del `ModalView` (se eliminó el div interno con
  `max-h-[72vh] overflow-y-auto`).
- `SavedAttendanceSummaryTable` conserva `overflow-x-auto` (scroll horizontal
  esperado por tabla ancha; no cuenta como doble scroll vertical).

## Consecuencias

### Positivas

- Desaparece el flash de selects (causa directa eliminada) y el doble scroll
  del módulo de asistencias.
- Menos refetch/re-render global: mejor rendimiento general y menos carga al
  backend.
- Componente compartido reduce duplicación de wiring react-hook-form ↔ HeroUI.

### Negativas / trade-offs

- Datos hasta 60s "frescos" por defecto: aceptable para this app (datos
  eclesiales de baja cardinalidad); mutaciones invalidan caché explícitamente
  como hasta ahora.
- `useStableSelection` memoiza por referencia del valor: si un flujo futuro
  recrea arrays con los mismos elementos en cada render, el `Set` se
  regenerará (vigilar en selects múltiples; ver riesgos).

## Riesgos vigilados

- Selects múltiples: si reaparece parpadeo, estabilizar el array en la fuente
  (react-hook-form) o memoizar por contenido.
- `FormSelect` aún no expone `id` para `<label htmlFor>`: la asociación
  accesible sigue vía `aria-label` (como antes); `ui-design-engineer` puede
  proponer el patrón de ids en una iteración de diseño.
- `quality-engineer` verifica ausencia de drift y regresiones al cierre.

## Referencias

- `frontend/src/components/common/FormSelect.tsx` (+ `.test.tsx`),
  `frontend/src/hooks/useStableSelection.ts`, `frontend/src/App.tsx`,
  `frontend/src/lib/auth.tsx`, `frontend/src/layouts/AppLayout.tsx`,
  `frontend/src/components/courses/StudentQuickViewModal.tsx`.
- `docs/adr/0004-thinking-orbs-loading-spinner.md` (componente de carga).

### Nota de limpieza asociada a la auditoría

- Se eliminó el archivo muerto `frontend/src/pages/courses/Attendance.tsx`.
- Se centralizó la utilidad de descarga en `frontend/src/utils/file-download.ts`
  (`triggerFileDownload`). `frontend/src/pages/courses/AttendanceView.tsx` y
  `frontend/src/pages/courses/MyCoursesProfessor.tsx` ahora la consumen.
