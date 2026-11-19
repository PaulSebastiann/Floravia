import 'server-only';
import { CARRITO_VACIO, type Carrito } from '@/domain/carrito';
import type { Cliente, Direccion, MetodosPago, ZonaEntrega } from '@/domain/cuenta';
import type { Pedido, ResumenPedido } from '@/domain/pedido';
import { apiFetch } from './cliente-api';
import type {
  CarritoRespuestaDto, CarritoVistaDto, ClienteDto, DireccionDto, MetodosPagoDto, PagoTarjetaRespuestaDto,
  PaginaPedidosDto, PedidoBaseDto, PedidoDetalleVistaDto, SesionDto, ZonaDto,
} from './dto';
import { ApiError } from './errores';
import {
  mapearCarrito, mapearCliente, mapearDireccion, mapearMetodos, mapearPedido, mapearResumenPedido, mapearZona,
} from './mapeos';
import {
  borrarTokenCarrito, guardarSesion, guardarTokenCarrito, leerJwt, leerTokenCarrito,
} from './sesion';

/**
 * Operaciones de tienda contra la API .NET. SOLO servidor.
 * Las que escriben cookies (login, registro, agregar al carrito) deben llamarse desde Server Actions.
 */

async function dueno() {
  return { jwt: await leerJwt(), tokenCarrito: await leerTokenCarrito() };
}

// ───────────── Carrito ─────────────

export async function verCarrito(): Promise<Carrito> {
  const d = await dueno();
  if (!d.jwt && !d.tokenCarrito) return CARRITO_VACIO; // sin dueno no hay carrito: ahorra un viaje
  const r = await apiFetch<CarritoVistaDto>('/api/carrito', d);
  return mapearCarrito(r.datos);
}

export async function agregarAlCarrito(idProducto: number, cantidad: number): Promise<Carrito> {
  const d = await dueno();
  const r = await apiFetch<CarritoRespuestaDto>('/api/carrito/items', {
    ...d, json: { idProducto, cantidad },
  });
  // El token de visitante solo viene la primera vez. Lo genera SIEMPRE el servidor.
  if (r.datos.token && !d.jwt) await guardarTokenCarrito(r.datos.token);
  return mapearCarrito(r.datos.carrito);
}

export async function establecerCantidad(idProducto: number, cantidad: number): Promise<Carrito> {
  const d = await dueno();
  // cantidad 0 = quitar (comportamiento de la API: EstablecerCantidadAsync)
  const r = cantidad <= 0
    ? await apiFetch<CarritoVistaDto>(`/api/carrito/items/${idProducto}`, { ...d, metodo: 'DELETE' })
    : await apiFetch<CarritoVistaDto>(`/api/carrito/items/${idProducto}`, { ...d, metodo: 'PUT', json: { cantidad } });
  return mapearCarrito(r.datos);
}

export async function quitarDelCarrito(idProducto: number): Promise<Carrito> {
  const d = await dueno();
  const r = await apiFetch<CarritoVistaDto>(`/api/carrito/items/${idProducto}`, { ...d, metodo: 'DELETE' });
  return mapearCarrito(r.datos);
}

// ───────────── Cuenta ─────────────

/** Une el carrito de visitante con el del cliente tras autenticarse. No debe romper el login si falla. */
async function fusionarCarrito(jwt: string): Promise<void> {
  const tokenCarrito = await leerTokenCarrito();
  try {
    await apiFetch('/api/carrito/fusionar', { metodo: 'POST', jwt, tokenCarrito });
    await borrarTokenCarrito();
  } catch (e) {
    // El token queda en la cookie: se reintentara en el siguiente inicio de sesion.
    console.error('[floravia] No se pudo fusionar el carrito tras iniciar sesion', e instanceof ApiError ? e.estado : e);
  }
}

export class CuentaNoPermitida extends Error {
  constructor() {
    super('Esta cuenta no es de cliente. Usa el portal de administración.');
    this.name = 'CuentaNoPermitida';
  }
}

async function abrirSesion(s: SesionDto): Promise<void> {
  // Un ADMIN no compra en la tienda: su token no debe quedar en una cookie de la vitrina.
  if (s.rol !== 'CLIENTE') throw new CuentaNoPermitida();
  await guardarSesion(s);
  await fusionarCarrito(s.token);
}

export async function iniciarSesion(correo: string, password: string): Promise<void> {
  const r = await apiFetch<SesionDto>('/api/auth/login', { json: { correo, password } });
  await abrirSesion(r.datos);
}

