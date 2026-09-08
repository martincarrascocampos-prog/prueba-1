# Sistema Plenario FECh

Sistema de votación ponderada para el Pleno de la Federación de Estudiantes de
la Universidad de Chile. En uso real: la FECh sesiona con esto.

**Idioma: responde siempre en español.**

---

## Antes de proponer o cambiar algo

Lee `docs/rediseno-2025.md`, en particular **§4.0 — Inventario de facultades
del administrador**. Es la lista de todo lo que el panel de administración sabe
hacer.

Esto no es formalidad. En la sesión donde se escribió este archivo estuve a
punto de borrar la ponderación alternativa, el sistema de palabra completo y
las unidades académicas, porque trabajé a partir de una maqueta que era una
simplificación. Me frenó el usuario, tres veces. No debe volver a depender de
eso.

---

## Archivos que NO se reescriben

Contienen lógica de dominio densa y en producción. Se editan quirúrgicamente,
nunca de cero:

| Archivo | Qué contiene |
|---|---|
| `artifacts/fech-plenario/src/pages/admin/session-detail.tsx` | Configuración de votaciones (ponderación normal/alternativa, multivoto, restricción por estamento), edición de asistencia, exportaciones a Excel |
| `artifacts/fech-plenario/src/pages/admin/members.tsx` | Alta y baja, ponderaciones editables en línea, contraseñas, unidades académicas |
| `artifacts/fech-plenario/src/components/speaking-panel.tsx` | Sistema de palabra: categorías pleno/base, palabra colectiva por unidad, siete controles por turno |
| `artifacts/fech-plenario/src/components/edit-votes-dialog.tsx` | Edición de votos ya emitidos |
| `artifacts/api-server/src/lib/results.ts` | Cálculo de resultados ponderados |

Las maquetas en `docs/mockups/` son **referencia visual de navegación**, no
especificación de comportamiento. Nunca implementes a partir de ellas.

---

## Invariantes del dominio

Romper cualquiera de estas corrompe la validez de las votaciones:

1. **La ponderación se congela por sesión** (`sessionWeights`). Editar el peso
   de alguien hoy no puede alterar los resultados de plenos pasados.
2. **La inasistencia justificada es solo una etiqueta.** No afecta el quórum ni
   habilita a votar. Solo cambia lo que muestra el acta.
3. **Quien se retira temprano asistió.** Cuenta como presente en la nómina,
   pero su peso se excluye de las votaciones posteriores.
4. **La confirmación previa de asistencia no es asistencia.** Si algún día se
   implementa, va en tabla separada de `attendance`; si se mezclaran, alguien
   podría contar para el quórum sin haber llegado.
5. **La ponderación alternativa** (`votingWeightAlt`) solo aplica cuando la
   votación es ponderada *y* está restringida a estamentos.

---

## Cómo trabajar

1. **Leer antes de escribir.** Auditar el código real, no suponer.
2. **Decir qué se tocó y qué no**, explícitamente, al terminar.
3. **Verificar antes de subir:**
   ```bash
   pnpm run typecheck
   pnpm --filter @workspace/fech-plenario run test
   ```
   Los tests de `api-server` fallan sin `DATABASE_URL` — es del entorno, no del
   código. Comprobar que el resultado sea el mismo antes y después.
4. **Cambios pequeños y verificables** antes que rediseños grandes.

---

## Entorno

- pnpm (no npm), Node 24, monorepo con workspaces
- Corre en Replit. Variables obligatorias: `DATABASE_URL`, `SESSION_SECRET`,
  `PORT`, `BASE_PATH` (ver `.env.example`)
- Instalación desde cero: `docs/instalacion-replit.md`
- `orval` no es dependencia: el cortafuegos de Replit lo bloquea y tumbaba
  `pnpm install`. Se invoca por npx solo al regenerar el cliente de la API

---

## Deuda técnica que bloquea la comercialización

Ver `docs/producto.md`. La más urgente:

**Las contraseñas se guardan en texto plano** (`users.plainPassword`) y se
exponen al administrador. Es una decisión pragmática para repartir claves a 90
personas, pero descalifica el sistema ante cualquier auditoría si se vende a
terceros.

---

## Estado

- Rama de trabajo: `claude/init-github-repo-c9GN1`
- El almacenamiento de actas está acoplado a Replit
  (`objectStorage.ts`, sidecar en `127.0.0.1:1106`). Fuera de Replit los PDF no
  funcionan; migrar a S3 es requisito para salir de la plataforma.
