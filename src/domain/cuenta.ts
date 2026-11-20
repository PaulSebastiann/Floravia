import type { Centavos } from './dinero';

export interface Cliente {
  readonly idCliente: number;
  readonly cedula: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly telefono: string;
  /** El correo vive en USUARIO (relacion 1:1); aqui solo viaja para mostrarlo. */
  readonly correo?: string;
}

export interface ZonaEntrega {
  readonly idZona: number;
  readonly sector: string;
  readonly costoEnvio: Centavos;
}

export interface Direccion {
  readonly idDireccion: number;
  readonly idZona: number;
  readonly callePrincipal: string;
  readonly calleSecundaria?: string;
  readonly referencia?: string;
  readonly ciudad: string;
  readonly esPrincipal: boolean;
  readonly sector?: string;
  readonly costoEnvio: Centavos;
}

export interface DatosBancarios {
  readonly banco?: string;
  readonly tipoCuenta?: string;
  readonly numeroCuenta?: string;
  readonly titular?: string;
  readonly identificacion?: string;
}

/** Datos bancarios completos = los 5 campos configurados. Si falta alguno no se muestra como "oficial". */
export const bancariosCompletos = (d: DatosBancarios): boolean =>
  Boolean(d.banco && d.tipoCuenta && d.numeroCuenta && d.titular && d.identificacion);

export interface TarjetaPrueba {
  readonly numero: string;
  readonly resultado: string;
}

export interface MetodosPago {
  readonly transferencia: DatosBancarios;
  readonly tarjetasDePrueba: readonly TarjetaPrueba[];
  readonly avisoTarjeta?: string;
}

export type SesionCliente = { readonly nombre: string; readonly correo: string };
