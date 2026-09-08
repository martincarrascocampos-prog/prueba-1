# Rediseño 2025 — Especificación

Documento de trabajo que recoge las decisiones tomadas para el rediseño del
sistema. Sirve como referencia para implementar los cambios en el código real
(React + Express + Drizzle), independiente de las maquetas HTML de vista previa.

Estado de cada bloque:

| Bloque | Estado |
|---|---|
| Panel público | Implementado parcialmente (falta navegación por paneles) |
| Panel del integrante | Especificado, sin implementar |
| Panel de administración | Especificado, sin implementar |
| Confirmación de asistencia y correo interno | Requiere migración de base de datos |

Las maquetas HTML navegables de los tres paneles están en `docs/mockups/`. Son
referencia visual, no código de producción: la aplicación real es React +
TypeScript.

---

## 1. Sistema de diseño

Aplica a los tres paneles.

**Fondo blanco, color en los elementos.** Los paneles son blancos con bordes
finos; el color vive en iconos, insignias, barras y cifras, no en fondos
extensos.

**Paleta (colores puros):**

| Token | Valor | Uso |
|---|---|---|
| `--c-blue` | `#0B5FFF` | Consejerías FECh, acciones primarias |
| `--c-orange` | `#FF7A00` | COSEFECH, justificaciones, actas |
| `--c-green` | `#00B368` | CEE, asistencia presencial, quórum |
| `--c-violet` | `#7C3AFF` | Sesiones y votaciones |
| `--c-red` | `#FF2D55` | Sesión en vivo, votos en contra, alertas |
| `--c-cyan` | `#00B4D8` | Asistencia online, estadísticas |
| `--c-lime` | `#3DBE00` | Votos a favor, aprobado |
| `--c-amber` | `#FFB300` | Abstenciones |
| `--c-teal` | `#00A99D` | Intervenciones colectivas, integrantes |
| `--c-pink` | `#E5006D` | Administración |

Cada color tiene su tinte suave equivalente (`--t-blue`, `--t-orange`, …) para
fondos de insignias y bloques.

**Tipografía:** Libre Baskerville para títulos y cifras destacadas; IBM Plex
Sans para interfaz, texto y datos tabulares (`font-variant-numeric:
tabular-nums` en toda cifra que se alinee en columna).

**Temas:** los tokens se declaran completos en `:root` (claro), y se
redefinen en `@media (prefers-color-scheme: dark)` con guarda
`:root:not([data-theme="light"])` y en `:root[data-theme="dark"]`.

**Navegación por paneles superiores.** Los tres paneles usan una barra de
pestañas bajo el encabezado, cada una con su color. No es scroll continuo: se
elige qué ver.

---

## 2. Panel público (`/`)

Ruta: `artifacts/fech-plenario/src/pages/public-home.tsx`

### Pestañas

1. **Inicio** — sesión activa destacada, introducción, estadísticas, próximos plenos
2. **Composición del Pleno** — hemiciclo + integrantes por estamento
3. **Asistencias** — histórico por integrante, filtrable por estamento
4. **Sesiones y Votaciones** — acordeón con el detalle de cada pleno cerrado

### Sesión activa

Aparece **solo cuando hay una sesión abierta**, arriba de todo en Inicio. Si no
hay ninguna, el bloque no se renderiza y la introducción queda arriba.

Contiene: franja de color, insignia "PLENO EN CURSO" pulsante, título, fecha,
lugar, presentes, botón para unirse, barra de quórum en tiempo real y la tabla
de la sesión.

### Hemiciclo

SVG con los asientos distribuidos en cinco anillos por coordenadas polares
(178° a 2°):

| Anillo | Radio | Contenido |
|---|---|---|
| 1 | 95 | COSEFECH |
| 2 | 167 | Consejerías (tercio 1) |
| 3 | 239 | Consejerías (tercio 2) |
| 4 | 311 | Consejerías (tercio 3) |
| 5 | 383 | CEE |

Cada asiento muestra al pasar el cursor: estamento, nombre y facultad.

