# Carga masiva de asistentes con Excel o CSV

> **Audiencia**: Administradores y Superadmins de la iglesia.
> **Modulo**: Miembros.
> **Referencias tecnicas**:
> - Decision de arquitectura: `docs/adr/0010-members-bulk-import.md`
> - Decision de arquitectura sobre columnas duplicadas: `docs/adr/0012-bulk-import-duplicate-columns.md`
> - Decision de arquitectura sobre profesion y formatos de fecha: `docs/adr/0013-bulk-import-profession-date-formats.md`
> - Contrato API: `docs/api/members-bulk-import.md`

## Proposito

Esta funcionalidad permite registrar masivamente a personas que asisten a la iglesia como **asistentes**, subiendo un archivo `.xlsx` (Excel) o `.csv` (CSV). Normalmente ese archivo proviene de las respuestas de un Google Form. El formato `.csv` es el que Google Forms entrega por defecto al descargar las respuestas.

Un asistente es una persona que aun no esta bautizada y que **no tiene acceso al sistema**: no recibe usuario, ni contraseña, ni correo de confirmacion.

## Requisitos previos

Antes de usar la carga masiva, asegurate de cumplir lo siguiente:

1. Tener rol **Admin** o **Superadmin** en el sistema.
2. Contar con un archivo en formato `.xlsx` (Excel) o `.csv` (el formato que Google Forms entrega por defecto al descargar las respuestas).
3. La primera fila del archivo debe tener las **12 cabeceras obligatorias**, con esos nombres exactos y sin cambiar una sola letra. **El orden de las columnas no importa**: puedes ponerlas en el orden que necesites, siempre que la primera fila tenga esos textos. Las cabeceras son **las mismas** tanto si usas `.xlsx` como `.csv`:

   ```text
   Nombre, Apellidos, Documento, Fecha de nacimiento, Barrio, Telefono, Tipo de sangre, Sirve en un ministerio, Ministerio en el que sirve, Ministerio de interes, Ruta de crecimiento espiritual, Encuentro y Reencuentro
   ```

   Ademas, puedes incluir de forma opcional la columna **Profesión**. Es la respuesta a la pregunta "Profesión" del Google Form. Puede ir en cualquier posición del archivo. Si falta, el archivo funciona igual; si está, el sistema la guarda en el perfil del asistente y se verá en su tarjeta de miembro. El valor es texto libre y puede dejarse vacío.

4. Cada fila a partir de la segunda representa una persona.

## Como usarlo

Sigue estos pasos:

1. Entra al modulo **Miembros**.
2. En la parte superior encontraras el boton **Cargar miembros**. Solo aparecerá si tienes rol Admin o Superadmin.
3. Pulsa el boton y selecciona tu archivo `.xlsx` o `.csv`.
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
| Fecha de nacimiento | `DD/MM/AAAA`, `D/M/AAAA`, `DD-MM-AAAA`, `D-M-AAAA` o `AAAA-MM-DD`. Tambien entiende fechas reales de Excel si descargas el `.xlsx` desde Google Sheets. El dia va primero (formato colombiano/espanol): `19/08/1999`, `19/8/1999`, `19-08-1999`, `1999-08-19`. La fecha se guarda como fecha de calendario real, no como texto, por eso se ve bien formateada en las tarjetas de los miembros. | `8/19/1999` (estilo estadounidense, el mes va primero), `99-08-19` (año de 2 digitos), `19 de agosto de 1999` (texto largo) |
| Tipo de sangre | Uno de estos valores exactos: `O+`, `O-`, `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-` | "O positivo" (debe ser `O+`) |
| Sirve en un ministerio | `Si`, `Sí`, `No`, `true`, `false`, `1`, `0` | Cualquier otro texto |
| Ministerio en el que sirve | Obligatorio solo si "Sirve en un ministerio" es `Si`. Debe ser un ministerio valido del sistema. | Dejarlo vacio cuando respondio `Si` |
| Ministerio de interes | Obligatorio solo si "Sirve en un ministerio" es `No`. Debe ser un ministerio valido del sistema. | Dejarlo vacio cuando respondio `No` |
| Ruta de crecimiento espiritual | Debe coincidir exactamente con una etapa del sistema: `Ninguna`, `Consolidación`, `Discipulado básico`, `Carácter cristiano`, `Sanidad y propósito`, `Cosmovisión bíblica`, `Finanzas y Gobierno`, `Doctrina cristiana` | Abreviaturas o nombres distintos |
| Encuentro y Reencuentro | Uno de estos valores exactos: `Ninguno`, `Encuentro`, `Reencuentro` | "Ninguna" u otro texto |

## Limitaciones importantes

- Esta carga masiva solo crea **asistentes**: personas no bautizadas, sin acceso al sistema.
- **No** crea cuentas de login.
- **No** envia correos electronicos.
- El archivo no puede pesar mas de **5 MB**. Este limite aplica tanto para archivos `.xlsx` como para archivos `.csv`.
- Si necesitas registrar una persona bautizada con acceso al sistema, usa el formulario individual **Nuevo Miembro** en lugar de esta carga masiva.

