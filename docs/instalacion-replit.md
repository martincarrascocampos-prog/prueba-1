# Levantar el sistema en una cuenta de Replit

Guía para poner en marcha el Sistema Plenario FECh desde cero en un Repl nuevo.

---

## 1. Importar el proyecto

**Create Repl** → pestaña **Import from GitHub** → pega la URL del repositorio y
elige la rama.

Si el repositorio es privado, hay que conectar antes la cuenta de GitHub en
*avatar → Account → Connected services*.

---

## 2. Crear la base de datos

**Tools → PostgreSQL → Create a database.**

Replit define `DATABASE_URL` automáticamente. No hay que escribirla a mano.

---

## 3. Definir los secretos

**Tools → Secrets.** Estas tres son obligatorias y **no vienen configuradas**:

| Clave | Valor | Para qué |
|---|---|---|
| `SESSION_SECRET` | un texto largo y aleatorio | Firma las sesiones de inicio de sesión |
| `PORT` | `5000` | Puerto donde escucha la aplicación |
| `BASE_PATH` | `/` | Prefijo de rutas del frontend |

> Sin `PORT` o `BASE_PATH`, el frontend falla al compilar con
> `PORT environment variable is required but was not provided`.

Ver `.env.example` en la raíz para la lista completa, incluidas las opcionales.

---

## 4. Instalar y preparar la base

En la **Shell** (no la Console — la Console no acepta comandos):

```bash
pnpm install
```

```bash
pnpm --filter @workspace/db run push
```

```bash
pnpm --filter @workspace/scripts run seed
```

El `push` crea las tablas a partir del esquema; el `seed` carga la nómina del
pleno con sus ponderaciones.

> El proyecto exige **pnpm**. Con `npm install` responde `Use pnpm instead` y
> no instala nada.

---

## 5. Ejecutar

Presiona **Run**.

### Credenciales iniciales

| Rol | Usuario | Contraseña |
|---|---|---|
| Administración | `FECH` | `1906` |
| Integrantes | su usuario (ej. `sofia.vallejos`) | `1234` |

**Cámbialas antes de usar el sistema con datos reales.** Están definidas en
`scripts/src/seed.ts`.

---

## Problemas frecuentes

| Mensaje | Causa y solución |
|---|---|
| `PORT environment variable is required` | Falta el secreto `PORT`. Paso 3 |
| `BASE_PATH environment variable is required` | Falta el secreto `BASE_PATH`. Paso 3 |
| `DATABASE_URL must be set` | Falta crear la base. Paso 2. Si ya existe, reinicia el Repl para que tome la variable |
| `Use pnpm instead` | Estás usando `npm`. Usa `pnpm` |
| `drizzle-kit: not found` | La instalación no terminó. Repite `pnpm install` |
| `ERR_PNPM_FETCH_403 ... Forbidden` | El cortafuegos de Replit bloqueó un paquete. Ver la nota siguiente |

### Sobre el cortafuegos de paquetes de Replit

Replit bloquea la descarga de algunos paquetes de npm. Esto tumbaba la
instalación completa por culpa de `orval`, una herramienta que **sólo** se usa
para generar el cliente de la API a partir de `openapi.yaml`.

Como el código generado está versionado, `orval` ya no es una dependencia del
proyecto: se invoca por `npx` únicamente cuando hace falta regenerar.

Si alguna vez modificas `lib/api-spec/openapi.yaml`, regenera con:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Ese comando descarga orval al vuelo. Si el cortafuegos lo bloquea, ejecútalo
fuera de Replit y sube los archivos generados.

---

## Actualizar el proyecto desde GitHub

Los cambios en GitHub **no bajan solos**:

```bash
git pull origin <rama>
```

Después presiona **Run**. Sólo hace falta algo más si:

| Cambió | Comando adicional |
|---|---|
| `package.json` | `pnpm install` |
| El esquema de la base | `pnpm --filter @workspace/db run push` |
