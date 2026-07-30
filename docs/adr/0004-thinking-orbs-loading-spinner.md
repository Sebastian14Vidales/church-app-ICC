# ADR-0004 — Loading spinner unificado con `thinking-orbs`

- **Estado**: Aceptado
- **Fecha**: 2026-07-29
- **Custodio**: `chief-architect`
- **Tema**: UX / componentes de carga (frontend)
- **Apertura delegada por**: `chief-architect` (solicitud directa de negocio/UX)
- **Redacción técnica**: `chief-architect`

## Contexto

El sistema presenta hoy múltiples estilos de "loading" dispersos en el frontend:

- Textos planos como `<h1>Cargando predicas...</h1>`, `<h1>Cargando miembros...</h1>`.
- Spinners implícitos de HeroUI a través de la prop `isLoading` de `<Button>`.
- Bloques condicionales `{isLoading ? (...)}` sin componente compartido.

El usuario solicitó explícitamente unificar la experiencia de carga con el spinner
`working` de la librería `thinking-orbs`, a **64 px** y **velocidad 1.40x**, para que
"aparezca cargando así en todo lado".

`AGENTS.md §2` prohíbe introducir librerías de UI adicionales sin aprobación explícita del
`chief-architect`, y `AGENTS.md §6` (regla de oro 6) exige ADR previo para dependencias
nuevas. Este ADR cubre ambas exigencias.

## Decisión

### D1 — Aprobación de `thinking-orbs` como dependencia de producción del frontend

Se añade al `frontend/package.json` (bloque `dependencies`):

```json
"thinking-orbs": "^0.1.1"
```

**Justificación**:

- Librería especializada en indicadores de carga para UIs de agentes/IA; el estado
  `working` se ajusta semánticamente a operaciones en curso del sistema.
- Renderiza en canvas 2D, sin dependencias de runtime (`0 deps`), ~38 KB descomprimida,
  compatible con el bundle Vite+React del proyecto.
- Tipos TypeScript incluidos (`dist/index.d.ts`).
- Licencia MIT.

**Riesgos vigilados**:

- La versión actual `0.1.1` es muy reciente (publicada jul-2026). Se fija a `^0.1.1` y se
  vigilará estabilidad antes de subir de minor.
- El `peerDependencies` declara `react: ">=18.0.0"`. El proyecto usa React `^19.2.0`. La
  instalación puede emitir advertencia de peer. Se verificará que el componente renderiza
  correctamente con React 19 antes de propagar su uso.

### D2 — Componente wrapper centralizado

Se crea un componente wrapper propio del proyecto para garantizar que todos los puntos de
carga usen exactamente la misma configuración (estado, tamaño, velocidad, tema) y para poder
 cambiar el proveedor en el futuro sin tocar cada pantalla:

```ts
// frontend/src/components/common/LoadingSpinner.tsx
import { ThinkingOrb } from "thinking-orbs";

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

export function LoadingSpinner({ label, className }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 ${className ?? ""}`}
    >
      <span className="sr-only">{label ?? "Cargando"}</span>
      <ThinkingOrb
        state="working"
        size={64}
        speed={1.4}
        theme="light"
        aria-label={label ?? "Cargando"}
      />
      {label && <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>}
    </div>
  );
}

