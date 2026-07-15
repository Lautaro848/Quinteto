/* ========== geometría de la cancha (FIBA, metros) ==========
   Cancha completa 28 x 15. Origen (0,0) arriba a la izquierda.
   Aros a 1.575 m de cada línea de fondo, centrados (y = 7.5).
   Triple: radio 6.75 m; rectas de esquina a 0.9 m de cada lateral,
   que se unen con el arco a 2.99 m de la línea de fondo.            */
"use strict";

const COURT = {
  W: 28, H: 15,
  HOOP_FROM_BASE: 1.575,
  R3: 6.75,
  CORNER_MARGIN: 0.9,     // distancia recta de esquina al lateral
  CORNER_X: 2.99,         // fin de la recta de esquina (desde el fondo)
  PAINT_LEN: 5.8, PAINT_W: 4.9,
  FT_R: 1.8, CENTER_R: 1.8,
  BOARD_FROM_BASE: 1.2,
  RIM_R: 0.3
};

/* posición del aro para un lado: 'left' | 'right' */
function hoopPos(side) {
  return {
    x: side === "left" ? COURT.HOOP_FROM_BASE : COURT.W - COURT.HOOP_FROM_BASE,
    y: COURT.H / 2
  };
}

/* ¿Hacia qué lado ataca el equipo en un cuarto dado?
   attackRightQ1: true si el equipo A ataca el aro derecho en Q1/Q2.
   Al descanso largo (Q3+) se invierte; las prórrogas mantienen la
   dirección de la segunda mitad. */
function attackSide(match, team, quarter) {
  const firstHalf = quarter <= 2;
  const aRight = firstHalf ? match.attackRight : !match.attackRight;
  const teamRight = team === "A" ? aRight : !aRight;
  return teamRight ? "right" : "left";
}

/* distancia de un punto al aro atacado */
function distToHoop(x, y, side) {
  const h = hoopPos(side);
  return Math.hypot(x - h.x, y - h.y);
}

/* ¿el punto (x,y) es triple respecto del aro 'side'?
   En la zona de esquina manda la recta (0.9 m del lateral);
   más allá, el arco de 6.75 m. */
function isThree(x, y, side) {
  const fromBase = side === "left" ? x : COURT.W - x;
  if (fromBase < 0) return false;
  if (fromBase <= COURT.CORNER_X) {
    return Math.abs(y - COURT.H / 2) >= (COURT.H / 2 - COURT.CORNER_MARGIN);
  }
  return distToHoop(x, y, side) >= COURT.R3;
}

/* zona del tiro para el mapa de calor */
function shotZone(x, y, side) {
  const fromBase = side === "left" ? x : COURT.W - x;
  if (isThree(x, y, side)) {
    return fromBase <= COURT.CORNER_X ? "esquina" : "frontal3";
  }
  const inPaint = fromBase <= COURT.PAINT_LEN && Math.abs(y - COURT.H / 2) <= COURT.PAINT_W / 2;
  return inPaint ? "pintura" : "media";
}

const ZONE_NAMES = {
  pintura: "Pintura",
  media: "Media distancia",
  esquina: "Triples de esquina",
  frontal3: "Triple frontal/alas"
};
