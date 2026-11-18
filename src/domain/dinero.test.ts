import { describe, expect, it } from 'vitest';
import { centavos, formatearUSD, sumar } from './dinero';

describe('dinero', () => {
  it('rechaza decimales, negativos y NaN', () => {
    expect(() => centavos(10.5)).toThrow(RangeError);
    expect(() => centavos(-1)).toThrow(RangeError);
    expect(() => centavos(Number.NaN)).toThrow(RangeError);
  });

  it('suma sin errores de punto flotante', () => {
    // 0.1 + 0.2 en float != 0.3; en centavos es exacto.
    expect(sumar(centavos(10), centavos(20))).toBe(30);
  });

  it('formatea en USD es-EC', () => {
    const txt = formatearUSD(centavos(3800));
    expect(txt).toContain('38');
    expect(txt).toMatch(/\$|USD/);
  });
});