export default LoadingSpinner;
```

Ubicación: `frontend/src/components/common/LoadingSpinner.tsx`.

> **Nota**: se usa `aria-label` + un texto `sr-only` para accesibilidad robusta; `role="status"`
> en el envoltorio para anunciar el estado de carga. Se fuerza `theme="light"` porque la
> aplicación aún no implementa dark mode global y todos sus fondos son claros; el modo `auto`
> de `thinking-orbs` tomaría `prefers-color-scheme` y podría renderizar orbes claros sobre
> fondos claros. El componente respeta `prefers-reduced-motion` internamente de
> `thinking-orbs`, por lo que no se duplica lógica.

### D3 — Reemplazo sistemático de estados de carga

Se reemplazan **todos** los estados de carga full-page / sección por `<LoadingSpinner />`.
Esto incluye pero no se limita a:

- `frontend/src/pages/sermons/Sermons.tsx` — `if (isLoading) return <h1>Cargando predicas...</h1>;`
- `frontend/src/pages/members/Members.tsx` — `if (isLoading) return <h1>Cargando miembros...</h1>;`
- `frontend/src/pages/reports/Reports.tsx` — bloque `if (isLoadingAssignments || isLoadingEvents)`.
- `frontend/src/pages/courses/Courses.tsx` — bloques `{isLoadingCatalog ? (...)`, etc.
- `frontend/src/pages/courses/MyCoursesProfessor.tsx` — bloques `{activeQuery.isLoading ? (...)`, etc.
- `frontend/src/pages/courses/Attendance.tsx` — `if (isLoading) { ... }`.
- `frontend/src/pages/courses/AttendanceView.tsx` — `if (isLoading) { ... }`.
- `frontend/src/pages/coverage/MyCoverage.tsx` — `if (isLoading) { ... }`.
- `frontend/src/pages/Events.tsx` — bloque `{isLoading ? (...)`.
- `frontend/src/pages/MySermons.tsx` — bloque `{isLoading ? (...)`.
- `frontend/src/components/dashboard/MemberForm.tsx` — selector de roles con `isLoading`.

Criterios de reemplazo:

- **Páginas y secciones**: usar `<LoadingSpinner label="Cargando ..." />` centrado en el
  área que está cargando (full page o contenedor según corresponda).
- **Botones con `isLoading` de HeroUI**: mantener `isLoading` de HeroUI, ya que es la
  convención del design system interno para acciones de botón. No se reemplaza el spinner
  interno del botón salvo que HeroUI lo permita de forma sencilla. En todo caso, la carga
  de botón es un estado diferente al de página/sección.
- **No se toca backend**: esta decisión es exclusivamente frontend.

### D4 — Configuración de Vite / Tailwind

- `thinking-orbs` no requiere configuración extra de Vite ni de PostCSS (es un componente
  React+canvas).
- No modifica el tema de Tailwind ni introduce clases nuevas. El wrapper usa clases del
  sistema existente (`flex`, `items-center`, `justify-center`, `gap-3`, `text-sm`,
  `text-slate-600`).

## Alternativas consideradas

- **Spinner nativo de HeroUI (`@heroui/react`)**: ya está instalado y se usa en botones.
  Descartado como spinner general a solicitud explícita del usuario; HeroUI no ofrece la
  animación `working` ni la estética de "thinking orbs".
- **Spinner de `lucide-react` + CSS keyframes**: `lucide-react` ya está instalado, pero
  requeriría crear y mantener animaciones CSS propias. Descartado porque el usuario pidió
  usar `thinking-orbs` específicamente.
- **Componente canvas propio**: descartado. Reinventaría lo que `thinking-orbs` ya ofrece
  testeado y con accesibilidad incluida.
- **Instalar en `devDependencies`**: descartado. El componente se ejecuta en producción, por
  lo que va en `dependencies`.

## Consecuencias

### Positivas

- Experiencia de carga visualmente coherente en todo el frontend.
- Un solo punto de verdad para la configuración del spinner (`LoadingSpinner.tsx`).
- Componente accesible y con soporte para `prefers-reduced-motion` sin trabajo adicional.

### Negativas / trade-offs

- Nueva dependencia de terceros (riesgo de mantenimiento y versionado).
- Paquete joven (`0.1.1`); posibles cambios de API en futuras versiones.
- Los spinners de botón HeroUI permanecen con su estilo propio, lo que genera dos familias
  visuales levemente distintas: spinner de sección (`thinking-orbs`) y spinner de acción
  (HeroUI). Aceptado como distinción semántica (carga de contenido vs. carga de acción).
- Se añadió infraestructura de testing (`vitest`, `@testing-library/react`, `jsdom`, etc.)
  al frontend, que antes no existía. Alineado con el stack declarado en `AGENTS.md §2` pero
  incrementa el tamaño del lockfile y el tiempo de instalación.

## Cambios esperados

- `frontend/package.json` — añadida `"thinking-orbs": "^0.1.1"` en `dependencies`; scripts
  `test`, `test:watch`, `test:coverage`; y `devDependencies` de testing: `vitest`,
  `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/dom`,
  `@testing-library/jest-dom`, `jsdom`.
- `frontend/package-lock.json` — actualizado por `npm install`.
- `frontend/vitest.config.ts` — configuración de Vitest para el frontend (jsdom, globals,
  setup, coverage v8).
- `frontend/src/test-setup.ts` — importa `@testing-library/jest-dom`.
- `frontend/tsconfig.app.json` — añadido `"vitest/globals"` a `types`.
- `frontend/src/components/common/LoadingSpinner.tsx` — componente wrapper nuevo.
- `frontend/src/components/common/LoadingSpinner.test.tsx` — tests unitarios del wrapper.
- Múltiples archivos en `frontend/src/pages/**` y `frontend/src/components/**` — reemplazo
  de textos/bloques de carga por `<LoadingSpinner ... />`.

## Delegaciones

- **Implementación** (`frontend-engineer`):
  - Instalar `thinking-orbs` en `frontend/`.
  - Crear `frontend/src/components/common/LoadingSpinner.tsx`.
  - Reemplazar todos los estados de carga de página/sección identificados y cualquier otro
    que encuentre durante la auditoría.
  - Verificar `npm run lint` y `npm run build` (typecheck implícito) en `frontend/`.
- **Validación visual y accesibilidad** (`ui-design-engineer`):
  - Revisar que el spinner a 64 px se ve bien en contenedores de distinto tamaño y temas
    claro/oscuro.
  - Confirmar contraste y espaciado del label opcional.
- **Pruebas** (`testing-engineer`):
  - Añadir o actualizar tests que rendericen `<LoadingSpinner />` y verifiquen presencia del
    `role="status"` y del label.
  - Garantizar que la cobertura de componentes no baje.
- **Auditoría final** (`quality-engineer`):
  - Revisar que no queden textos planos de "Cargando..." dispersos.
  - Verificar que no se importe `ThinkingOrb` directamente desde páginas (solo a través del
    wrapper).

## Referencias

- `AGENTS.md §2` (stack tecnológico y restricción de librerías UI nuevas).
- `AGENTS.md §6` regla de oro 6 (ADR previo para dependencias nuevas).
- `frontend/package.json`.
- Resultados de `npm view thinking-orbs --json` y documentación del paquete.
