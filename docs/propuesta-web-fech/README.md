# Propuesta v.2 — www.fech.cl

Maqueta visual de un sitio institucional para la FECh, en el que el **Sistema
Plenario deja de ser el sitio** y pasa a ser una de las herramientas que el sitio
ofrece, con acceso desde la barra superior derecha.

Base: la presentación «Propuesta de Modernización Digital» (10 secciones) y los
tokens de diseño que ya usa `artifacts/fech-plenario`.

**Esto es maqueta, no especificación de comportamiento.** Igual que
`docs/mockups/`: sirve para acordar navegación y estética, nunca para implementar
a partir de ella. Ver `CLAUDE.md`.

## Archivos

| Archivo | Pantalla |
|---|---|
| `Main.dc.html` | Inicio |
| `Pleno.dc.html` | El Pleno en tiempo real |
| `Representacion.dc.html` | Quién te representa |
| `Transparencia.dc.html` | Cuentas claras |
| `Bienestar.dc.html` | Bienestar y beneficios |
| `Arquitectura.dc.html` | Mapa del sitio (las 10 secciones → 7 entradas de menú) |
| `Movil.dc.html` | Inicio en móvil |
| `Sistema.dc.html` | Identidad y componentes |
| `canvas.json` | Posición de cada pantalla en el lienzo y notas al margen |

`web-fech-v2.html` es la salida generada (2,6 MB) y está en `.gitignore`: se
vuelve a armar desde los archivos de arriba.

## Datos pendientes

Todo lo que aparece entre corchetes es un dato real que falta y que **no se
inventó**: `[Nombre]`, `[MONTO]`, `[FECHA]`, `[DIRECCIÓN]`, `[HORARIO]`.

Dos cosas más:

- La marca de tres barras es provisoria. Reemplazar por el escudo oficial de la
  FECh en vectorial.
- Las barras del gráfico de ingresos y egresos son geometría de ejemplo, marcada
  como tal en la propia figura.

## Colores

Tomados del código, no elegidos de nuevo: azul `#0F388A`, alerta `#AD1F36`,
tinta `#1B2232`. Los cinco estamentos conservan color **y forma** —Mesa estrella
`#E5006D`, COSEFECH triángulo `#EA580C`, Consejerías círculo `#1D4ED8`, Centros
cuadrado `#047857`, otros rombo `#6D28D9`—: la forma es lo que los distingue en
blanco y negro y para quien no diferencia bien naranja de magenta.