### Tabla de sesión

Lista ordenada con numeración `decimal-leading-zero`, minutos estimados por
punto, insignia "SE VOTA" en los puntos con votación, "EN DEBATE" en el punto
en curso, y pie con total de puntos y duración estimada.

### Detalle de votaciones

Se mantiene lo ya existente: barra de resultados con ponderación a favor / en
contra / abstención, insignia APROBADO/RECHAZADO, candidaturas en barras
horizontales, y desplegable con el voto de cada integrante.

### Endpoint

`GET /api/public/members` — ya implementado en
`artifacts/api-server/src/routes/history.ts`. Devuelve integrantes activos con
nombre, grupo y facultad. Sin credenciales ni ponderaciones.

---

## 3. Panel del integrante

Rutas: `artifacts/fech-plenario/src/pages/member/`

**Se mantiene todo lo existente.** El dashboard actual (marcar asistencia con
código o QR, modalidad presencial/online, mociones abiertas, tabla, sistema de
palabra, nómina en vivo, retirarse de la sesión) y el historial con sus
pestañas siguen igual. Lo de abajo se suma.

### Pestañas

1. **Sesión activa** — el dashboard actual, sin cambios de fondo
2. **Próximo pleno** — nuevo
3. **Mi historial** — el histórico actual, con el detalle de mociones agregado
4. **Mis intervenciones** — nuevo
5. **Correo interno** — nuevo

### 3.1 Detalle de las mociones en el histórico

La API **ya devuelve** el campo `detail` en `GET /history/me`; el histórico solo
muestra `title`. Basta con renderizarlo.

Se muestra en un bloque destacado con borde izquierdo azul y la etiqueta
"Detalle de la moción", entre el título y el voto propio.

### 3.2 Mis intervenciones

Origen: tabla `speaking_turns` (`lib/db/src/schema/speaking.ts`), filtrando por
`userId`.

Campos disponibles: `sessionId`, `agendaPointId`, `category` (pleno/base),
`kind` (individual/colectiva), `durationSeconds`, `elapsedSeconds`, `status`.

Estadísticas a mostrar:

- Intervenciones totales
- Tiempo total en uso de la palabra (suma de `elapsedSeconds`)
- Duración promedio
- Intervenciones colectivas
- Sesiones en que habló
- Porcentaje del tiempo asignado efectivamente usado

Y el listado: sesión, fecha, punto de tabla, tipo, categoría, tiempo asignado y
tiempo usado.

Falta un endpoint `GET /speaking/me` que devuelva los turnos del usuario con el
título de la sesión y del punto de tabla resueltos.

### 3.3 Próximo pleno y confirmación de asistencia

Muestra: cuenta regresiva (días, horas, puntos de tabla, votaciones), lugar,
fecha, enlace visible y copiable, y la tabla completa.

**Confirmación:** dos botones — "Confirmar asistencia" y "Justificar
inasistencia". El segundo abre un formulario con motivo (select) y detalle
(textarea).

**Plazo:** se muestra siempre junto a los botones, con los días restantes y en
rojo cuando quedan dos días o menos. Vencido el plazo, los botones se
reemplazan por un aviso y se remite al correo interno.

> **Decisión de diseño importante.** La confirmación previa es una *declaración
> de intención*, no asistencia real. Debe vivir en una tabla separada de
> `attendance`. Si se mezclaran, alguien podría contar para el quórum sin haber
> llegado, y eso rompería la integridad de la votación ponderada. El panel se lo
> recuerda explícitamente al integrante: "igual deberás registrar tu asistencia
> real al inicio de la sesión con el código del pleno".

### 3.4 Exportar mi historial

Botones para PDF y Excel con asistencias, detalle de cada moción con el voto
propio, e intervenciones. Un delegade de CEE necesita rendir cuentas ante su
asamblea; hoy tendría que sacar capturas de pantalla.

### 3.5 Estadísticas del historial

Anillo de asistencia más tarjetas: plenos asistidos, inasistencias, racha
consecutiva, comparación con el promedio del pleno, **mociones votadas sobre el
total** (asistir no es lo mismo que votar), abstenciones, intervenciones y
ponderación propia.

