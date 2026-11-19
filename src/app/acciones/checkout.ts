'use server';

import { redirect } from 'next/navigation';
import { validarComprobante } from '@/domain/comprobante';
import { hrefIngresar } from '@/domain/redireccion';
import { normalizarTarjetaDemo, soloDigitos, validarTarjeta, validarTarjetaDemo } from '@/domain/tarjeta';
import { hayErrores, validarTexto } from '@/domain/validaciones-cuenta';
import { ApiError, ApiNoDisponible, mensajeUsuario } from '@/infrastructure/api/errores';
import { leerJwt } from '@/infrastructure/api/sesion';
import { modoDemo, tienda } from '@/infrastructure/tienda';
import { texto, type EstadoForm } from './estado';

type Metodo = 'TRANSFERENCIA' | 'TARJETA';

/** Codigos de aviso en la URL de /pedido/[id]. Lista cerrada: la pagina ignora cualquier otro valor. */
export type AvisoPedido = 'rechazada' | 'fondos' | 'pago-error' | 'comprobante-error';

const registrar = (e: unknown, donde: string) => {
  if (!(e instanceof ApiError) && !(e instanceof ApiNoDisponible)) console.error(`[floravia] ${donde}`, e);
};

interface DatosPago {
  readonly metodo: Metodo;
  readonly tarjeta?: { numero: string; titular: string; mesVencimiento: number; anioVencimiento: number; cvv: string };
  readonly comprobante?: File;
  readonly referencia?: string;
}

/** Lee y valida el metodo de pago. Devuelve errores por campo sin tocar la API. */
function leerPago(fd: FormData, comprobanteObligatorio: boolean): { datos?: DatosPago; errores: Record<string, string> } {
  const errores: Record<string, string> = {};
  const metodo = texto(fd, 'metodo', 20);
  if (metodo !== 'TRANSFERENCIA' && metodo !== 'TARJETA') {
    return { errores: { metodo: 'Elige un método de pago.' } };
  }
  if (metodo === 'TARJETA') {
    const f = {
      numero: texto(fd, 'numero', 40), titular: texto(fd, 'titular', 80),
      mes: texto(fd, 'mes', 2), anio: texto(fd, 'anio', 4), cvv: texto(fd, 'cvv', 4),
    };
    // Demostracion: cualquier numero, fecha, nombre y CVV se acepta (solo debe haber un numero).
    if (modoDemo()) {
      const e = validarTarjetaDemo(f);
      if (hayErrores(e)) return { errores: Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as Record<string, string> };
      return { errores, datos: { metodo, tarjeta: normalizarTarjetaDemo(f) } };
    }
    const e = validarTarjeta(f);
    if (hayErrores(e)) return { errores: Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as Record<string, string> };
    let anio = Number(f.anio);
    if (anio < 100) anio += 2000;
    return {
      errores,
      datos: {
        metodo,
        tarjeta: {
          numero: soloDigitos(f.numero), titular: f.titular.trim().toUpperCase(),
          mesVencimiento: Number(f.mes), anioVencimiento: anio, cvv: f.cvv.trim(),
        },
      },
    };
  }
  const archivo = fd.get('comprobante');
  const f = archivo instanceof File && archivo.size > 0 ? archivo : undefined;
  if (f || comprobanteObligatorio) {
    const e = validarComprobante(f);
    if (e) errores['comprobante'] = e;
  }
  if (hayErrores(errores)) return { errores };
  const referencia = texto(fd, 'referencia', 100).trim();
  return { errores, datos: { metodo, comprobante: f, referencia: referencia || undefined } };
}

/** Ejecuta el pago sobre un pedido YA creado y redirige. Nunca devuelve. */
async function pagarYRedirigir(idPedido: number, p: DatosPago): Promise<never> {
  const base = `/pedido/${idPedido}`;
  if (p.metodo === 'TARJETA' && p.tarjeta) {
    let aviso: AvisoPedido | undefined;
    try {
      const r = await tienda().pagarConTarjeta(idPedido, p.tarjeta);
      if (!r.aprobado) aviso = /fondos/i.test(r.mensaje) ? 'fondos' : 'rechazada';
    } catch (e) {
      registrar(e, 'pago con tarjeta');
      aviso = 'pago-error';
    }
    redirect(aviso ? `${base}?aviso=${aviso}` : `${base}?nuevo=1`);
  }
  // API real: sin comprobante el pedido queda reservado y se sube despues. Demostracion: se registra igual (comprobante opcional).
  if (p.comprobante || modoDemo()) {
    let aviso: AvisoPedido | undefined;
    try {
      await tienda().pagarPorTransferencia(idPedido, p.comprobante, p.referencia);
    } catch (e) {
      registrar(e, 'pago por transferencia');
      aviso = 'comprobante-error';
    }
    redirect(aviso ? `${base}?aviso=${aviso}` : `${base}?nuevo=1`);
  }
  redirect(`${base}?nuevo=1`); // transferencia sin comprobante todavia: se sube en la pantalla del pedido
}

