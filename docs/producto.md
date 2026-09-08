# ¿Puede esto ser un producto?

Evaluación honesta de la viabilidad comercial del Sistema Plenario, escrita en
septiembre de 2026. No es un plan de negocios: es una lectura de qué hay, qué
falta y qué conviene probar antes de invertir meses.

---

## Lo que ya es valioso

Lo valioso no es la aplicación. Es que **codifica reglas de deliberación que
casi nadie modela bien**. Tres ejemplos del propio código:

**Ponderación congelada por sesión** (`sessionWeights`). Cambiar hoy el peso de
una consejería no altera los resultados de plenos pasados. Eso es integridad de
actas, y es lo que evita que una votación sea impugnable.

**Ponderación alternativa** (`votingWeightAlt`). Una votación restringida a un
estamento puede necesitar pesos distintos a los del pleno completo.

**Inasistencia justificada como etiqueta.** No afecta quórum ni habilita a
votar; solo cambia el acta. Distinguir lo operativo de lo declarativo es
exactamente donde se rompen los sistemas mal hechos.

Eso es conocimiento de dominio, y es la parte difícil e insustituible de
cualquier software vertical. Las pantallas son reemplazables.

---

## El mercado obvio es el más difícil

Federaciones y centros de estudiantes tienen tres problemas como clientes:

1. **Presupuesto casi nulo.** Un CEE de facultad no tiene con qué pagar
2. **Dirigencia que rota cada año.** Hay que vender de nuevo cada 12 meses a
   gente que no te conoce
3. **Decisión asamblearia.** Comprar software se discute en un pleno

Se puede vender ahí, pero será lento y barato.

## Dónde sí hay presupuesto para exactamente esto

El motor —voto ponderado, quórum, actas, registro nominal— es lo que necesitan
organizaciones con obligaciones **legales**, no solo políticas:

| Organización | Por qué calza |
|---|---|
| Juntas de accionistas | El voto ponderado *es* por acciones. Quórum y actas obligatorios por ley |
| Cooperativas | Voto por socio o por participación; actas ante la autoridad |
| Colegios profesionales | Elecciones reguladas, quórums estatutarios |
| Sindicatos | Votaciones con validez legal |
| **Juntas de vecinos y condominios** | Quórum por coeficiente de copropiedad: voto ponderado puro. Mercado grande y desatendido |

Estas pagan porque un acta mal levantada les cuesta una impugnación.

---

## Lo que falta, sin adornos

### Bloqueante inmediato: contraseñas en texto plano

```
lib/db/src/schema/users.ts:15              plainPassword: text("plain_password")
artifacts/api-server/src/routes/members.ts:21   password: isAdmin ? m.plainPassword : null
```

Para uso interno tiene sentido: el administrador reparte claves a 90 personas.
Para un producto vendido a terceros es inaceptable — una filtración expone las
contraseñas de todos, y la gente las reutiliza en otros servicios. Cualquier
auditoría lo rechaza.

**Reemplazo razonable:** contraseña temporal de un solo uso que se muestra una
vez al crearla y obliga a cambiarla al primer ingreso. Se conserva la
practicidad de repartir claves sin almacenarlas.

### Multi-inquilino

Hoy sirve a una organización. Cada tabla necesitaría identificar a qué
organización pertenece cada fila, y cada consulta filtrar por ella. Es refactor
grande y transversal, no menor.

### Cumplimiento legal

En Chile la **Ley 21.719** de protección de datos personales entra en vigencia
a fines de 2026, con multas reales y una agencia fiscalizadora. Vender software
que procesa datos de miembros convierte al proveedor en responsable.

### Otros

- Almacenamiento de actas acoplado a Replit (ver `CLAUDE.md`)
- Cobro, registro autónomo, soporte, respaldos garantizados
- Cobertura de pruebas mínima

---

## Lectura de conjunto

Hay cerca del **40% de un producto**: la parte difícil e insustituible. El 60%
restante —multi-inquilino, seguridad, cumplimiento, ventas, soporte— es trabajo
poco vistoso, y es donde mueren la mayoría de estos proyectos.

Como esfuerzo lateral y sostenido: **plausible en 6 a 18 meses**. No en semanas.

**El riesgo no es técnico. Es encontrar quién paga.**

---

## Qué conviene hacer antes de invertir meses

En este orden:

1. **Usarlo en los plenos reales de la FECh este año.** Que funcione en
   condiciones reales, con 200 personas, es la mejor credencial posible
2. **Hablar con tres administradores de condominios.** Mostrarles el sistema y
   preguntar qué usan hoy para las juntas y qué les cuesta
3. **Si dos de tres se interesan**, ahí sí vale la pena construir
   multi-inquilino

Descubrir que nadie paga cuesta tres conversaciones. Descubrirlo después de
construir cuesta seis meses.

---

## Orden sugerido de trabajo técnico

Si se decide avanzar hacia producto:

1. Contraseñas de un solo uso (acotado; desbloquea cualquier conversación
   comercial)
2. Almacenamiento de actas en S3 (permite salir de Replit; ~250 líneas en un
   archivo)
3. Migración a hosting propio (~US$7/mes en Render + Neon + Cloudflare R2)
4. Multi-inquilino — **solo después de validar que alguien paga**