Cada sesión del histórico muestra **la ponderación con que pesó el voto en esa
sesión**, tomada del snapshot congelado (`sessionWeights`). Hoy no hay forma de
verificarlo desde el panel.

---

## 4. Panel de administración

Rutas: `artifacts/fech-plenario/src/pages/admin/`

Se llama **Administración**, no "Mesa Directiva": la Mesa es un usuario del
sistema, no el nombre del panel.

**Se mantienen todas las herramientas actuales.** Crear sesión, subir y quitar
acta, gestionar tabla, mociones, sistema de palabra, alta y baja de
integrantes, restablecer contraseñas, ver asistencia individual, unidades, y
las tres exportaciones (asistencia, resultados, matriz).

### 4.1 Estructura: listado y editor

> **Decisión de arquitectura.** El panel **es el listado de sesiones**. No hay
> pestañas de "Resumen", "Sesión en vivo" y "Próximo pleno" en paralelo: eso
> repartía la información de las sesiones en tres lugares y obligaba a
> mantenerla sincronizada entre ellos. Tampoco encabeza con tarjetas de
> estadísticas (integrantes, ponderación total, mociones votadas) — son cifras
> de adorno que no permiten hacer nada.
>
> Se administra una sesión a la vez. Entonces: una lista, y se entra a editar
> cada sesión directamente.

**Vista principal — listado de sesiones.** Agrupadas en "En curso y próximas" y
"Cerradas". Cada fila muestra estado (EN VIVO / PRÓXIMA / CERRADA), título,
fecha, lugar, cantidad de puntos y mociones, y un dato vivo según su estado:

| Estado | Dato en la fila | Acción |
|---|---|---|
| En vivo | presentes y % de quórum | Conducir |
| Próxima | confirmades y justificaciones por revisar | Preparar |
| Cerrada | presentes y si tiene acta subida | Ver |

Botón **Nueva sesión** que abre el formulario en la misma vista, sin navegar.

**Vista de sesión — editor completo.** Todo lo de esa sesión en una página, en
secciones plegables. Qué secciones aparecen y en qué orden depende del estado:

| Estado | Secciones, en orden |
|---|---|
| En vivo | Código de asistencia · Asistencia y quórum · Tabla · Mociones · Sistema de palabra · Datos · **Cerrar la sesión** |
| Próxima | Datos · Tabla · Confirmaciones · Justificaciones · Mociones preparadas · **Abrir la sesión** |
| Cerrada | Resultados · Asistencia registrada · Tabla tratada · Acta y exportaciones · Datos |

Las secciones más urgentes vienen abiertas por defecto (en vivo: código,
asistencia y mociones; próxima: datos, tabla, confirmaciones y justificaciones
pendientes).

**Integrantes** queda como vista secundaria, accesible desde un enlace en el
encabezado. Es mantenimiento, no la tarea diaria: no compite con las sesiones.

### 4.2 Alerta de quórum

Dentro de la sesión, no en un resumen aparte. Compara la ponderación presente
(o proyectada, en una sesión próxima) contra el mínimo reglamentario, y dice
explícitamente si el pleno puede votar. En una sesión próxima indica cuánta
ponderación falta.

El mínimo está como constante `QUORUM = 0.5`; conviene confirmarlo contra los
Estatutos antes de implementar.

### 4.3 Control de la sesión en vivo

- **Código de asistencia** en grande, con botones para mostrar el QR a pantalla
  completa y regenerarlo
- **Asistencia** con anillo, barras por estamento, nómina de presenciales,
  online y ausentes; los ausentes se marcan como Inasistencia Justificada
  haciendo clic en su nombre
- **Tabla** con puntos marcados como tratado / en debate / se vota
- **Mociones** con abrir y cerrar votación, resultados en vivo mientras está
  abierta, cuántos votos faltan por emitir, y acceso al detalle nominal
- **Sistema de palabra** con temporizador, dar y quitar la palabra, agregar
  minutos, cerrar ronda
