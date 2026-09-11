# Manual de uso — Plataforma CETIS 67

Guía para el personal (Dirección, Docentes, Orientación, Auditoría) y referencia rápida
del flujo que siguen los alumnos al responder desde su celular.

> Los resultados de esta plataforma son **indicadores preventivos, no diagnósticos**.
> No confirman por sí solos acoso escolar ni condiciones clínicas; deben interpretarse
> por personal capacitado.

---

## 1. Cómo entrar

1. Abre el navegador en `http://localhost:3000` (en la PC del servidor) o en la IP de
   red que te haya dado el administrador (ej. `http://192.168.0.7:3000`).
2. Escribe tu usuario y contraseña y presiona **Iniciar sesión**.
3. Si te equivocas 5 veces seguidas, la cuenta se bloquea 15 minutos por seguridad.
4. La sesión se cierra sola tras 60 minutos sin actividad. Cada acción que haces la
   renueva automáticamente.

No hay recuperación de contraseña por correo. Si la olvidas, pide al administrador que
te la restablezca (ver sección 9).

---

## 2. Qué ve cada rol

El menú lateral cambia según tu rol — solo ves lo que te corresponde:

| Módulo | Dirección (admin) | Docente | Orientación | Auditoría |
|---|:-:|:-:|:-:|:-:|
| Inicio | ✔ | ✔ | ✔ | ✔ |
| Alumnos | ✔ | ✔ (solo sus grupos) | ✔ | ✔ (solo lectura) |
| Matriz sociométrica | ✔ | ✔ | ✔ | ✔ |
| Sociograma | ✔ | ✔ | ✔ | ✔ |
| Salud emocional | ✔ | ✔ | ✔ | ✘ |
| Integración del grupo | ✔ | ✔ | ✔ | ✔ |
| Alertas y seguimiento | ✔ | ✔ | ✔ | ✘ |
| Informes | ✔ | ✔ | ✔ | ✔ |
| Grupos y periodos | ✔ | ✘ | ✘ | ✘ |
| Formularios y QR | ✔ | ✘ | ✘ | ✘ |
| Importar alumnos | ✔ | ✘ | ✘ | ✘ |
| Bitácora | ✔ | ✘ | ✘ | ✔ |

Un docente solo ve los grupos que tiene asignados. Todo lo que consultes en perfiles,
salud emocional o exportaciones queda registrado en la Bitácora.

---

## 3. Inicio (dashboard)

Al entrar ves, para la aplicación (formulario · grupo) seleccionada:

- **% de participación** (cuántos alumnos ya respondieron) — si es menor al 60%, el
  sistema bloquea el cálculo de resultados hasta que se autorice explícitamente.
- Densidad de elecciones positivas y amistades recíprocas por alumno.
- Alertas abiertas recientes.
- Distribución de tipos sociométricos (Preferido, Promedio, Ignorado, Controvertido,
  Rechazado).

Arriba de cada módulo de resultados hay un selector **"Aplicación (formulario · grupo)"**
para cambiar de grupo/formulario sin salir de la pantalla.

---

## 4. Alumnos y resultados individuales

Tabla con cada alumno del grupo elegido: tipo sociométrico, NPR/NNR (nominaciones
recibidas positivas/negativas), NPRv/NNRv (valor ponderado), impacto, preferencia y
recíprocas.

- **Buscar** por nombre o matrícula, **filtrar** por tipo sociométrico.
- **Exportar CSV** con todas las métricas.
- **Recalcular** — vuelve a correr el cálculo con las respuestas más recientes. Si la
  participación es menor al 60%, pedirá confirmación explícita para forzarlo (queda
  registrado en Bitácora con el motivo).
- **Ver perfil** en cada fila abre la ficha individual del alumno: sus métricas,
  resultado del test emocional y una casilla para dejar observaciones de seguimiento.

---

## 5. Matriz sociométrica

Tabla cruzada: filas = quien emite la elección, columnas = quien la recibe.
`+` positiva, `−` negativa, `±` ambas. Alterna entre **Nominaciones** (elecciones
reales del alumno) y **Percepciones** (a quién cree el alumno que él eligió/rechazó).
Se puede exportar a CSV o imprimir.

## 6. Sociograma

Representación gráfica (SVG) de la red de relaciones del grupo: quién está en el
centro (popular), quién aislado, quién en conflicto recíproco.

## 7. Salud emocional

Resultados del test de 25 ítems por alumno (rango 0–100), con 5 secciones: estado
emocional, estrés escolar, autoestima y seguridad, relaciones sociales, hábitos y
bienestar. 14 de los 25 ítems son inversos (se recalculan automáticamente).

## 8. Integración del grupo (segregación)

