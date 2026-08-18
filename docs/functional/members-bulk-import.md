# Carga masiva de asistentes con Excel

> **Audiencia**: Administradores y Superadmins de la iglesia.
> **Modulo**: Miembros.
> **Referencias tecnicas**:
> - Decision de arquitectura: `docs/adr/0010-members-bulk-import.md`
> - Contrato API: `docs/api/members-bulk-import.md`

## Proposito

Esta funcionalidad permite registrar masivamente a personas que asisten a la iglesia como **asistentes**, subiendo un archivo `.xlsx` (Excel). Normalmente ese archivo proviene de las respuestas de un Google Form.

Un asistente es una persona que aun no esta bautizada y que **no tiene acceso al sistema**: no recibe usuario, ni contraseña, ni correo de confirmacion.

## Requisitos previos

Antes de usar la carga masiva, asegurate de cumplir lo siguiente:

1. Tener rol **Admin** o **Superadmin** en el sistema.
2. Contar con un archivo en formato `.xlsx` (Excel).
3. La primera fila del archivo debe tener exactamente estas cabeceras, en el mismo orden y sin cambiar una sola letra:

   ```text
   Nombre, Apellidos, Documento, Fecha de nacimiento, Barrio, Telefono, Tipo de sangre, Sirve en un ministerio, Ministerio en el que sirve, Ministerio de interes, Ruta de crecimiento espiritual, Encuentro y Reencuentro
   ```

4. Cada fila a partir de la segunda representa una persona.

## Como usarlo

Sigue estos pasos:

1. Entra al modulo **Miembros**.
2. En la parte superior encontraras el boton **Cargar miembros**. Solo aparecerá si tienes rol Admin o Superadmin.
3. Pulsa el boton y selecciona tu archivo `.xlsx`.
4. Haz clic en **Importar**.
5. Espera el reporte. Veras tres numeros importantes:
   - **Total de filas**: cuantas personas intentaste importar.
   - **Insertados**: cuantas personas quedaron registradas en la base de datos.
   - **Errores**: cuantas filas no pudieron importarse.
6. Si hay errores, el reporte muestra la **fila**, el **numero de documento** y el **motivo** de cada fallo. Corrige tu archivo y vuelve a importar únicamente las filas que fallaron.

> **Nota**: las personas marcadas como "Insertados" ya quedaron guardadas. No es necesario volver a subirlas.

## Reglas de deduplicacion

El sistema evita duplicados por numero de documento de dos maneras:

- **Dentro del mismo archivo**: si una persona aparece dos veces, solo se inserta la primera fila. La segunda se reporta como duplicada dentro del archivo.
- **Contra la base de datos**: si el numero de documento ya existe en la iglesia, esa fila se reporta como duplicada contra la base de datos y no se inserta.

## Validaciones comunes que causan errores

A continuacion se listan los errores mas frecuentes y como corregirlos:

| Campo | Formato valido | Ejemplo de error |
| ----- | --------------- | ---------------- |
| Documento | Solo numeros, entre 6 y 10 digitos | "1234" (muy corto) o "ABC123" (letras) |
| Telefono | Exactamente 10 digitos, solo numeros | "300123" (incompleto) |
| Fecha de nacimiento | `DD/MM/YYYY` o `YYYY-MM-DD` | "08-08-2026" (guiones en lugar de barras o formato ISO) |
| Tipo de sangre | Uno de estos valores exactos: `O+`, `O-`, `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-` | "O positivo" (debe ser `O+`) |
| Sirve en un ministerio | `Si`, `Sí`, `No`, `true`, `false`, `1`, `0` | Cualquier otro texto |
| Ministerio en el que sirve | Obligatorio solo si "Sirve en un ministerio" es `Si`. Debe ser un ministerio valido del sistema. | Dejarlo vacio cuando respondio `Si` |
| Ministerio de interes | Obligatorio solo si "Sirve en un ministerio" es `No`. Debe ser un ministerio valido del sistema. | Dejarlo vacio cuando respondio `No` |
| Ruta de crecimiento espiritual | Debe coincidir exactamente con una etapa del sistema: `Consolidación`, `Discipulado básico`, `Carácter cristiano`, `Sanidad y propósito`, `Cosmovisión bíblica`, `Finanzas y Gobierno`, `Doctrina cristiana` | Abreviaturas o nombres distintos |
| Encuentro y Reencuentro | Uno de estos valores exactos: `Ninguno`, `Encuentro`, `Reencuentro` | "Ninguna" u otro texto |

## Limitaciones importantes

- Esta carga masiva solo crea **asistentes**: personas no bautizadas, sin acceso al sistema.
- **No** crea cuentas de login.
- **No** envia correos electronicos.
- El archivo no puede pesar mas de **5 MB**.
- Si necesitas registrar una persona bautizada con acceso al sistema, usa el formulario individual **Nuevo Miembro** en lugar de esta carga masiva.

## Ejemplo de plantilla

Puedes copiar la siguiente estructura para preparar tu archivo:

```text
Nombre,Apellidos,Documento,Fecha de nacimiento,Barrio,Telefono,Tipo de sangre,Sirve en un ministerio,Ministerio en el que sirve,Ministerio de interes,Ruta de crecimiento espiritual,Encuentro y Reencuentro
Juan,Perez Garcia,12345678,15/03/1995,El Prado,3001234567,O+,Si,Ministerio de Alabanza,,Consolidación,Ninguno
```

En este ejemplo:

- Juan sirve en un ministerio, por eso se llena "Ministerio en el que sirve" y se deja vacio "Ministerio de interes".
- Si Juan no sirviera en ningun ministerio, el campo "Sirve en un ministerio" llevaria `No` y se llenaria "Ministerio de interes" en lugar de "Ministerio en el que sirve".

---

*Si tienes dudas sobre el formato del archivo, consulta con el area de sistemas o revisa el contrato tecnico en `docs/api/members-bulk-import.md`.*
