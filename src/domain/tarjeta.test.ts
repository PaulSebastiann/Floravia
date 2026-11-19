import { describe, expect, it } from 'vitest';
import { detectarMarca, formatearNumero, pasaLuhn, validarTarjeta } from './tarjeta';

const ok = { numero: '4242 4242 4242 4242', titular: 'ANA PRUEBA', mes: '12', anio: '2099', cvv: '123' };

describe('tarjeta simulada', () => {
  it('Luhn', () => {
    expect(pasaLuhn('4242 4242 4242 4242')).toBe(true);
    expect(pasaLuhn('4242 4242 4242 4241')).toBe(false);
    expect(pasaLuhn('123')).toBe(false);
  });
  it('marca y formato', () => {
    expect(detectarMarca('4242')).toBe('Visa');
    expect(detectarMarca('5555')).toBe('Mastercard');
    expect(detectarMarca('3782')).toBe('Amex');
    expect(formatearNumero('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatearNumero('378282246310005')).toBe('3782 822463 10005');
  });
  it('acepta datos validos', () => {
    expect(validarTarjeta(ok)).toEqual({});
  });
  it('rechaza vencida, cvv y titular', () => {
    const ahora = new Date(2026, 10, 18);
    expect(validarTarjeta({ ...ok, anio: '2026', mes: '10' }, ahora).anio).toMatch(/vencida/);
    expect(validarTarjeta({ ...ok, anio: '2026', mes: '11' }, ahora)).toEqual({});
    expect(validarTarjeta({ ...ok, cvv: '12' }).cvv).toBeDefined();
    expect(validarTarjeta({ ...ok, cvv: '12a' }).cvv).toBeDefined();
    expect(validarTarjeta({ ...ok, titular: 'A' }).titular).toBeDefined();
    expect(validarTarjeta({ ...ok, mes: '13' }).mes).toBeDefined();
  });
  it('Amex exige CVV de 4', () => {
    const amex = { ...ok, numero: '378282246310005' };
    expect(validarTarjeta({ ...amex, cvv: '123' }).cvv).toBeDefined();
    expect(validarTarjeta({ ...amex, cvv: '1234' })).toEqual({});
  });
});