Índice de segregación por dimensión (ej. género) y tipo de relación:
`Índice = (H_obs − H_esp) / (1 − H_esp)`. Ayuda a detectar si el grupo se divide en
subgrupos cerrados.

## 9. Alertas y seguimiento

Lista de alumnos que requieren atención (rechazo social, conflicto recíproco, malestar
emocional alto), con prioridad (Urgente/Alta/Media/Baja) y estado (Nuevo/En
seguimiento/Cerrado). Solo Dirección, Docentes y Orientación pueden gestionarlas.

## 10. Informes

Informe grupal listo para imprimir/exportar, con el resumen de todos los módulos
anteriores para presentar a Dirección u Orientación.

---

## 11. Grupos y periodos *(solo Dirección)*

1. **Crear periodo** — ej. "2026-2027 A".
2. **Crear grupo** — elige periodo, plan de estudios, semestre, letra, turno y
   profesor/a (opcional). El profesor debe existir primero (se puede crear desde
   la sección de Formularios/Alertas donde aparezca el selector de docentes, o pide
   al administrador técnico que le dé de alta su cuenta — ver sección 15).
3. Los grupos existentes aparecen abajo con su cantidad de alumnos. Cada grupo tiene:
   - **Ver alumnos** — despliega la lista de alumnos inscritos en ese grupo.
   - **Agregar alumno** — alta individual (matrícula, nombre, apellidos, género, edad,
     correo) sin necesidad de subir un Excel.
   - **Editar** — corrige plan de estudios, semestre, letra, turno o profesor/a.
   - **Eliminar** — solo si el grupo **nunca tuvo alumnos inscritos**. Si ya tuvo, el
     sistema lo bloquea y sugiere dar de baja a los alumnos o dejar el grupo así (su
     historial nunca se borra).

Dentro de "Ver alumnos", cada alumno tiene cuatro acciones:

| Acción | Qué hace | Requiere motivo | Se puede deshacer / bloqueos |
|---|---|:-:|---|
| **Editar** | Corrige nombre, apellidos, género, edad, correo u observaciones. La matrícula no se puede cambiar aquí. | No (solo revisar y confirmar) | — |
| **Cambio de grupo** | Mueve al alumno a otro grupo del mismo periodo. | Sí | El grupo destino debe ser del mismo periodo |
| **Baja** | Marca al alumno como dado de baja. **No borra nada** — sus respuestas y resultados anteriores se conservan y siguen apareciendo en los reportes. | Sí | No se puede volver a dar de baja a quien ya está de baja |
| **Eliminar** | Borra por completo la inscripción (y al alumno, si no tiene inscripciones en otros periodos ni observaciones). Úsalo solo para corregir un alta hecha por error. | Sí | **Bloqueado** si el alumno ya tiene respuestas, fue mencionado por un compañero, o tiene alertas registradas — en ese caso usa Baja en su lugar |

Todas estas acciones (editar/eliminar grupo, editar/cambio de grupo/baja/eliminar alumno)
piden confirmar antes de aplicarse y quedan registradas en la Bitácora con fecha y hora,
motivo (cuando aplica), y los valores anteriores y nuevos — ver sección 14.

## 12. Formularios y QR *(solo Dirección)*

Este es el flujo para que los alumnos puedan responder por su cuenta:

1. **Nuevo formulario** — dale un título (ej. "Sociometría y bienestar · Otoño 2026")
   y elige el tipo (sociométrico, salud emocional, o combinado).
2. El formulario se crea en estado **borrador** — presiona **Activar** para que pueda
   usarse.
3. **Nueva aplicación (formulario → grupo)** — elige el formulario activo y el grupo,
   y presiona **Generar QR y enlace**. Esto crea el enlace único `/r/<token>` para ese
   grupo.
4. Presiona **Ver QR** para ver el código QR (imagen PNG), el enlace directo, y botones
   para **Copiar enlace**, **Descargar PNG**, **Descargar SVG** y **Regenerar** (invalida
   el QR anterior si se filtró).
5. Comparte el QR o el enlace con el grupo — proyectándolo en clase, imprimiéndolo, o
   mandándolo por el medio que use la escuela (classroom, grupo de WhatsApp del salón,
   etc.). **El enlace no contiene datos personales**, así que es seguro compartirlo
   ampliamente siempre que solo llegue al grupo correspondiente.
6. Con el botón **Pausar** puedes desactivar temporalmente una aplicación (por ejemplo,
   si detectas un error en el formulario) sin perder las respuestas ya recibidas.

### Cómo responde el alumno (sin cuenta, desde su celular)