export interface DatosRegistro {
  readonly correo: string; readonly password: string; readonly cedula: string;
  readonly nombres: string; readonly apellidos: string; readonly telefono: string;
}

export async function registrarCliente(d: DatosRegistro): Promise<void> {
  const r = await apiFetch<SesionDto>('/api/auth/registro', { json: d });
  await abrirSesion(r.datos);
}

async function conSesion(): Promise<string> {
  const jwt = await leerJwt();
  if (!jwt) throw new ApiError(401, 'No autenticado', 'Inicia sesión para continuar.');
  return jwt;
}

export async function perfil(): Promise<Cliente> {
  const r = await apiFetch<ClienteDto>('/api/cuenta/perfil', { jwt: await conSesion() });
  return mapearCliente(r.datos);
}

export async function zonasDeEntrega(): Promise<readonly ZonaEntrega[]> {
  const r = await apiFetch<ZonaDto[]>('/api/zonas-entrega', { revalidar: 300 });
  return r.datos.filter((z) => z.activa !== false).map(mapearZona);
}

export async function direcciones(): Promise<readonly Direccion[]> {
  const r = await apiFetch<DireccionDto[]>('/api/cuenta/direcciones', { jwt: await conSesion() });
  return r.datos.filter((d) => d.activa !== false).map(mapearDireccion);
}

export interface DatosDireccion {
  readonly idZona: number; readonly callePrincipal: string; readonly calleSecundaria?: string;
  readonly referencia?: string; readonly esPrincipal: boolean;
}

export async function crearDireccion(d: DatosDireccion): Promise<number> {
  const r = await apiFetch<DireccionDto>('/api/cuenta/direcciones', { jwt: await conSesion(), json: { ...d, ciudad: 'Quito' } });
  return r.datos.idDireccion;
}

// ───────────── Pedidos y pagos ─────────────

export async function metodosDePago(): Promise<MetodosPago> {
  const r = await apiFetch<MetodosPagoDto>('/api/pagos/metodos', { revalidar: 60 });
  return mapearMetodos(r.datos);
}

export async function crearPedido(idDireccion: number): Promise<number> {
  const r = await apiFetch<PedidoBaseDto>('/api/pedidos', { jwt: await conSesion(), json: { idDireccion } });
  return r.datos.idPedido;
}

export async function obtenerPedido(idPedido: number): Promise<Pedido | null> {
  try {
    const r = await apiFetch<PedidoDetalleVistaDto>(`/api/pedidos/${idPedido}`, { jwt: await conSesion() });
    return mapearPedido(r.datos);
  } catch (e) {
    if (e instanceof ApiError && e.estado === 404) return null;
    throw e;
  }
}

export interface ResultadoTarjeta {
  readonly aprobado: boolean;
  readonly mensaje: string;
}

/**
 * Pago con tarjeta SIMULADO. El 402 (rechazo) es un resultado esperado, no una excepcion.
 * Numero y CVV viajan una sola vez; no se registran ni se devuelven.
 */
export async function pagarConTarjeta(
  idPedido: number,
  t: { numero: string; titular: string; mesVencimiento: number; anioVencimiento: number; cvv: string },
): Promise<ResultadoTarjeta> {
  const r = await apiFetch<PagoTarjetaRespuestaDto>(`/api/pedidos/${idPedido}/pagos/tarjeta`, {
    jwt: await conSesion(), json: t, aceptar: [402],
  });
  return { aprobado: r.datos.aprobado, mensaje: r.datos.mensaje };
}

export async function pagarPorTransferencia(idPedido: number, comprobante: File | undefined, referencia?: string): Promise<void> {
  // La API exige comprobante en transferencias (solo la demostracion lo hace opcional).
  if (!comprobante) throw new ApiError(400, 'Regla de negocio', 'Adjunta el comprobante de tu transferencia.');
  const fd = new FormData();
  fd.set('comprobante', comprobante, comprobante.name);
  if (referencia) fd.set('referencia', referencia);
  await apiFetch(`/api/pedidos/${idPedido}/pagos/transferencia`, {
    jwt: await conSesion(), formData: fd, timeoutMs: 30_000,
  });
}

export async function cancelarPedido(idPedido: number): Promise<void> {
  await apiFetch(`/api/pedidos/${idPedido}/cancelar`, { jwt: await conSesion(), metodo: 'POST' });
}

export async function listarMisPedidos(pagina = 1): Promise<readonly ResumenPedido[]> {
  const r = await apiFetch<PaginaPedidosDto>('/api/pedidos', { jwt: await conSesion(), query: { pagina, tamano: 20 } });
  return r.datos.items.map(mapearResumenPedido);
}
