# Visión — Batería

Fuente de verdad sobre **qué** construimos y **por qué**. El código dice cómo; este documento decide prioridades.
Última revisión: 2026-11-05.

## Qué es

Un estudio de práctica de batería en el navegador. Escucha una batería electrónica por Web MIDI (probada con la Roland TD-07) y te dice, golpe a golpe, si vas a tiempo.

1. **Primero, herramienta de práctica.** La uso yo para tocar de verdad. Si práctica y experimento chocan, gana la práctica.
2. **Segundo, proyecto de aprendizaje.** Es el sitio donde aprendo a trabajar con IA como en un equipo profesional: plan, rama, tests, revisión, PR.
3. **Público, con el tiempo.** Hoy la usa una persona; más adelante la usará cualquiera con una batería electrónica.

## Qué viene (en orden)

1. **Más contenido.** Ritmos (grooves) y fills que usen todo el kit (hi-hat, caja, bombo, toms, platos), no solo las manos. El DSL actual solo describe R/L, así que hay que ampliarlo para indicar la pieza del kit.
2. **El nuevo recorrido de la interfaz** (ver abajo), con carriles en vez de partitura.
3. **Rutinas de práctica.** Secuencias de ejercicios con tempos y duraciones.

## Experiencia

### Recorrido

Título → **Inicio modular** → **Sección** → **Mira el ritmo** → **Ensayo** o **Concierto** → **Así fue**.

- **Inicio:** una composición de módulos con una figura cada uno: Ritmos (el grande), Rudimentos, Cambios e Historial. Cada sección tiene siempre la misma forma, posición y color, para que se recuerde sin leer. Ajustes va aparte, como un icono discreto.
- **Sección:** las opciones se despliegan dentro, con una vista previa del patrón.
- **Mira el ritmo:** antes de tocar, lo ves y lo escuchas. Después eliges.
- **Ensayo:** sin presión, en bucle, con el tempo ajustable y el siguiente golpe marcado. No cuenta.
- **Concierto:** cuenta atrás, cuatro compases y se acabó. Cuenta.
- **Así fue:** el porcentaje a tiempo, el detalle por pieza (estable, se adelanta, se atrasa) y un consejo concreto.

### Notación: carriles

Un carril vertical por pieza del kit, con las notas cayendo hacia una línea de golpe. Así se ve **qué** pieza toca y **cuándo**. La partitura clásica deja de ser lo principal. Como apoyo, una **órbita** muestra el compás en círculo, con un anillo por pieza.

### Lenguaje visual: «estudio de noche»

Calmado, adulto y agradable de mirar mientras suena música. Tiene la facilidad de un menú de videojuego, como los de consola, pero no su aspecto infantil.

- Fondo casi negro `#0c0e13` y texto blanco cálido `#f2f0eb`. Para el texto secundario, `#9aa0ab` y `#c9ccd2`.
- Tipografía Manrope (200–600). IBM Plex Mono para las vistas previas de patrones.
- Un color por sección, profundo y apagado:

  | Sección | Fondo | Acento |
  |---|---|---|
  | Ritmos | `#17213a` | `#8db6ee` |
  | Rudimentos | `#261a2d` | `#d9a3e6` |
  | Cambios | `#142a29` | `#6fd6c8` |
  | Historial | `#221f1a` | `#e6c58a` |

- Colores del kit, que solo aparecen en carriles y resultados: hi-hat `#d9b26f`, caja `#e9e6df`, bombo `#7fa7d9`.
- **Ambiente:** un fondo de luz líquida que se desplaza muy despacio, con un tono por pantalla. **No reacciona al ritmo.**
- **Los golpes no destellan.** La valoración se da con palabras y posición, no con fogonazos.
- Botón principal: una píldora blanca. Foco: un anillo blanco fino y una escala ligera.
- Maqueta de referencia: canvas «Bateria Game UI» (https://claude.ai/artifact/5cENxe8jJGeeZrjuXAvNZD).

### Principios

- **Poca carga cognitiva.** Una decisión por pantalla, la categoría fija en el espacio y nada que sobre. Pensado también para personas neurodivergentes.
- **Manos libres.** Se navega desde los pads: Tom 1 y Tom 2 mueven, la caja elige y el crash vuelve. El teclado y el ratón también funcionan.
- **Accesibilidad.** Nunca se usa solo el color: siempre se acompaña de forma o palabra (◂ antes, tarde ▸). Se respeta `prefers-reduced-motion`, el contraste es suficiente y todo se puede usar con el teclado.
- **Dispositivos mixtos.** Funciona en portátil, en tablet junto a la batería y en pantalla grande.
- **Bilingüe.** Español e inglés con i18n. El español es el idioma por defecto.

## Lo que no es (no-objetivos)

- **Sin backend ni cuentas.** Todo es local (localStorage).
- **Sin gamificación.** Nada de puntos, combos, rachas, desbloqueos, medallas ni recompensas. Las etapas (ensayo → concierto) y la valoración de cada golpe existen porque informan la práctica, no para enganchar.
- **Sin dependencias pesadas.** Antes de añadir una, hay que justificarla.
- **Sin reproducción de audio ni funciones de DAW.** Solo click y metrónomo; no hay samples, grabación ni mezcla.

## Calidad

- **Tests para todo:** cada lógica nueva lleva su test. `npm test` y `npm run build` siempre en verde.
- La precisión de tiempo es lo central: un error de milisegundos en el motor se nota más que cualquier fallo visual.

## Preguntas abiertas

- ¿Qué variantes de la maqueta se quedan? Ensayo/Concierto o sus versiones ′, y el estilo de los carriles (classic, cine, arcade o lud).
- ¿VexFlow se queda como vista opcional de partitura o se retira? Es casi todo el peso del bundle.
- El formato del DSL para las piezas del kit.
- Cómo convivir con la navegación por pads mientras se toca: ¿solo fuera de la práctica?