1. Escanea el QR o abre el enlace → pantalla de bienvenida con el aviso de privacidad.
2. Presiona **Comenzar** → escribe su **matrícula** → **Continuar**.
3. Si es sociométrico: elige hasta 3 compañeros por pregunta, en orden de preferencia.
   El sistema no deja elegirse a sí mismo ni repetir al mismo compañero dos veces en la
   misma pregunta. Las dos primeras preguntas (con quién le gustaría convivir / con
   quién le costaría trabajo) son obligatorias; las otras dos son opcionales.
4. Si el formulario incluye salud emocional: responde las 25 preguntas en escala de
   "Nunca" a "Siempre".
5. Revisa el aviso de privacidad, marca la casilla de consentimiento y presiona
   **Enviar respuestas**.
6. Recibe un **folio de confirmación** (ej. `C67-365A0277`). Sus respuestas ya no se
   pueden modificar después de enviarlas.
7. Si intenta entrar de nuevo con la misma matrícula, el sistema le muestra su mismo
   folio en vez de dejarlo responder otra vez (sin doble envío).
8. Mientras responde, sus avances se guardan automáticamente cada pocos segundos — si
   cierra el navegador a la mitad, al volver a entrar con su matrícula retoma donde se
   quedó.

## 13. Importar alumnos *(solo Dirección)*

Sube un archivo `.xlsx`, `.xls` o `.csv` con las columnas: `matricula, nombres,
apellido_paterno, apellido_materno, genero, edad, plan_estudios, semestre, grupo,
turno`. Descarga la plantilla CSV desde el botón en esa misma pantalla para no
equivocarte con los encabezados. El sistema muestra una vista previa antes de
confirmar la importación, y valida errores (matrículas duplicadas, campos faltantes)
antes de guardar.

## 14. Bitácora *(Dirección y Auditoría)*

Registro de solo lectura de todo lo sensible: quién entró, qué consultó, qué cambió
(con valores anteriores y nuevos), y los accesos denegados. Se puede **buscar por
acción o recurso**. Es inalterable — nadie puede editarla ni borrarla desde la app.

Cada fila muestra fecha y hora, rol, acción, recurso, resultado y motivo (cuando lo
hubo). Cuando una fila tiene botón **Ver cambio**, ábrelo para ver el detalle completo:
los datos **antes** y **después** de esa acción — útil para revisar exactamente qué
se corrigió en un alumno o un grupo, y cuándo.

---

## 15. Gestión de cuentas de personal *(fuera de la app, por línea de comandos)*

La plataforma no tiene pantalla para crear o editar cuentas de Dirección, Docentes,
Orientación o Auditoría — se hace desde la terminal, en la carpeta `cetis67/server`:

```bash
npm run create-user -- <usuario> "<Nombre completo>" <admin|teacher|counselor|auditor> <contraseña>
```

- Si el usuario **no existe**, se crea.
- Si el usuario **ya existe**, se actualiza (sirve también para restablecer una
  contraseña olvidada — no hay recuperación por correo).
- La contraseña debe tener al menos 8 caracteres.

Ejemplo, para dar de alta a un docente:
```bash
npm run create-user -- profe.garcia "Juan García" teacher "Contraseña-Segura123"
```

---

## 16. Preguntas frecuentes

**El QR no abre / da error de conexión en el celular del alumno.**
El servidor corre de forma permanente (con `pm2`) — ya no hace falta dejar ninguna ventana
abierta ni volver a ejecutar nada manualmente. Primero verifica que el celular del alumno
esté conectado a la **misma red WiFi** que la PC del servidor: fuera de esa red (datos
móviles, otro WiFi) el QR no funciona, porque el servidor vive en esa PC, no en internet.
Si eso ya está bien y aun así falla, es probable que el router haya reasignado la IP de la
PC — hay que actualizar `PUBLIC_URL` en `server/.env`, reiniciar el servidor (doble clic en
`iniciar-servidor.bat`) y volver a generar el QR (ver sección 12, paso 4, botón
**Regenerar**).

**Un alumno dice que ya respondió pero quiere corregir algo.**
No es posible: las respuestas son inalterables una vez enviadas (por diseño, para
proteger la integridad de los datos). Si hubo un error real de identificación (ej.
matrícula equivocada), contacta al administrador técnico para revisar el caso puntual
directamente en la base de datos.

**Necesito recalcular resultados pero dice "participación insuficiente".**
El cálculo se bloquea automáticamente si menos del 60% del grupo ha respondido, para
evitar conclusiones poco representativas. Desde **Alumnos → Recalcular** se puede
forzar el cálculo de todas formas, pero queda registrado en la Bitácora con el motivo.

**¿Cómo cierro sesión?**
Botón **Cerrar sesión** arriba a la derecha, junto a tu nombre y rol.

**¿Puedo usarlo desde mi celular como Dirección/Docente/Orientación?**
Sí, la interfaz es responsive — funciona igual en celular que en computadora, siempre
que estés en la misma red o tengas acceso a la URL del servidor.
