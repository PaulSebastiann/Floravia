/** Dinero siempre en centavos enteros: nunca floats. */
export type Centavos = number & { readonly __marca: 'Centavos' };

export function centavos(n: number): Centavos {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`Centavos invalidos: ${n}`);
  }
  return n as Centavos;
}

export function sumar(...valores: readonly Centavos[]): Centavos {
  return centavos(valores.reduce<number>((acc, v) => acc + v, 0));
}

const formateadorUSD = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

export function formatearUSD(valor: Centavos): string {
  return formateadorUSD.format(valor / 100);
}
