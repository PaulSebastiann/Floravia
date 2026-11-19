/**
 * Validacion LOCAL de la tarjeta SIMULADA (feedback inmediato). Nada de esto se guarda ni se registra:
 * el numero y el CVV viven solo en el formulario y viajan una vez a la API por HTTPS en la accion.
 */
export const soloDigitos = (v: string): string => v.replace(/\D/g, '');

export function pasaLuhn(numero: string): boolean {
  const n = soloDigitos(numero);
  if (n.length < 13 || n.length > 19) return false;
  let suma = 0;
  let doble = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = Number(n[i]);
    if (doble) { d *= 2; if (d > 9) d -= 9; }
    suma += d;
    doble = !doble;
  }
  return suma % 10 === 0;
}

export type MarcaTarjeta = 'Visa' | 'Mastercard' | 'Amex' | 'Tarjeta';

export function detectarMarca(numero: string): MarcaTarjeta {
  const n = soloDigitos(numero);
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  return 'Tarjeta';
}

/** "4242424242424242" -> "4242 4242 4242 4242" (Amex 4-6-5). */
export function formatearNumero(numero: string): string {
  const n = soloDigitos(numero).slice(0, 19);
  if (detectarMarca(n) === 'Amex') {
    return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(' ');
  }
  return n.replace(/(.{4})/g, '$1 ').trim();
}

export interface DatosTarjetaForm {
  readonly numero: string;
  readonly titular: string;
  readonly mes: string;
  readonly anio: string;
  readonly cvv: string;
}
export type ErroresTarjeta = Partial<Record<keyof DatosTarjetaForm, string>>;

export function validarTarjeta(d: DatosTarjetaForm, ahora = new Date()): ErroresTarjeta {
  const e: ErroresTarjeta = {};
  if (!pasaLuhn(d.numero)) e.numero = 'El número de tarjeta no es válido.';
  if (d.titular.trim().length < 3) e.titular = 'Ingresa el nombre como aparece en la tarjeta.';
  const mes = Number(d.mes);
  let anio = Number(d.anio);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) e.mes = 'Mes inválido.';
  if (!Number.isInteger(anio)) e.anio = 'Año inválido.';
  else {
    if (anio < 100) anio += 2000;
    if (!e.mes && (anio < ahora.getFullYear() || (anio === ahora.getFullYear() && mes < ahora.getMonth() + 1))) {
      e.anio = 'La tarjeta está vencida.';
    }
  }
  const largo = detectarMarca(d.numero) === 'Amex' ? 4 : 3;
  const cvv = soloDigitos(d.cvv);
  if (cvv.length !== largo || cvv !== d.cvv.trim()) e.cvv = `El CVV debe tener ${largo} dígitos.`;
  return e;
}

/**
 * Validacion PERMISIVA para la demostracion (sin API): acepta cualquier numero, fecha, nombre y CVV.
 * Solo exige que haya algo en el numero, porque de ahi salen la marca y los ultimos 4 del comprobante.
 */
export function validarTarjetaDemo(d: DatosTarjetaForm): ErroresTarjeta {
  return soloDigitos(d.numero).length === 0 ? { numero: 'Escribe un número de tarjeta (cualquiera sirve: es una simulación).' } : {};
}

/** Normaliza lo que el usuario escribio a los tipos que espera el pago; lo que falte o no sea numerico toma un valor de prueba. */
export function normalizarTarjetaDemo(d: DatosTarjetaForm): {
  numero: string; titular: string; mesVencimiento: number; anioVencimiento: number; cvv: string;
} {
  const mes = Number(d.mes);
  const anio = Number(d.anio);
  return {
    numero: soloDigitos(d.numero),
    titular: d.titular.trim().toUpperCase() || 'TITULAR DE PRUEBA',
    mesVencimiento: Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : 12,
    anioVencimiento: Number.isInteger(anio) && anio > 0 ? (anio < 100 ? 2000 + anio : anio) : 2099,
    cvv: soloDigitos(d.cvv) || '000',
  };
}
