// js/juego.js — lógica y dibujo de Neon Snake. Lo implementa PIXEL.
// Esto es solo el esqueleto con el contrato aprobado por ATLAS (#256 + #260 + #269):
//
// crearJuego(canvas, { alComer(puntos), alMorir(puntos), alGanar(puntos), tamano = 20, rng = Math.random })
//   → { iniciar(), pausar(), reanudar(), girar(dir), paso(), destruir(), estado() }
//
// - girar(dir): 'arriba' | 'abajo' | 'izquierda' | 'derecha'. Ignora el giro de 180°.
// - paso(): avanza exactamente un tic, sin reloj (para pruebas).
// - estado(): copia de solo lectura { serpiente, comida, direccion, puntos, vivo, victoria }.
// - Reiniciar = destruir() + crearJuego() nuevo.
// - No toca el DOM fuera del canvas ni localStorage.

export function crearJuego(canvas, { alComer = () => {}, alMorir = () => {}, alGanar = () => {}, tamano = 20, rng = Math.random } = {}) {
  void canvas; void alComer; void alMorir; void alGanar; void rng;
  const centro = Math.floor(tamano / 2);
  const serpiente = [{ x: centro, y: centro }, { x: centro - 1, y: centro }, { x: centro - 2, y: centro }];
  return {
    iniciar() {},
    pausar() {},
    reanudar() {},
    girar() {},
    paso() {},
    destruir() {},
    estado() {
      return Object.freeze({ serpiente: serpiente.map(s => ({ ...s })), comida: null, direccion: "derecha", puntos: 0, vivo: true, victoria: false });
    },
  };
}
