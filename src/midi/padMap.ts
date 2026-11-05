/** Default note numbers of the Roland TD-07 module. */
export const TD07_PADS: Record<number, string> = {
  36: 'Bombo',
  38: 'Caja (parche)',
  40: 'Caja (aro)',
  37: 'Caja (cross-stick)',
  48: 'Tom 1',
  50: 'Tom 1 (aro)',
  45: 'Tom 2',
  47: 'Tom 2 (aro)',
  43: 'Tom 3',
  58: 'Tom 3 (aro)',
  42: 'Hi-hat cerrado',
  22: 'Hi-hat cerrado (borde)',
  46: 'Hi-hat abierto',
  26: 'Hi-hat abierto (borde)',
  44: 'Hi-hat pedal',
  49: 'Crash',
  55: 'Crash (borde)',
  51: 'Ride',
  59: 'Ride (borde)',
  53: 'Ride (campana)',
};

/** Feet are never part of a hand exercise. */
export const FOOT_NOTES = new Set([36, 44]);

export const padName = (note: number) => TD07_PADS[note] ?? `Nota ${note}`;
