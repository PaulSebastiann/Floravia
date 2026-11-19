import { describe, expect, it } from 'vitest';
import {
  cedulaEcuatorianaValida, validarCedula, validarCorreo, validarPassword, validarTelefono, validarTexto,
} from './validaciones-cuenta';

describe('validaciones de cuenta (espejo del backend)', () => {
  it('correo', () => {
    expect(validarCorreo('ana@correo.com')).toBeUndefined();
    expect(validarCorreo('  ANA@Correo.com ')).toBeUndefined();
    expect(validarCorreo('')).toMatch(/correo/i);
    expect(validarCorreo('sin-arroba')).toMatch(/válido/);
    expect(validarCorreo('a@b')).toMatch(/válido/);
    expect(validarCorreo('a@b.c d')).toMatch(/válido/);
  });
  it('password: 8+ con letra y numero', () => {
    expect(validarPassword('Clave1234')).toBeUndefined();
    expect(validarPassword('corta1')).toBeDefined();
    expect(validarPassword('solo letras largas')).toBeDefined();
    expect(validarPassword('1234567890')).toBeDefined();
  });
  it('cedula: solo exige 10 digitos como el backend', () => {
    expect(validarCedula('1712345678')).toBeUndefined(); // dato de Api.http (no pasa modulo 10)
    expect(validarCedula('12345')).toBeDefined();
    expect(validarCedula('17123456ab')).toBeDefined();
  });
  it('cedulaEcuatorianaValida implementa modulo 10', () => {
    expect(cedulaEcuatorianaValida('1710034065')).toBe(true);
    expect(cedulaEcuatorianaValida('1712345678')).toBe(false);
    expect(cedulaEcuatorianaValida('9912345678')).toBe(false);
  });
  it('telefono y texto', () => {
    expect(validarTelefono('0999999999')).toBeUndefined();
    expect(validarTelefono('+593 99 999 9999')).toBeUndefined();
    expect(validarTelefono('abc')).toBeDefined();
    expect(validarTexto('  ', 'Tu nombre', 10)).toBe('Tu nombre es obligatorio.');
    expect(validarTexto('x'.repeat(11), 'Tu nombre', 10)).toMatch(/10/);
  });
});
