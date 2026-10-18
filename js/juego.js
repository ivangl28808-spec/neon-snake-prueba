// Neon Snake — lógica y dibujo del juego (PIXEL).
// Contrato fijado en la sala (#256, #260, #269):
//   crearJuego(canvas, { alComer, alMorir, alGanar, tamano = 20, rng = Math.random })
//   → { iniciar, pausar, reanudar, girar, paso, destruir, estado }
// No toca el DOM fuera del canvas ni usa localStorage. Reiniciar = destruir() + crearJuego().

const DIRECCIONES = {
  arriba: { x: 0, y: -1 },
  abajo: { x: 0, y: 1 },
  izquierda: { x: -1, y: 0 },
  derecha: { x: 1, y: 0 },
};
const OPUESTA = { arriba: 'abajo', abajo: 'arriba', izquierda: 'derecha', derecha: 'izquierda' };

const TIC_MS = 125;          // 8 celdas por segundo, constante (RF-4)
const MAX_GIROS = 2;         // cola de giros por tic (CA-5)
const MAX_DELTA_MS = 250;    // tope por fotograma: al volver de una pausa no se recupera el tiempo de golpe
const MARGEN = 12;           // px CSS reservados alrededor del tablero para el brillo del borde
const MS_REPOSO = 66;        // fuera de partida se redibuja a ~15 fps: basta para el latido y ahorra batería

// Paleta de la guía de NEXUS (#263, #265)
const COLOR = {
  fondo: '#0E0B1F',
  linea: '#2E2765',
  serpiente: '#FF3D9A',
  comida: '#35E3F0',
  borde: '#35E3F0',
  choque: '#FF4D6D',
};

