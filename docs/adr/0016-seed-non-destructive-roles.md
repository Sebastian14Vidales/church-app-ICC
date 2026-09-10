# ADR-0016 — Seed no destructivo para roles y bootstrap de superadmin sin credenciales hardcodeadas

- **Estado**: Aceptado
- **Fecha**: 2026-09-09
- **Custodio**: `chief-architect`
- **Tema**: Incidencia — roles adicionales (p. ej. `Supervisor`) desaparecen de un usuario `Profesor` "al rato" + hardening de arranque
- **Flujo**: Incidencia / bug (AGENTS.md §7). Causa raíz aislada por `chief-architect`; corrección delegada a `database-engineer` (dueño de `config/seed.ts`).

## Contexto

Reporte del usuario: *"Si tengo un miembro como profesor y le voy a agregar el de supervisor,
luego de un rato se elimina ese rol… ¿Por qué no me deja ese rol?"*.

Causa raíz verificada: `backend/src/config/seed.ts::syncAccessRolesFromLinkedRecords`
se ejecuta **en cada arranque del servidor** (`server.ts` la invoca tras `connectDB`). Para
todo perfil que aparezca como `professor` en alguna `CourseAssigned` hace:

```ts
await UserProfile.updateMany({ _id: { $in: professorProfileIds } },
  { $set: { role: professorRole._id } });            // ① fuerza el rol primario a Profesor
await User.updateMany({ _id: { $in: professorUserIds } },
  { $set: { roles: [professorRole._id] } });         // ② REEMPLAZA todo el array de roles
```

② destruye cualquier rol adicional (Supervisor, Pastor, etc.) del usuario en el siguiente
reinicio del backend — en dev ocurre en cada reload de nodemon, de ahí el "al rato".
① sobrescribe el rol primario elegido deliberadamente por el administrador
(`resolvePrimaryRole` en `user-profile.controller.ts`).

Hallazgo adicional de seguridad en el mismo archivo: el bootstrap de superadmin usa
**email y contraseña literales en el código fuente** (`Superadmin1234`), lo que viola
AGENTS.md §5/§8 y es inaceptable para un lanzamiento público.

Verificación clave para el diseño: la elegibilidad como profesor NO depende del rol
primario — `course-assignment.service.ts` (líneas ~112-134) acepta `profile.role ==
"Profesor"` **O** `user.roles` contenga `Profesor`. Por tanto el sync puede ser aditivo
sin romper el flujo de cursos.

## Decisión

### D1 — Sync de profesor aditivo (no destructivo)

`syncAccessRolesFromLinkedRecords`:

- **Eliminar** el `UserProfile.updateMany` que fuerza `role` a Profesor (el rol primario
  es una decisión de administración; la reparación de referencias huérfanas ya existe en
  `repairOrphanedRoleReferences`).
- Sustituir el `$set: { roles: [profesorRole._id] }` por **`$addToSet: { roles:
  professorRole._id }`**: garantiza que todo profesor de una asignación tenga el rol
  Profesor (intención original del sync: acceso a la UI de profesor) **sin borrar los
  demás roles**.

### D2 — Bootstrap de superadmin por variables de entorno

El bootstrap lee `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` de `process.env`. Si alguna
falta, **se omite el bootstrap** con un `console.warn` explicativo (en `config/` los logs
de diagnóstico están permitidos por la configuración de ESLint). Ninguna credencial queda
en el código fuente.

### D3 — Rotación de credenciales (operativo, bloqueante para publicar)

La contraseña actual ya quedó en el historial de git. Acción obligatoria pre-lanzamiento:
definir `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` en el `.env` de producción **con una
contraseña nueva y fuerte** (no reutilizar `Superadmin1234`).

## Cambios esperados

- `backend/src/config/seed.ts`: D1 + D2. Sin cambios en `repairOrphanedRoleReferences`,
  upserts de roles ni limpieza de roles obsoletos.
- `docs/adr/README.md`: índice.

## Consecuencias

### Positivas

- Los roles adicionales de los profesores sobreviven a reinicios/despliegues (bug
  eliminado de raíz).
- El rol primario deja de ser sobrescrito silenciosamente.
- Cero credenciales en el código fuente.

### Negativas / trade-offs

- Si en la BD ya hubo destrucción de roles por el bug, el seed **no los recupera**
  (no sabe cuáles eran): revisar manualmente los profesores con asignaciones y
  re-asignar los roles perdidos antes del piloto.
- Un despliegue sin `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` no crea superadmin:
  el check de arranque del checklist de lanzamiento lo cubre.

## Alternativas consideradas

- **Eliminar `syncAccessRolesFromLinkedRecords` por completo**: descartada. El sync
  protege un invariante real (todo profesor de asignación debe poder entrar a la UI de
  profesor); lo incorrecto era el medio destructivo, no el fin.
- **Excluir el sync en producción**: descartada. Duplica código de arranque y no corrige
  el daño en dev/piloto.

## Riesgos vigilados

- Usuarios ya afectados por el bug (roles perdidos en arranques previos): verificación
  manual pre-piloto (D3 del checklist).
- `testing-engineer` evalúa la viabilidad de una prueba de regresión del sync (mock de
  modelos) para bloquear futuros `$set` destructivos.

## Referencias

- `backend/src/config/seed.ts`, `backend/src/server.ts`, `backend/src/config/db.ts`.
- `backend/src/services/course-assignment.service.ts` (~112-134: elegibilidad dual de profesor).
- `backend/src/controller/user-profile.controller.ts` (`resolvePrimaryRole`).
- `AGENTS.md` §5 (sin secretos en repo), §8 (seguridad).
