# Rudimentos — práctica de batería

App web para practicar los 40 rudimentos PAS y cambios de figura (blancas, negras, corcheas, tresillos, semicorcheas, sextillos) con feedback en vivo desde una batería electrónica por MIDI (probada para Roland TD-07).

## Uso

```bash
npm install
npm run dev      # abre http://localhost:5173 en Google Chrome
npm test         # tests del parser, la línea de tiempo y el motor de evaluación
```

Sin batería conectada puedes tocar con el teclado: `F` = mano derecha, `J` = izquierda, `Shift` = acento. La barra espaciadora inicia y detiene la práctica.

## Primera vez con la TD-07

1. Conéctala por Bluetooth MIDI (`bluetoothctl`) o por USB; ver la guía en **Configuración**.
2. En **Configuración → Monitor de golpes**, comprueba que llegan los golpes.
3. **Calibrar latencia**: toca 16 golpes con el click.
4. Para verificar el sticking, asigna un pad a cada mano (p. ej. caja = R, tom 1 = L) y activa "Dos pads" al practicar.

## Estructura

- `src/rudiments/` — DSL de patrones (`dsl.ts`) y los 40 rudimentos (`data.ts`)
- `src/exercises/rhythmChange.ts` — secuencias de cambios de figura
- `src/engine/` — línea de tiempo esperada y evaluación (timing, acentos, flams/drags, sticking)
- `src/audio/` — metrónomo con scheduler de lookahead sobre Web Audio
- `src/midi/`, `src/input/` — entrada Web MIDI y teclado
- `src/notation/Staff.tsx` — partitura con VexFlow
