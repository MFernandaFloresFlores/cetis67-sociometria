# Plataforma Integral de Sociometría y Salud Emocional · CETIS 67

Aplicación web responsive para gestión escolar, cuestionarios por QR, sociometría,
salud emocional, relaciones personales, integración/segregación, alertas, informes y bitácora.

> **Aviso importante**: los resultados de esta plataforma son **indicadores preventivos,
> no diagnósticos**. No confirman por sí solos acoso escolar ni condiciones clínicas;
> deben interpretarse por personal capacitado.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js 22+ · Express · SQLite (`node:sqlite`, sin dependencias nativas) |
| Frontend | React 18 · Vite · React Router |
| Auth | JWT en cookie httpOnly, bloqueo por intentos, sesión con renovación deslizante |
| QR | Generación PNG/SVG en servidor (`qrcode`) |
| Importación | `.xlsx`, `.xls`, `.csv` con vista previa y validaciones |

## Requisitos

- Node.js **22 o superior** (usa el módulo `node:sqlite` integrado).

## Instalación en una PC nueva (uso real, recomendado)

Doble clic en **`instalar.bat`** (Windows). Instala todo, genera `server/.env` con la IP de
red correcta, compila, deja el servidor corriendo con `pm2`, y **al final te pide escribir
tú mismo el nombre y la contraseña** de la cuenta `admin` — esa es la contraseña real que hay
que usar para entrar, **no** `admin123` (esa solo existe en el modo de pruebas de abajo).
Si se te olvidó qué contraseña pusiste, ver la sección **"¿Se te olvidó la contraseña de
admin?"** más abajo para restablecerla.

Después de esa primera vez, `iniciar-servidor.bat` sirve para arrancar/verificar el servidor.

## Instalación para desarrollo o pruebas (datos de ejemplo, NO producción)

```bash
npm run install:all   # instala server y client
npm run seed          # crea usuarios y datos de ejemplo (ver tabla abajo) — NO usar en un plantel real
npm run build         # compila el frontend (client/dist)
npm start             # sirve API + frontend en http://localhost:3000
```

Para desarrollo con recarga: `npm run dev` (servidor) y `npm --prefix client run dev` (Vite en :5173 con proxy a la API).

### Usuarios de ejemplo (solo si usaste `npm run seed`)

Estas cuentas **no existen** en una instalación real hecha con `instalar.bat` — ahí la
contraseña de `admin` es la que se escribió durante la instalación.

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Administración (control total) |
| `profe.laura` | `profe123` | Docente (solo sus grupos) |
| `orientacion` | `orienta123` | Orientación (alertas y seguimiento) |
| `auditor` | `audita123` | Auditoría (bitácora, solo lectura) |

La semilla imprime el enlace público de la aplicación demo (`/r/<token>`), también visible
en **Formularios y QR → Ver QR**. Dos matrículas sin responder para probar el flujo del
alumno: `26670122` y `26670123` (si ya se usaron, crea una aplicación nueva).

## ¿Se te olvidó la contraseña de admin?

No hay recuperación por correo. Se restablece por línea de comandos, sin perder ningún dato —
ver **"Gestión de usuarios de personal"** más abajo.

## Variables de entorno (`.env` o entorno del proceso)

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `JWT_SECRET` | **Cámbialo en producción** | valor inseguro de desarrollo |
| `SESSION_MINUTES` | Minutos de inactividad antes de cerrar sesión | `60` |
| `PUBLIC_URL` | URL pública para los QR (ej. `https://sociometria.cetis67.edu.mx`) | host de la petición |
| `DATA_DIR` | Carpeta de la base SQLite | `server/data` |
| `NODE_ENV` | `production` activa cookies `secure` (requiere HTTPS) | — |

## Estructura

```
server/src/
  db.js                 Esquema completo (27 entidades) y conexión
  middleware/auth.js    JWT, roles, mínimo privilegio, auditoría
  services/emotional.js Test de 25 ítems, inversos, rangos 0-100
  services/sociometry.js Métricas, tipos, segregación, alertas, relaciones
  routes/               auth · catalog (ABC+import) · forms (QR) · public (alumno) · results · alerts
  seed.js               Datos demo reproducibles
client/src/
  pages/                Login, Inicio, Alumnos, Perfil, Grupos, Formularios/QR, Matriz,
                        Sociograma, Salud emocional, Segregación, Alertas, Informes,
                        Bitácora, Importar, PublicForm (flujo del alumno)
```

## Reglas de negocio implementadas

- Respuestas originales **inalterables** tras el envío (folio único por respuesta).
- Sin autoelección, sin repetir compañero, sin elegir fuera del grupo, sin doble envío.
- Bajas y cambios de grupo **no borran historial** y exigen motivo (auditado con valores
  anteriores y nuevos).