- **Cerrar sesión** en una sección propia marcada en rojo, con advertencia de
  que es irreversible

### 4.4 Confirmaciones y justificaciones (sesión próxima)

Cuatro indicadores: confirmades, justificades, sin responder y quórum
proyectado. Más los nombres de quienes confirmaron y de quienes no han
respondido, con un botón para enviarles recordatorio.

**Bandeja de justificaciones:** cada una con nombre, estamento, facultad,
motivo, texto completo, y botones para aceptar, rechazar o responder por correo
interno. El contador de pendientes aparece en la cabecera de la sección y en la
fila de la sesión en el listado.

> Al aceptar una justificación, esta queda registrada en `justified_absences`.
> La persona **sigue contando como ausente** para el quórum y no puede votar —
> solo cambia la etiqueta. El panel lo dice explícitamente para que no se preste
> a confusión.

### 4.5 Reportes nuevos

Las tres exportaciones actuales viven **dentro de cada sesión cerrada**, junto
al acta, que es donde se ocupan. Además:

- **Acta en PDF** con tabla, asistencia, intervenciones y resultados
- **Asistencia acumulada** del período por integrante
- **Uso de la palabra** por integrante y estamento
- **Histórico de ponderaciones** — con cuánto pesó cada integrante en cada
  sesión; deja trazabilidad de los cambios

---

## 5. Migraciones de base de datos pendientes

Ninguna de estas tablas existe todavía.

### 5.1 `session_rsvp` — confirmación previa

```ts
export const rsvpStatusEnum = pgEnum("rsvp_status", ["confirmada", "justificada"]);
export const justificationStatusEnum = pgEnum("justification_status", [
  "pendiente",
  "aceptada",
  "rechazada",
]);

export const sessionRsvpTable = pgTable(
  "session_rsvp",
  {
    sessionId: integer("session_id").notNull()
      .references(() => plenariasTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: rsvpStatusEnum("status").notNull(),
    // Solo cuando status = "justificada"
    reasonCategory: text("reason_category"),
    reasonText: text("reason_text"),
    reviewStatus: justificationStatusEnum("review_status"),
    reviewedBy: integer("reviewed_by").references(() => usersTable.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);
```

**Esta tabla nunca alimenta el quórum ni la elegibilidad para votar.** Solo
sirve para proyectar asistencia antes de la sesión. Cuando una justificación se
acepta (`reviewStatus = "aceptada"`), se inserta la fila correspondiente en
`justified_absences`, que es la que produce la etiqueta en el acta.

### 5.2 `internal_messages` — correo interno

```ts
export const internalMessagesTable = pgTable("internal_messages", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  // null = mensaje a todo el pleno (citación, aviso general)
  toUserId: integer("to_user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => plenariasTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("info"), // citacion | respuesta | info
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 5.3 Plazo de confirmación

Agregar a `plenarias`:

```ts
confirmDeadline: timestamp("confirm_deadline", { withTimezone: true }),
```

---

## 6. Endpoints pendientes

| Método y ruta | Descripción |
|---|---|
| `GET /sessions/:id/rsvp/me` | Mi respuesta al próximo pleno |
| `POST /sessions/:id/rsvp` | Confirmar o justificar (valida el plazo) |
| `GET /sessions/:id/rsvp` | *(admin)* Todas las respuestas y el quórum proyectado |
| `PATCH /sessions/:id/rsvp/:userId` | *(admin)* Aceptar o rechazar justificación |
| `GET /speaking/me` | Mis intervenciones con sesión y punto resueltos |
| `GET /messages` | Mi correo interno |
| `POST /messages` | *(admin)* Enviar mensaje o citación |
| `GET /export/history/me` | Mi historial en PDF o Excel |

---

## 7. Decisiones descartadas

**Mostrar a cada integrante quién más confirmó asistencia.** Es útil para la
Mesa, pero para el resto expone quién va a faltar antes de que ocurra y genera
presión sobre las personas. Se mantiene visible solo para administración.