## Ejemplo de plantilla

Puedes copiar la siguiente estructura para preparar tu archivo. Este mismo contenido sirve tanto para guardarlo como `.csv` como para pegarlo en una hoja de Excel y guardarlo como `.xlsx`:

```text
Nombre,Apellidos,Documento,Fecha de nacimiento,Barrio,Telefono,Tipo de sangre,Sirve en un ministerio,Ministerio en el que sirve,Ministerio de interes,Ruta de crecimiento espiritual,Encuentro y Reencuentro
Juan,Perez Garcia,12345678,15/03/1995,El Prado,3001234567,O+,Si,Ministerio de Alabanza,,Consolidación,Ninguno
```

Si tu archivo incluye la columna `Profesión`, el ejemplo queda asi:

```text
Nombre,Apellidos,Documento,Fecha de nacimiento,Barrio,Telefono,Tipo de sangre,Sirve en un ministerio,Ministerio en el que sirve,Ministerio de interes,Ruta de crecimiento espiritual,Encuentro y Reencuentro,Profesión
Maria,Lopez Diaz,87654321,8-8-1999,Centro,3009876543,A-,No,,Ministerio de Jóvenes,Discipulado básico,Ninguno,Docente
```

En estos ejemplos:

- Juan sirve en un ministerio, por eso se llena "Ministerio en el que sirve" y se deja vacio "Ministerio de interes".
- Si Juan no sirviera en ningun ministerio, el campo "Sirve en un ministerio" llevaria `No` y se llenaria "Ministerio de interes" en lugar de "Ministerio en el que sirve".
- Maria no sirve en un ministerio, por eso se llena "Ministerio de interes" y se deja vacio "Ministerio en el que sirve". Ademas, su archivo incluye la columna opcional "Profesión".

## Google Forms y los formatos de archivo

Si descargas las respuestas de un Google Form, el archivo vendra como `.csv` por defecto. Puedes subir ese `.csv` directamente al sistema, sin necesidad de convertirlo.

Si prefieres trabajar con un archivo de Excel (`.xlsx`), puedes vincular el Google Form a una Google Sheet y desde alli descargar las respuestas como Excel. Ambos formatos funcionan igual, siempre y cuando la primera fila tenga las cabeceras indicadas.

### Recomendacion: una sola seccion en el Google Form

Para que el archivo de respuestas sea lo mas sencillo posible, te recomendamos disenar el Google Form con **todas las preguntas en una sola seccion**, sin usar la opcion **"Ir a la seccion segun la respuesta"**. Asi cada pregunta aparecera una sola vez en el archivo descargado y sera mas facil revisarlo.

Para la pregunta **"Sirve en un ministerio"**, basta con incluir una nota dentro del mismo formulario que diga: si la persona responde **Si**, que llene el campo **"Ministerio en el que sirve"**; si responde **No**, que llene el campo **"Ministerio de interes"**. No es necesario crear secciones distintas.

Para la pregunta **"Profesión"**, usa una **respuesta corta** y dejala como opcional. Si no quieres recoger este dato, simplemente no incluyas la pregunta en el formulario.

### Plantilla de Google Form recomendada (una sola sección)

A continuación encontrarás el diseño exacto de preguntas que recomendamos usar en Google Forms. Si copias los textos tal como aparecen aquí, el sistema reconocerá automáticamente cada columna al descargar las respuestas.

| # | Texto de la pregunta (exacto) | Tipo de pregunta | ¿Obligatoria? | Opciones / validación |
| --- | --- | --- | --- | --- |
| 1 | Nombre | Respuesta corta | Sí | — |
| 2 | Apellidos | Respuesta corta | Sí | — |
| 3 | Documento | Respuesta corta | Sí | Validación: Número, longitud 6 a 10 |
| 4 | Fecha de nacimiento | Fecha | Sí | Sin hora |
| 5 | Barrio | Respuesta corta | Sí | — |
| 6 | Telefono | Respuesta corta | Sí | Validación: Número, longitud 10 (sin espacios) |
| 7 | Tipo de sangre | Desplegable | Sí | O+, O-, A+, A-, B+, B-, AB+, AB- |
| 8 | Sirve en un ministerio | Opción múltiple | Sí | Sí, No |
| 9 | Ministerio en el que sirve | Desplegable | No | ver lista de ministerios |
| 10 | Ministerio de interes | Desplegable | No | ver lista de ministerios |
| 11 | Ruta de crecimiento espiritual | Desplegable | Sí | ver lista de etapas (incluye `Ninguna` para miembros que aún no han iniciado la ruta) |
| 12 | Encuentro y Reencuentro | Desplegable | Sí | Ninguno, Encuentro, Reencuentro |
| 13 | Profesión | Respuesta corta | No | — |

#### Lista de ministerios

Copia exactamente estos valores en las preguntas 9 y 10:

