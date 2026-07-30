# Contrato API del módulo de Miembros — notas de campos de perfil

> **Estado**: Nota complementaria vigente.
> **Autoridad**: `api-contract-engineer`.
> **Fuentes**: `AGENTS.md` (§3, §4, §5, §8), ADR-0006 (`docs/adr/0006-course-growth-mapping.md`).
> **Última revisión**: 2026-07-29

Este documento registra campos de `UserProfile` / `Member` que afectan el contrato público
pero que aún no tienen un OpenAPI/YAML formal dedicado. Cuando el módulo de miembros tenga
una especificación completa, el `doc-keeper` migrará estas notas al artefacto principal.

---

## 1. Campo `profession`

### 1.1 Modelo de datos

- **Backend**: `backend/src/models/user-profile.model.ts`.
  - Tipo: `String`, `trim: true`.
  - Obligatoriedad: **opcional**.
- **Frontend**: `frontend/src/types/index.ts` → `memberSchema.profession`.
  - Tipo: `z.string().optional().nullable()`.

### 1.2 Creación de miembro — `POST /api/members` (ruta convencional)

- **Body**: el campo `profession` se acepta como string opcional.

```jsonc
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "documentID": "12345678",
  "birthdate": "1990-05-15",
  "neighborhood": "Centro",
  "phoneNumber": "3001234567",
  "bloodType": "O+",
  "profession": "Ingeniero",   // string opcional, libre
  "baptized": true,
  "spiritualGrowthStage": "Consolidación",
  "roleNames": ["Miembro"]
}
```

- **Persistencia**: el `backend-engineer` debe copiar `profession` al crear/actualizar el
  `UserProfile` en `backend/src/controller/user-profile.controller.ts` (ver ADR-0006,
  sección "Cambios esperados").

### 1.3 Actualización de miembro — `PUT /api/members/:id` (ruta convencional)

- El campo `profession` se acepta de forma opcional en el body y se persiste igual que en
  la creación.
- Si se envía `null` o se omite, el backend debe mantener coherencia con el esquema
  Mongoose (`profession?: string`).

### 1.4 Participante de curso

- `courseParticipantSchema` incluye `profession` (heredado de `memberSchema.pick({...})`).
- Esto expone la profesión en las vistas de curso/asistencia donde se lista un miembro
  inscrito.

### 1.5 Restricciones de rol

- `Admin` / `Superadmin`: pueden enviar y persistir cualquier campo, incluido `baptized`.
- `Profesor` / `Pastor` / `Supervisor`: al registrar un miembro, el campo `baptized` no se
  muestra en el formulario y se guarda automáticamente como `false` (no bautizado → rol
  `Asistente`). Esto no afecta a `profession`, que sigue siendo editable/libre según UI.

---

## 2. Campo `spiritualGrowthStage` en perfil

- Fuente de verdad del enum: `backend/src/models/user-profile.model.ts` →
  `SPIRITUAL_GROWTH_STAGES`.
- Frontend: `frontend/src/types/index.ts` → `spiritualGrowthStageSchema`.
- El avance automático de esta etapa se documenta en `docs/api/courses-api.md`
  (`POST /api/courses/assignments/:id/close`).