- Cálculo bloqueado con participación < 60 % (override explícito y auditado).
- Ítems inversos del test emocional: 1, 5, 7, 10, 11, 13, 15, 16, 17, 20, 21, 22, 23, 25.
- Segregación: `Índice = (H_obs − H_esp) / (1 − H_esp)` por dimensión y tipo de relación.
- Profesores solo ven grupos asignados; auditor solo lee bitácora; toda consulta sensible
  (perfiles, salud emocional, exportaciones) queda en `audit_logs`.

## Despliegue en producción

- **En una PC de la escuela (Windows), red local**: usa `instalar.bat` (ver arriba). Es el
  caso cubierto y probado en este proyecto — ver "Estado actual de esta instalación" abajo.
- **En un servidor remoto con dominio propio (Linux/VPS)**, para que funcione fuera de la
  red local:
  1. Node 22+, HTTPS obligatorio (proxy inverso Nginx/Caddy).
  2. Define `JWT_SECRET` fuerte, `NODE_ENV=production`, `PUBLIC_URL` (con `https://`) y
     `DATA_DIR` en disco persistente — en `server/.env`.
  3. `npm run install:all && npm run build && npm start` (usa `pm2` o `systemd` para
     mantenerlo vivo).
  4. Respaldos: copia periódica del archivo `DATA_DIR/cetis67.db` (SQLite en modo WAL).
  5. Crea la cuenta admin real (ver "Gestión de usuarios de personal") — nunca uses `npm run
     seed` en un servidor con alumnos reales.

## Gestión de usuarios de personal

No existe pantalla para crear/editar cuentas de personal (admin, docente, orientación,
auditoría). Se gestionan por línea de comandos:

```bash
cd server
npm run create-user -- <usuario> "<Nombre completo>" <admin|teacher|counselor|auditor> <contraseña>
```

Si el usuario ya existe, el mismo comando actualiza su nombre/rol/contraseña (sirve también
para cambiar contraseñas, ya que tampoco hay recuperación por correo). Después de cambiar
una contraseña con el servidor ya corriendo, reinícialo para que tome efecto: `pm2 restart cetis67`.

## Estado actual de esta instalación

- Corre en esta PC (Windows), red local de la escuela. `server/.env` fija `PUBLIC_URL` a la
  IP de la máquina en esa red para que los QR funcionen en celulares de alumnos conectados
  al mismo WiFi. **Si el router reasigna esa IP (DHCP), los QR ya generados dejan de
  funcionar** — hay que actualizar `PUBLIC_URL`, reiniciar el servidor y regenerar los QR
  activos. Ideal: reservar la IP como fija en el router.
- `NODE_ENV=production` queda **desactivado a propósito** en `server/.env` (activa cookies
  `secure`, que requieren HTTPS; sin eso, el login del personal se rompería). Si más adelante
  consiguen dominio propio con HTTPS, descomenten esa línea y pongan un proxy inverso
  (Nginx/Caddy) delante.
- El servidor corre de forma **permanente** con `pm2` (`pm2 status` para ver su estado,
  `pm2 logs cetis67` para ver el registro). No depende de tener una ventana abierta: cerrar
  la terminal, cerrar sesión de Windows o incluso reiniciar la PC no lo apaga — `pm2` lo
  reinicia solo (registrado para arrancar con el inicio de sesión de Windows). Para
  arrancarlo/verificar manualmente, doble clic en `iniciar-servidor.bat`; para apagarlo,
  `detener-servidor.bat` o `pm2 stop cetis67`.
- **Límite real que sigue existiendo**: los alumnos solo pueden acceder al formulario si su
  celular está en la **misma red WiFi** que esta PC (no funciona con datos móviles ni desde
  otra red). Esto no es una falla de configuración — es porque el servidor vive en esta PC,
  no en internet. La única forma de quitar esa limitación es alojar la plataforma en un
  servidor con acceso a internet (VPS/hosting con dominio y HTTPS); si esto se vuelve
  necesario, es un cambio de infraestructura a planear aparte, no un ajuste del código.
- Base de datos limpia, sin datos de demostración. Antes de operar: importar alumnos reales
  (Importar alumnos, .xlsx/.xls/.csv) o crearlos manualmente, crear grupo(s) y periodo,
  crear formulario y generar su QR desde Formularios y QR.

## Limitaciones conocidas / siguientes pasos

- Módulo DEVS (consola/sandbox/feature flags) y notificaciones: previstos en el esquema, sin UI.
- 2FA, recuperación de contraseña por correo y retención configurable: pendientes (usa
  `npm run create-user` para cambiar contraseñas mientras tanto).
- Para más de ~10 000 alumnos o alta concurrencia, migrar a PostgreSQL (la capa `db.js`
  concentra el acceso a datos para facilitarlo).