```text
Ministerio de Alabanza
Ministerio de Danza
Ministerio de Audiovisuales
Ministerio de Varones
Ministerio de Jóvenes
Ministerio de Parejas y Familia
Ministerio de Mujeres
Ministerio de Evangelismo y Consolidación
Funda Esperanza
Ministerio de Servidores
Ministerio Infantil
Ministerio de Oración e Intercesión
Ministerio de Liberación
Ministerio de Misericordia
```

> **Archivos antiguos y alias legacy**: si descargas un archivo de respuestas anterior
> (por ejemplo, de una campaña pasada) que aún use los nombres viejos, el sistema los
> acepta igual y los convierte automáticamente al nombre oficial. Los alias compatibles
> son:
>
> | Alias legacy aceptado | Nombre oficial |
> | --- | --- |
> | Ministerio de Danza (Niñas entre 7 y 14 años) | Ministerio de Danza |
> | Ministerio de Hombres | Ministerio de Varones |
> | Ministerio de Parejas y Familias | Ministerio de Parejas y Familia |
> | Ministerio Iglesia Infantil | Ministerio Infantil |
> | Ministerio de Evangelismo y Consolidación G.V.E | Ministerio de Evangelismo y Consolidación |
>
> Si tienes perfiles guardados en la base de datos con los nombres viejos, el administrador
> puede ejecutar la migración correspondiente:
>
> ```bash
> npm run migrate:ministries-rename
> ```
>
> (comando del backend). Más detalles técnicos en
> `backend/src/config/migrations/20260915-ministries-rename.ts`.

#### Lista de etapas de crecimiento espiritual

Copia exactamente estos valores en la pregunta 11:

```text
Ninguna
Consolidación
Discipulado básico
Carácter cristiano
Sanidad y propósito
Cosmovisión bíblica
Finanzas y Gobierno
Doctrina cristiana
```

#### Nota sobre las preguntas 9 y 10

Las preguntas 9 y 10 son opcionales dentro del formulario. Cada persona llena solo la que le corresponde según su respuesta a "Sirve en un ministerio":

- Si respondió **Sí**, debe llenar **Ministerio en el que sirve** (pregunta 9) y dejar vacío **Ministerio de interes** (pregunta 10).
- Si respondió **No**, debe llenar **Ministerio de interes** (pregunta 10) y dejar vacío **Ministerio en el que sirve** (pregunta 9).

El sistema valida automáticamente la columna que corresponde según la respuesta. Si alguien llena las dos por error, no se rompe: cuando una misma pregunta aparece en varias columnas, el sistema toma la primera que tenga una respuesta (leyendo de izquierda a derecha) y luego aplica la regla correspondiente según "Sirve en un ministerio".

#### Reglas críticas

- Los textos de las preguntas deben ser exactamente los de la tabla, sin signos de interrogación, sin tildes adicionales y sin palabras de más. El sistema busca las cabeceras por ese texto; si una pregunta dice "¿Cuál es su nombre?" en vez de "Nombre", el sistema rechazará todo el archivo.
- **Telefono** y **Ministerio de interes** van sin tilde, tal como aparecen en la tabla. Las demás preguntas llevan las tildes indicadas.
- Las opciones de los desplegables deben llevar las tildes exactas de las listas anteriores. Por ejemplo, si el desplegable de etapas dice "Caracter cristiano" sin tilde, el sistema lo rechazará.
- Google Forms añade automáticamente una columna "Marca temporal" al inicio del archivo exportado. No es necesario borrarla, el sistema la ignora.
- La pregunta "Fecha de nacimiento" debe ser de tipo Fecha sin hora. El sistema acepta varios formatos de fecha reales: `19/08/1999`, `19/8/1999`, `19-08-1999`, `19-8-1999` o `1999-08-19`. Tambien entiende la celda de fecha si descargas un `.xlsx` real desde Google Sheets. El dia va primero (formato colombiano); escribir `8/19/1999` al estilo estadounidense dara error. La fecha se guarda como fecha de calendario real, no como texto, por eso se ve bien en las tarjetas de los miembros.
- La pregunta "Profesión" es opcional. Puedes incluirla una sola vez en una seccion unica, o repetirla en secciones condicionales; si aparece varias veces, el sistema toma la primera columna que tenga una respuesta (leyendo de izquierda a derecha).

### Si ya usas secciones condicionales

Si tu Google Form ya usa **"Ir a la seccion segun la respuesta"** —por ejemplo, para separar a quienes sirven de quienes no sirven en un ministerio— **no tienes que hacer nada a mano**. El sistema acepta el archivo igual.

Cuando una pregunta aparece repetida en varias secciones (por ejemplo, que **"Ruta de crecimiento espiritual"** o **"Profesión"** salgan dos veces), el sistema toma automaticamente la primera columna que tenga una respuesta (leyendo de izquierda a derecha) e ignora las columnas que quedaron vacias por la rama que no recorrio. No necesitas consolidar ni borrar columnas antes de subir el archivo.

---

*Si tienes dudas sobre el formato del archivo, consulta con el area de sistemas o revisa el contrato tecnico en `docs/api/members-bulk-import.md`.*
