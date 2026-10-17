// js/main.js — pantallas, HUD, entrada (teclado, deslizamiento y cruceta), récord e integración con js/juego.js.
// Flujo (UX #258): inicio → cuenta 3-2-1 → juego ⇄ pausa → fin/victoria.
import { crearJuego } from "./juego.js";

const $ = id => document.getElementById(id);
const N = 20;                       // cuadrícula de NEXUS
const CLAVE_RECORD = "neon-snake-record";
const UMBRAL_DESLIZAR = 30;         // px (#258)
const BLOQUEO_FIN = 500;            // ms sin aceptar entradas al aparecer Fin (CA-29)
const PASO_CUENTA = 500;            // 3-2-1 ≈ 1,5 s

const DIRECCIONES = {
  ArrowUp: "arriba", ArrowDown: "abajo", ArrowLeft: "izquierda", ArrowRight: "derecha",
  w: "arriba", s: "abajo", a: "izquierda", d: "derecha",
};

const lienzo = $("lienzo");
const pantallas = { inicio: $("pantallaInicio"), pausa: $("pantallaPausa"), fin: $("pantallaFin") };

let estado = "inicio";              // inicio | cuenta | juego | pausa | fin
let juego = null;
let arrancado = false;              // si ya se llamó a iniciar() en esta partida
let temporizadorCuenta = null;
let temporizadorDestello = null;
let finDesde = 0;
let record = leerRecord();

// ---------- Récord (RNF-7, RNF-10, CA-17, CA-26) ----------
function leerRecord() {
  try {
    const crudo = localStorage.getItem(CLAVE_RECORD);
    if (crudo !== null && /^\d{1,9}$/.test(crudo)) return Number(crudo);
  } catch { /* localStorage bloqueado: el récord solo dura la sesión */ }
  return 0;
}
function guardarRecord(valor) {
  try { localStorage.setItem(CLAVE_RECORD, String(valor)); } catch { /* ídem */ }
}
function pintarRecord() {
  for (const id of ["recordHud", "recordInicio", "recordFin"]) $(id).textContent = String(record);
}

// ---------- Tamaño del tablero (NEXUS #280: celda = clamp(10, floor(min(ancho, alto) / 20), 30)) ----------
const conCruceta = matchMedia("(any-pointer: coarse)");
function ajustarTamano() {
  const cruceta = conCruceta.matches;
  const vista = document.documentElement;      // clientWidth/Height: innerWidth crece si el móvil aleja el zoom
  const horizontal = cruceta && vista.clientWidth > vista.clientHeight;
  let ancho = vista.clientWidth - 16;
  let alto = vista.clientHeight - 8 - 16 - 48 - 12;   // márgenes, HUD y separación
  if (horizontal) ancho -= 3 * 64 + 2 * 8 + 24;
  else if (cruceta) alto -= 2 * 64 + 8 + 12;
  const celda = Math.min(30, Math.max(10, Math.floor(Math.min(ancho, alto) / N)));
  document.documentElement.style.setProperty("--lado", `${celda * N}px`);
  $("app").classList.toggle("horizontal", horizontal);
}

// ---------- Pantallas ----------
function mostrar(nombre) {
  for (const [clave, el] of Object.entries(pantallas)) el.hidden = clave !== nombre;
}
function anunciar(texto) {
  $("anuncio").textContent = "";
  requestAnimationFrame(() => { $("anuncio").textContent = texto; });
}
function nuevoJuego() {
  if (juego) juego.destruir();
  arrancado = false;
  $("puntos").textContent = "0";
  juego = crearJuego(lienzo, { alComer, alMorir: puntos => terminar(puntos, false), alGanar: puntos => terminar(puntos, true), tamano: N });
}

function irAInicio() {
  pararCuenta();
  nuevoJuego();                     // serpiente quieta de fondo (CA-1)
  estado = "inicio";
  $("btnPausa").disabled = true;
  mostrar("inicio");
  $("btnJugar").focus();
  anunciar("Neon Snake. Pulsa Jugar para empezar.");
}

function jugar() {
  nuevoJuego();
  empezarCuenta();
  anunciar("Partida iniciada.");
}

function empezarCuenta() {
  pararCuenta();
  estado = "cuenta";
  mostrar(null);
  $("btnPausa").disabled = false;
  let n = 3;
  const numero = $("numeroCuenta");
  const pintarNumero = () => {
    numero.textContent = String(n);
    numero.classList.remove("numero-cuenta"); void numero.offsetWidth; numero.classList.add("numero-cuenta"); // reinicia el fundido
  };
  $("cuenta").hidden = false;
  pintarNumero();
  temporizadorCuenta = setInterval(() => {
    n -= 1;
    if (n > 0) { pintarNumero(); return; }
    pararCuenta();
    estado = "juego";
    if (arrancado) juego.reanudar(); else { juego.iniciar(); arrancado = true; }
  }, PASO_CUENTA);
}
function pararCuenta() {
  clearInterval(temporizadorCuenta);
  temporizadorCuenta = null;
  $("cuenta").hidden = true;
}

function pausar() {
  if (estado !== "juego" && estado !== "cuenta") return;
  if (estado === "juego") juego.pausar();
  pararCuenta();
  estado = "pausa";
  mostrar("pausa");
  $("btnContinuar").focus();
  anunciar("Pausa.");
}
function continuar() {
  if (estado !== "pausa") return;
  empezarCuenta();
  anunciar("Continúa la partida.");
}

