# 🏀 Quinteto — Planilla de básquet profesional

La planilla digital que reemplaza al papel: registrás el partido completo de
los dos equipos **con una mano**, en una **cancha entera que entiende las
reglas del juego** (lados, aros, dobles y triples), y salís con estadísticas
y reportes listos para compartir.

## Cómo usarla

Es una app web sin dependencias ni instalación:

```bash
# opción 1: abrir directo
abrí index.html en el navegador (Chrome/Safari, ideal desde el celular)

# opción 2: servir la carpeta
python3 -m http.server 8000
# → http://localhost:8000
```

Todo se guarda automáticamente en el dispositivo (localStorage), con
export/import de backup en JSON desde la pantalla de inicio.

## Funcionalidades

### 1. Configuración del partido
- Alta de los dos equipos: nombre, color identificatorio y plantel completo
  (número + nombre). Agregar, editar y borrar jugadores **en cualquier
  momento**, incluso con el partido empezado (menú `⋯ → Editar planteles`).
- **Planteles guardados**: tu equipo queda guardado para el próximo partido;
  el rival se importa de un partido anterior contra el mismo club.
- **Lado de ataque**: tocás el aro al que ataca tu equipo en el primer
  tiempo; el rival queda definido en el aro opuesto.
- Quinteto inicial de cada equipo antes del salto.

### 2. Partido en vivo
- Marcador doble real calculado desde las acciones, parciales por cuarto
  (Q1–Q4 + prórrogas + total) y detección de corridas ("Corrida 8-0 · Nosotros 🔥").
- Reloj por cuarto: cada acción queda sellada con cuarto y tiempo de juego.
- **Cambio de lado automático** al terminar el 2° cuarto, con aviso de
  entretiempo; indicadores y detección de tiros se actualizan solos.
- Indicador visual de dirección: flechas por equipo y cada aro pintado del
  color del equipo que lo ataca en ese momento.

### 3. Cancha completa y registro de tiros
- Cancha entera FIBA a escala (28×15 m): dos aros, pinturas y arcos de triple.
- **Flujo de 2 toques**: jugador → lugar del tiro → ✓ anotado / ✗ fallado.
- **Detección automática de doble o triple** midiendo la distancia al aro que
  ese equipo ataca en ese cuarto (incluye las rectas de esquina a 0,90 m).
  Corrección manual `↔` para el pie en la línea.
- Shot chart de los dos equipos: verde/rojo con borde del color de cada
  equipo, resaltado por jugador, filtros por cuarto y **mapa de calor** con
  % por zona (pintura, media distancia, esquinas, triple frontal).

### 4. Registro de acciones y correcciones
- Acciones rápidas: asistencia, robo, pérdida, tapa, rebote of/def, falta y
  tiro libre con su propio ✓/✗.
- **Cambios en dos toques**: tocás quién entra desde la banca → tocás quién
  sale. Para los dos equipos.
- **Línea de tiempo editable**: cualquier acción (no solo la última) se puede
  borrar o corregir y todas las estadísticas se recalculan al instante
  (todo el estado deriva de la lista de eventos).

### 5. Estadísticas completas
- Por jugador: PTS, 2P, 3P, TL con % e intentos, REB (of/def), AST, ROB, PÉR,
  TAP, FP, **+/- con los quintetos reales en cancha** y valoración (PIR).
- **Minutos automáticos** a partir de los cambios y el reloj.
- Por equipo: puntos, % de campo, rebotes, faltas — con pestañas para
  alternar y tabla comparativa.

### 6. Post-partido y temporada
- **Reporte en un toque**: imagen PNG (marcador, parciales, shot chart y
  destacados) lista para el grupo de WhatsApp, PDF vía imprimir y resumen de
  texto para compartir.
- Historial de temporada: récord G/P, promedios por jugador y evolución
  partido a partido (sparkline).
- Persistencia automática + export/import de backup JSON.

## Arquitectura

| Archivo | Rol |
|---|---|
| `js/geometry.js` | Geometría FIBA: aros, arco de 6,75 m, esquinas, zonas |
| `js/store.js` | Estado, persistencia (localStorage) y eventos |
| `js/stats.js` | Motor de estadísticas: todo se recalcula desde los eventos |
| `js/court.js` | Render SVG de la cancha completa |
| `js/setup.js` | Configuración: equipos, planteles, lado, quintetos |
| `js/game.js` | Partido en vivo: reloj, marcador, tiros, cambios |
| `js/analysis.js` | Boxscore, shot chart, mapa de calor, línea de tiempo |
| `js/report.js` | Reporte, imagen para compartir, PDF |
| `js/season.js` | Inicio, historial y promedios de temporada |

El diseño es *event-sourced*: cada acción del partido es un evento inmutable
con equipo, jugador, cuarto y reloj; marcador, minutos, +/- y quintetos se
derivan replicando la lista. Por eso corregir o borrar cualquier acción deja
todo consistente al instante.