export function crearJuego(canvas, { alComer, alMorir, alGanar, tamano = 20, rng = Math.random } = {}) {
  if (!Number.isInteger(tamano) || tamano < 3) throw new RangeError('tamano debe ser un entero ≥ 3');

  const ctx = canvas.getContext('2d');
  const n = tamano;

  // Estado lógico
  const xCabeza = Math.max(2, Math.floor(n / 2));
  const yCabeza = Math.floor(n / 2);
  let serpiente = [
    { x: xCabeza, y: yCabeza },
    { x: xCabeza - 1, y: yCabeza },
    { x: xCabeza - 2, y: yCabeza },
  ];
  let direccion = 'derecha';
  let cola = [];
  let puntos = 0;
  let vivo = true;
  let victoria = false;
  let comida = colocarComida();

  // Estado del bucle y del dibujo
  let empezado = false;
  let corriendo = false;
  let destruido = false;
  let acumulado = 0;
  let ultimoT = null;
  let instanteMuerte = null;
  let idFotograma = null;
  let ultimoDibujo = -Infinity;
  let anchoCss = 0;
  let altoCss = 0;
  let ppp = 1;

  const pedirFotograma = globalThis.requestAnimationFrame?.bind(globalThis);
  const cancelarFotograma = globalThis.cancelAnimationFrame?.bind(globalThis);
  const movimientoReducido = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const observador = globalThis.ResizeObserver ? new ResizeObserver(ajustarTamano) : null;
  observador?.observe(canvas);
  ajustarTamano();
  if (pedirFotograma) idFotograma = pedirFotograma(fotograma);

  function colocarComida() {
    const ocupadas = new Set(serpiente.map((s) => s.y * n + s.x));
    const libres = [];
    for (let i = 0; i < n * n; i++) if (!ocupadas.has(i)) libres.push(i);
    if (libres.length === 0) return null;
    const indice = libres[Math.min(libres.length - 1, Math.floor(rng() * libres.length))];
    return { x: indice % n, y: Math.floor(indice / n) };
  }

  function girar(dir) {
    if (!vivo || !DIRECCIONES[dir] || cola.length >= MAX_GIROS) return;
    const ultima = cola.length ? cola[cola.length - 1] : direccion;
    if (dir === ultima || dir === OPUESTA[ultima]) return;
    cola.push(dir);
  }

  function paso() {
    if (!vivo) return;
    if (cola.length) direccion = cola.shift();
    const d = DIRECCIONES[direccion];
    const cabeza = { x: serpiente[0].x + d.x, y: serpiente[0].y + d.y };

    if (cabeza.x < 0 || cabeza.y < 0 || cabeza.x >= n || cabeza.y >= n) return morir();

    const come = comida !== null && cabeza.x === comida.x && cabeza.y === comida.y;
    // Sin comer, la cola deja su celda en este mismo tic, así que no cuenta como choque (CA-12)
    const cuerpo = come ? serpiente : serpiente.slice(0, -1);
    if (cuerpo.some((s) => s.x === cabeza.x && s.y === cabeza.y)) return morir();

    serpiente.unshift(cabeza);
    if (!come) {
      serpiente.pop();
      return;
    }
    puntos++;
    alComer?.(puntos);
    if (serpiente.length === n * n) {
      comida = null;
      vivo = false;
      victoria = true;
      corriendo = false;
      alGanar?.(puntos);
      return;
    }
    comida = colocarComida();
  }

  function morir() {
    vivo = false;
    corriendo = false;
    instanteMuerte = globalThis.performance?.now() ?? Date.now();
    alMorir?.(puntos);
  }

  function iniciar() {
    if (empezado || destruido) return;
    empezado = true;
    corriendo = vivo;
    ultimoT = null;
  }

  function pausar() {
    corriendo = false;
  }

  function reanudar() {
    if (!empezado || !vivo || destruido) return;
    corriendo = true;
    ultimoT = null;
  }

  function destruir() {
    destruido = true;
    corriendo = false;
    if (idFotograma !== null) cancelarFotograma?.(idFotograma);
    observador?.disconnect();
  }

  function estado() {
    return Object.freeze({
      serpiente: Object.freeze(serpiente.map((s) => Object.freeze({ x: s.x, y: s.y }))),
      comida: comida ? Object.freeze({ x: comida.x, y: comida.y }) : null,
      direccion,
      puntos,
      vivo,
      victoria,
    });
  }

  // ---- Bucle: requestAnimationFrame con acumulador y tic fijo (CA-18) ----

  function fotograma(t) {
    if (destruido) return;
    if (corriendo) {
      if (ultimoT !== null) acumulado += Math.min(t - ultimoT, MAX_DELTA_MS);
      ultimoT = t;
      while (acumulado >= TIC_MS && corriendo) {
        acumulado -= TIC_MS;
        paso();
      }
    } else {
      ultimoT = null;
    }
    // Si cambia la densidad sin cambiar el tamaño (otro monitor), el ResizeObserver no avisa
    if ((globalThis.devicePixelRatio || 1) !== ppp) ajustarTamano();
    const parpadeando = instanteMuerte !== null && (globalThis.performance?.now() ?? Date.now()) - instanteMuerte < 450;
    if (corriendo || parpadeando || t - ultimoDibujo >= MS_REPOSO) {
      dibujar(t);
      ultimoDibujo = t;
    }
    idFotograma = pedirFotograma(fotograma);
  }

  // ---- Dibujo ----

  function ajustarTamano() {
    anchoCss = canvas.clientWidth || canvas.width;
    altoCss = canvas.clientHeight || canvas.height;
    ppp = globalThis.devicePixelRatio || 1;
    const ancho = Math.round(anchoCss * ppp);
    const alto = Math.round(altoCss * ppp);
    if (canvas.width !== ancho) canvas.width = ancho;
    if (canvas.height !== alto) canvas.height = alto;
    if (!pedirFotograma) dibujar(0);
  }

  function dibujar(t) {
    if (!ctx || anchoCss === 0 || altoCss === 0) return;
    const reducido = movimientoReducido?.matches === true;
    const lado = Math.min(anchoCss, altoCss) - 2 * MARGEN;
    const celda = lado / n;
    const ox = (anchoCss - lado) / 2;
    const oy = (altoCss - lado) / 2;

    ctx.setTransform(ppp, 0, 0, ppp, 0, 0);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLOR.fondo;
    ctx.fillRect(0, 0, anchoCss, altoCss);
    if (lado <= 0) return;

    // Cuadrícula de 1 px al 40 %
    ctx.strokeStyle = COLOR.linea;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1 / ppp;
    ctx.beginPath();
    for (let i = 1; i < n; i++) {
      const p = i * celda;
      ctx.moveTo(ox + p, oy);
      ctx.lineTo(ox + p, oy + lado);
      ctx.moveTo(ox, oy + p);
      ctx.lineTo(ox + lado, oy + p);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Borde: cian con brillo; al morir parpadea 2 veces en rojo (fijo con movimiento reducido)
    let colorBorde = COLOR.borde;
    if (instanteMuerte !== null) {
      const transcurrido = (globalThis.performance?.now() ?? Date.now()) - instanteMuerte;
      const parpadeoEnRojo = transcurrido < 150 || (transcurrido >= 300 && transcurrido < 450);
      if (reducido || parpadeoEnRojo) colorBorde = COLOR.choque;
    }
    ctx.strokeStyle = colorBorde;
    ctx.lineWidth = 2;
    ctx.shadowColor = colorBorde;
    ctx.shadowBlur = 12 * ppp;
    ctx.strokeRect(ox - 1, oy - 1, lado + 2, lado + 2);
    ctx.shadowBlur = 0;

    // Comida: círculo del 60 % de la celda que late 1,0 → 1,15 en 800 ms
    if (comida) {
      const escala = reducido ? 1 : 1 + 0.075 * (1 - Math.cos((2 * Math.PI * t) / 800));
      ctx.fillStyle = COLOR.comida;
      ctx.shadowColor = COLOR.comida;
      ctx.shadowBlur = 0.8 * celda * ppp;
      ctx.beginPath();
      ctx.arc(ox + (comida.x + 0.5) * celda, oy + (comida.y + 0.5) * celda, 0.3 * celda * escala, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Serpiente: cuerpo de la cola hacia la cabeza, opacidad del 90 % al 45 %
    const atenuar = vivo || victoria ? 1 : 0.4;
    const radio = 0.3 * celda;
    const hueco = Math.min(2, celda * 0.15);
    ctx.fillStyle = COLOR.serpiente;
    for (let i = serpiente.length - 1; i >= 1; i--) {
      const f = serpiente.length > 2 ? (i - 1) / (serpiente.length - 2) : 0;
      ctx.globalAlpha = (0.9 - 0.45 * f) * atenuar;
      rectanguloRedondeado(ox + serpiente[i].x * celda + hueco, oy + serpiente[i].y * celda + hueco, celda - 2 * hueco, radio);
    }

    // Cabeza con brillo y ojos mirando hacia donde avanza
    const cabeza = serpiente[0];
    const cx = ox + cabeza.x * celda;
    const cy = oy + cabeza.y * celda;
    ctx.globalAlpha = atenuar;
    ctx.shadowColor = COLOR.serpiente;
    ctx.shadowBlur = 0.6 * celda * ppp;
    rectanguloRedondeado(cx + hueco, cy + hueco, celda - 2 * hueco, radio);
    ctx.shadowBlur = 0;

    const d = DIRECCIONES[direccion];
    const ojo = 0.15 * celda;
    const avance = 0.22 * celda;
    const separacion = 0.2 * celda;
    const mx = cx + celda / 2 + d.x * avance;
    const my = cy + celda / 2 + d.y * avance;
    ctx.fillStyle = COLOR.fondo;
    for (const lado2 of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(mx + d.y * separacion * lado2, my + d.x * separacion * lado2, ojo / 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function rectanguloRedondeado(x, y, l, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, l, l, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + l, y, x + l, y + l, r);
      ctx.arcTo(x + l, y + l, x, y + l, r);
      ctx.arcTo(x, y + l, x, y, r);
      ctx.arcTo(x, y, x + l, y, r);
      ctx.closePath();
    }
    ctx.fill();
  }

  return { iniciar, pausar, reanudar, girar, paso, destruir, estado };
}