/**
 * Checkout: valida TODO localmente, luego (1) direccion, (2) pedido, (3) pago.
 * El pedido ya existe cuando se intenta el pago; si el pago falla, el usuario va al pedido a reintentar
 * (no se vuelve a construir el carrito, que la API ya convirtio).
 */
export async function finalizarCompraAccion(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  if (!(await leerJwt())) redirect(hrefIngresar('/checkout'));

  // 1. Validacion local (sin escribir nada todavia)
  const errores: Record<string, string> = {};
  const seleccion = texto(fd, 'direccion', 12);
  let idDireccion = Number(seleccion);
  const nueva = seleccion === 'nueva';
  const dir = {
    idZona: Number(texto(fd, 'idZona', 12)),
    callePrincipal: texto(fd, 'callePrincipal', 200).trim(),
    calleSecundaria: texto(fd, 'calleSecundaria', 200).trim(),
    referencia: texto(fd, 'referencia_dir', 300).trim(),
  };
  if (nueva) {
    if (!Number.isInteger(dir.idZona) || dir.idZona < 1) errores['idZona'] = 'Elige tu sector.';
    const e = validarTexto(dir.callePrincipal, 'La calle principal', 200);
    if (e) errores['callePrincipal'] = e;
  } else if (!Number.isInteger(idDireccion) || idDireccion < 1) {
    errores['direccion'] = 'Elige una dirección de entrega.';
  }
  const pago = leerPago(fd, false);
  Object.assign(errores, pago.errores);
  if (hayErrores(errores) || !pago.datos) return { errores };

  // 2. Carrito (la API es la autoridad)
  let cantidad = 0;
  try {
    cantidad = (await tienda().verCarrito()).cantidadTotal;
  } catch (e) {
    registrar(e, 'checkout: carrito');
    return { error: mensajeUsuario(e) };
  }
  if (cantidad === 0) return { error: 'Tu carrito está vacío.' };

  // 3. Direccion nueva y pedido
  let idPedido: number;
  let creada: number | undefined;
  try {
    if (nueva) {
      creada = await tienda().crearDireccion({
        idZona: dir.idZona, callePrincipal: dir.callePrincipal,
        calleSecundaria: dir.calleSecundaria || undefined, referencia: dir.referencia || undefined,
        esPrincipal: texto(fd, 'principal', 3) === 'on',
      });
      idDireccion = creada;
    }
    idPedido = await tienda().crearPedido(idDireccion);
  } catch (e) {
    registrar(e, 'checkout: pedido');
    if (e instanceof ApiError && e.estado === 401) redirect(hrefIngresar('/checkout'));
    return { error: mensajeUsuario(e), idDireccion: creada };
  }

  // 4. Pago (redirige siempre)
  return pagarYRedirigir(idPedido, pago.datos);
}

/** Reintento de pago o subida tardia del comprobante sobre un pedido existente. */
export async function pagarPedidoAccion(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  if (!(await leerJwt())) redirect(hrefIngresar('/checkout'));
  const idPedido = Number(texto(fd, 'idPedido', 12));
  if (!Number.isInteger(idPedido) || idPedido < 1) return { error: 'Pedido no válido.' };

  const pago = leerPago(fd, !modoDemo());
  if (hayErrores(pago.errores) || !pago.datos) return { errores: pago.errores };
  return pagarYRedirigir(idPedido, pago.datos);
}

export async function cancelarPedidoAccion(fd: FormData): Promise<void> {
  const idPedido = Number(texto(fd, 'idPedido', 12));
  if (!Number.isInteger(idPedido) || idPedido < 1) redirect('/');
  if (!(await leerJwt())) redirect(hrefIngresar('/'));
  try {
    await tienda().cancelarPedido(idPedido);
  } catch (e) {
    registrar(e, 'cancelar pedido');
  }
  redirect(`/pedido/${idPedido}`);
}
