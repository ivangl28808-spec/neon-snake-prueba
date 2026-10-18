# Neon Snake

Minijuego de la serpiente para el navegador (PC y móvil), con estética neón. Es el proyecto de prueba 1 del equipo: una sola página estática, sin dependencias, sin servidor y sin datos personales.

## Cómo se juega

Come la comida cian para crecer y sumar un punto. La partida termina si chocas con el borde o con tu propio cuerpo. Si llenas el tablero de 20×20, ganas.

| Acción | Teclado | Táctil |
|---|---|---|
| Mover | Flechas o WASD | Deslizar sobre el tablero o cruceta |
| Pausar / continuar | Espacio, P o Esc | Botón de pausa |
| Empezar / jugar otra vez | Enter o Espacio | Botón «Jugar» |

- Antes de empezar y al continuar hay una cuenta 3-2-1. La última dirección pulsada durante la cuenta se aplica al arrancar.
- La partida se pausa sola si cambias de pestaña, la ventana pierde el foco o giras el móvil.
- El récord se guarda en el navegador (`localStorage`). Si está bloqueado (modo privado), el juego funciona igual y el récord solo dura la sesión.

## Ejecutarlo en local

El JavaScript son módulos ES, así que hace falta servir la carpeta por HTTP. Abrir `index.html` con doble clic (`file://`) no funciona.

```sh
python3 -m http.server 8000
# y abre http://localhost:8000
```

## Estructura

```
index.html       página, pantallas y CSP
css/estilo.css   estilos de pantallas, HUD y cruceta
js/main.js       pantallas, entrada (teclado, deslizar, cruceta), récord e integración
js/juego.js      lógica y dibujo del tablero en <canvas>
```

`js/juego.js` no toca el DOM fuera del canvas ni `localStorage`. Se comunica con `main.js` mediante este contrato:

```js
crearJuego(canvas, { alComer(puntos), alMorir(puntos), alGanar(puntos), tamano = 20, rng = Math.random })
  → { iniciar(), pausar(), reanudar(), girar(dir), paso(), destruir(), estado() }
```

- `girar(dir)` acepta `'arriba' | 'abajo' | 'izquierda' | 'derecha'` e ignora el giro de 180°.
- `paso()` avanza un tic sin reloj y `estado()` devuelve una copia de solo lectura. Con `tamano` y `rng` sirven para probar la lógica sin canvas ni tiempo real.
- Para reiniciar: `destruir()` y un `crearJuego()` nuevo.

## Seguridad y privacidad

- CSP `default-src 'self'`: no se carga nada externo, ni fuentes ni scripts. Tampoco hay JS ni CSS en línea.
- Sin cookies, sin analítica y sin peticiones de red. Lo único que se guarda es el récord.
- El récord leído se valida como entero ≥ 0 (si no, vale 0) y se muestra con `textContent`.

## Equipo

Lógica y dibujo del juego: PIXEL. Pantallas, entrada e integración: Claude (ingeniería). Dirección: ATLAS. Revisión y pruebas: AUDITOR. Seguridad: CERBERUS. Requisitos, diseño visual y experiencia de usuario: ORACLE, NEXUS y UX.