function alComer(puntos) {
  const marcador = $("puntos");
  marcador.textContent = String(puntos);
  marcador.classList.add("destello");
  clearTimeout(temporizadorDestello);
  temporizadorDestello = setTimeout(() => marcador.classList.remove("destello"), 200);
}

function terminar(puntos, victoria) {
  if (estado === "fin") return;
  pararCuenta();
  estado = "fin";
  finDesde = performance.now();
  $("btnPausa").disabled = true;
  const nuevo = puntos > record;
  if (nuevo) { record = puntos; guardarRecord(record); }
  pintarRecord();
  $("puntos").textContent = String(puntos);
  $("tituloFin").textContent = victoria ? "¡Tablero completo!" : "Fin de partida";
  $("tituloFin").classList.toggle("victoria", victoria);
  $("puntuacionFinal").textContent = String(puntos);
  $("nuevoRecord").hidden = !nuevo;
  mostrar("fin");
  // CA-29: sin entradas durante 500 ms
  for (const id of ["btnOtraVez", "btnInicio"]) $(id).disabled = true;
  setTimeout(() => {
    if (estado !== "fin") return;
    for (const id of ["btnOtraVez", "btnInicio"]) $(id).disabled = false;
    $("btnOtraVez").focus();
  }, BLOQUEO_FIN);
  anunciar(`${victoria ? "¡Tablero completo!" : "Fin de partida."} ${puntos} ${puntos === 1 ? "punto" : "puntos"}.${nuevo ? " ¡Nuevo récord!" : ""}`);
}
const finBloqueado = () => estado === "fin" && performance.now() - finDesde < BLOQUEO_FIN;

// ---------- Teclado (RF-10, RF-10 bis, CA-20) ----------
addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const sobreBoton = e.target instanceof HTMLButtonElement;

  if (estado === "juego" || estado === "cuenta") {
    const dir = DIRECCIONES[tecla];
    if (dir) { e.preventDefault(); if (estado === "juego") juego.girar(dir); return; }
    if (tecla === " " || tecla === "p" || tecla === "Escape") { e.preventDefault(); pausar(); }
    return;
  }
  if (estado === "pausa") {
    if (tecla === "p" || tecla === "Escape" || (tecla === " " && !sobreBoton)) { e.preventDefault(); continuar(); }
    return;
  }
  if (finBloqueado()) { e.preventDefault(); return; }
  // Inicio y Fin: Enter/Espacio empiezan; sobre un botón actúa el propio botón
  if ((tecla === "Enter" || tecla === " ") && !sobreBoton) { e.preventDefault(); jugar(); }
});

// ---------- Deslizamiento sobre el tablero (RF-11, CA-6, CA-7) ----------
let origen = null;
lienzo.addEventListener("pointerdown", e => {
  if (estado !== "juego") return;
  origen = { x: e.clientX, y: e.clientY, id: e.pointerId };
  try { lienzo.setPointerCapture(e.pointerId); } catch { /* el puntero ya no está activo: se sigue sin captura */ }
});
lienzo.addEventListener("pointermove", e => {
  if (!origen || e.pointerId !== origen.id || estado !== "juego") return;
  const dx = e.clientX - origen.x, dy = e.clientY - origen.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < UMBRAL_DESLIZAR) return;
  juego.girar(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "derecha" : "izquierda") : (dy > 0 ? "abajo" : "arriba"));
  origen = { x: e.clientX, y: e.clientY, id: e.pointerId };   // permite encadenar giros sin levantar el dedo
});
for (const ev of ["pointerup", "pointercancel"]) lienzo.addEventListener(ev, () => { origen = null; });

// ---------- Cruceta (responde a pointerdown, RF-11 bis) ----------
for (const boton of document.querySelectorAll(".dir")) {
  boton.addEventListener("pointerdown", e => {
    e.preventDefault();
    if (estado === "juego") juego.girar(boton.dataset.dir);
  });
  // teclado y lectores de pantalla activan el botón con click (pointerdown no salta)
  boton.addEventListener("click", e => {
    if (e.detail === 0 && estado === "juego") juego.girar(boton.dataset.dir);
  });
}

// ---------- Botones ----------
$("btnJugar").addEventListener("click", jugar);
$("btnPausa").addEventListener("click", pausar);
$("btnContinuar").addEventListener("click", continuar);
$("btnReiniciar").addEventListener("click", jugar);
$("btnSalir").addEventListener("click", irAInicio);
$("btnOtraVez").addEventListener("click", () => { if (!finBloqueado()) jugar(); });
$("btnInicio").addEventListener("click", () => { if (!finBloqueado()) irAInicio(); });

// ---------- Pausa automática (RF-12, RF-12 bis, CA-14) ----------
document.addEventListener("visibilitychange", () => { if (document.hidden) pausar(); });
addEventListener("blur", pausar);
screen.orientation?.addEventListener?.("change", pausar);

// ---------- Arranque ----------
addEventListener("resize", ajustarTamano);
conCruceta.addEventListener?.("change", ajustarTamano);
if (conCruceta.matches) $("ayuda").textContent = "Desliza sobre el tablero o usa la cruceta";
ajustarTamano();
pintarRecord();
irAInicio();
