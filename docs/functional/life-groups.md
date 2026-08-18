# Módulo de Grupos de Vida

> **Audiencia**: pastores, supervisores, administradores de la iglesia y líderes de grupo.  
> **Objetivo**: describir, en lenguaje sencillo, cómo se organizan, registran y siguen los grupos de vida dentro de ICC Casa de Dios.

---

## 1. ¿Qué es un grupo de vida?

Un **grupo de vida** es un pequeño grupo de personas que se reúnen periódicamente para crecer en comunión, estudio y oración. El sistema maneja dos modalidades:

| Tipo | Frecuencia | Descripción |
| ---- | ---------- | ----------- |
| **Grupo de vida** | Semanal | Reunión habitual de discipulado y acompañamiento pastoral. |
| **Grupo de pareja** | Mensual | Reunión dirigida especialmente a parejas. |

Cada grupo tiene un **supervisor** (quien lo registra y lo acompaña), un **líder** (quien conduce las reuniones) y un listado de **asistentes**.

---

## 2. Quién hace qué

### 2.1 Supervisor

El supervisor es el encargado de **crear y mantener** los grupos de vida que están bajo su cobertura. Desde la opción **"Mi cobertura"** puede:

- Registrar un nuevo grupo de vida o grupo de pareja.
- Asignarle un **líder** elegido entre los miembros que ya tengan el rol de **Líder** en el sistema.
- Agregar o quitar **asistentes** del grupo.
- Editar datos básicos: nombre, barrio/sector y dirección de reunión.
- Revisar las sesiones registradas por el líder.

> El supervisor **no** crea líderes. El administrador (o superadministrador) es quien les asigna el rol de Líder; el supervisor solo los selecciona para su grupo.

### 2.2 Líder

El líder es una persona designada por el supervisor para dirigir un grupo. Al iniciar sesión, un líder **solo ve su grupo de vida** en el menú lateral: la opción **"Mi grupo de vida"**.

Desde allí el líder puede:

- Ver la información de su grupo (nombre, dirección, asistentes).
- Registrar cada sesión/reunión: fecha, asistentes que asistieron, ofrenda recogida y notas.
- Editar o eliminar una sesión ya registrada, por ejemplo si se cometió un error.
- Ver el historial de semanas o meses pasados, la asistencia acumulada y las ofrendas semanales/mensuales.

> El líder **no** puede cambiar el nombre del grupo, la dirección ni la lista de asistentes. Eso corresponde al supervisor o al administrador.

### 2.3 Administrador / Superadministrador

Pueden ver todos los grupos de vida, crear grupos para cualquier supervisor y editar cualquier dato. Son quienes asignan el rol de **Líder** a un miembro desde el formulario de miembros.

---

## 3. Flujo paso a paso

### Paso 1: El administrador habilita al líder

Antes de armar un grupo, el administrador (o superadministrador) debe asegurarse de que la persona que va a liderar tenga:

- Un perfil de miembro creado en el sistema.
- El rol **Líder** asignado.
- Un correo electrónico válido para activar su cuenta de acceso.

### Paso 2: El supervisor crea el grupo

1. Ingresa a **"Mi cobertura"**.
2. Crea un grupo nuevo indicando:
   - Nombre del grupo.
   - Barrio o sector.
   - Dirección de reunión.
   - Tipo: **Grupo de vida (semanal)** o **Grupo de pareja (mensual)**.
   - Líder (seleccionado de la lista de líderes habilitados).
   - Asistentes (miembros o asistentes de su cobertura).
3. Guarda el grupo.

### Paso 3: El líder registra las reuniones

Cada vez que el grupo se reúne, el líder entra a **"Mi grupo de vida"** y registra una nueva sesión con:

- **Fecha** de la reunión.
- **Asistentes presentes**: se marcan de la lista oficial del grupo.
- **Ofrenda**: valor recogido en la reunión (puede ser cero).
- **Notas**: observaciones pastorales o recordatorios.

El sistema asigna automáticamente un número de semana o mes secuencial (1, 2, 3...) para llevar el orden.

### Paso 4: Seguimiento

Tanto el líder como el supervisor pueden consultar:

- Cuántas semanas o meses lleva el grupo.
- Quiénes han asistido a lo largo del tiempo.
- Cuánto se ha recogido en ofrendas por semana o por mes.
- Notas de cada sesión.

---

## 4. Reglas importantes

- Un mismo perfil **solo puede ser líder de un grupo a la vez**.
- Los asistentes marcados como "presentes" en una sesión deben pertenecer al listado oficial del grupo.
- Las ofrendas siempre son valores mayores o iguales a cero.
- Si se retira un asistente del grupo, las sesiones anteriores conservan su asistencia tal como quedó registrada.
- El líder tiene una vista reducida del sistema para concentrarse únicamente en su grupo.

---

## 5. Referencias técnicas

- **Decisión de arquitectura**: [`docs/adr/0011-life-groups-leader-remove-predicas-ui-tweaks.md`](../adr/0011-life-groups-leader-remove-predicas-ui-tweaks.md)
- **Contrato API del módulo**: [`docs/api/life-groups-api.md`](../api/life-groups-api.md)

_Estos documentos están escritos para el equipo de desarrollo y detallan los endpoints, permisos y estructuras de datos que soportan el flujo descrito aquí._
