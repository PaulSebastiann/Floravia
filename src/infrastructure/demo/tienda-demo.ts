import 'server-only';
import crypto from 'node:crypto';
import type { Carrito } from '@/domain/carrito';
import type { Cliente, Direccion, MetodosPago, ZonaEntrega } from '@/domain/cuenta';
import type { Pedido, ResumenPedido } from '@/domain/pedido';
import { ApiError } from '../api/errores';
import {
  borrarTokenCarrito, guardarSesion, guardarTokenCarrito, leerJwt, leerTokenCarrito,
} from '../api/sesion';
import type { DatosDireccion, DatosRegistro, ResultadoTarjeta } from '../api/tienda-api';
import { PRODUCTOS_MOCK } from '../mocks/datos-productos';
import { base, guardar } from './almacen';
import * as motor from './motor';

/**
 * Misma interfaz que `api/tienda-api.ts`, pero contra el motor local (modo sin API).
 * Se elige en `infrastructure/tienda.ts`. Cada mutacion persiste con `guardar()`.
 */
export { CuentaNoPermitida } from '../api/tienda-api';

const catalogo: motor.Catalogo = (id) => {
  const p = PRODUCTOS_MOCK.find((x) => x.idProducto === id);
  const stockPersistido = base().stockPorProducto[id];
  const reservado = base().reservadoPorProducto[id] ?? 0;
  const stockFisico = stockPersistido ?? p?.stockDisponible ?? 0;
  return p && {
    idProducto: id, codigo: p.id.toUpperCase(), nombre: p.nombre, precio: p.precio,
    stock: Math.max(0, stockFisico - reservado), imagen: p.imagenes[0]?.url,
  };
};

async function idCliente(): Promise<number | null> {
  const jwt = await leerJwt();
  return jwt ? motor.verificarToken(base(), jwt, Date.now()) : null;
}
async function exigirCliente(): Promise<number> {
  const id = await idCliente();
  if (id === null) throw new ApiError(401, 'No autenticado', 'Inicia sesión para continuar.');
  return id;
}
async function claveCarrito(): Promise<string | undefined> {
  const id = await idCliente();
  if (id !== null) return `c:${id}`;
  const t = await leerTokenCarrito();
  return t ? `v:${t}` : undefined;
}

// ───────────── Carrito ─────────────
export async function verCarrito(): Promise<Carrito> {
  return motor.vistaCarrito(base(), await claveCarrito(), catalogo);
}

export async function agregarAlCarrito(idProducto: number, cantidad: number): Promise<Carrito> {
  let clave = await claveCarrito();
  if (!clave) {
    const token = crypto.randomBytes(24).toString('hex'); // 48 hex, igual que la API
    await guardarTokenCarrito(token);
    clave = `v:${token}`;
  }
  motor.agregar(base(), clave, catalogo, idProducto, cantidad);
  guardar();
  return motor.vistaCarrito(base(), clave, catalogo);
}

export async function establecerCantidad(idProducto: number, cantidad: number): Promise<Carrito> {
  const clave = await claveCarrito();
  if (!clave) throw new ApiError(404, 'No encontrado', 'Aún no tienes un carrito.');
  motor.establecer(base(), clave, catalogo, idProducto, cantidad);
  guardar();
  return motor.vistaCarrito(base(), clave, catalogo);
}

export async function quitarDelCarrito(idProducto: number): Promise<Carrito> {
  const clave = await claveCarrito();
  if (!clave) throw new ApiError(404, 'No encontrado', 'Aún no tienes un carrito.');
  motor.quitar(base(), clave, idProducto);
  guardar();
  return motor.vistaCarrito(base(), clave, catalogo);
}

// ───────────── Cuenta ─────────────
async function abrirSesion(u: motor.UsuarioDemo): Promise<void> {
  const { token, expiraEn } = motor.firmarToken(base(), u, Date.now());
  await guardarSesion({ token, expiraEn, rol: 'CLIENTE', nombre: motor.nombreCompleto(u) });
  const visitante = await leerTokenCarrito();
  motor.fusionar(base(), visitante, u.idCliente, catalogo);
  if (visitante) await borrarTokenCarrito();
  guardar();
}

export async function iniciarSesion(correo: string, password: string): Promise<void> {
  await abrirSesion(motor.autenticar(base(), correo, password));
}

export async function registrarCliente(d: DatosRegistro): Promise<void> {
  const u = motor.registrar(base(), d);
  guardar();
  await abrirSesion(u);
}

export async function perfil(): Promise<Cliente> {
  const id = await exigirCliente();
  const u = base().usuarios.find((x) => x.idCliente === id);
  if (!u) throw new ApiError(401, 'No autenticado', 'Inicia sesión para continuar.');
  return { idCliente: id, cedula: u.cedula, nombres: u.nombres, apellidos: u.apellidos, telefono: u.telefono, correo: u.correo };
}

export async function zonasDeEntrega(): Promise<readonly ZonaEntrega[]> {
  return motor.ZONAS_DEMO;
}

export async function direcciones(): Promise<readonly Direccion[]> {
  return motor.listarDirecciones(base(), await exigirCliente());
}

export async function crearDireccion(d: DatosDireccion): Promise<number> {
  const id = motor.crearDireccion(base(), await exigirCliente(), d);
  guardar();
  return id;
}

// ───────────── Pedidos y pagos ─────────────
export async function metodosDePago(): Promise<MetodosPago> {
  return {
    ficticio: true,
    transferencia: {
      banco: 'Banco Floravia Demo', tipoCuenta: 'Ahorros', numeroCuenta: '0000 0000 00',
      titular: 'Floravia (datos ficticios)', identificacion: '0000000000',
    },
    tarjetasDePrueba: [
      { numero: '4242 4242 4242 4242', resultado: 'aprobada' },
      { numero: '4000 0000 0000 0002', resultado: 'rechazada (para probar el reintento)' },
      { numero: '4000 0000 0000 9995', resultado: 'fondos insuficientes' },
    ],
    avisoTarjeta: 'Compra simulada: no se realiza ningún cobro. Puedes escribir cualquier número, fecha, nombre y CVV.',
  };
}

export async function crearPedido(idDireccion: number): Promise<number> {
  const id = motor.crearPedido(base(), await exigirCliente(), idDireccion, catalogo, new Date());
  guardar();
  return id;
}

export async function obtenerPedido(idPedido: number): Promise<Pedido | null> {
  return motor.obtenerPedido(base(), await exigirCliente(), idPedido);
}

export async function listarMisPedidos(): Promise<readonly ResumenPedido[]> {
  return motor.listarPedidos(base(), await exigirCliente());
}

export async function pagarConTarjeta(
  idPedido: number,
  t: { numero: string; titular: string; mesVencimiento: number; anioVencimiento: number; cvv: string },
): Promise<ResultadoTarjeta> {
  const r = motor.pagarTarjeta(base(), await exigirCliente(), idPedido, t.numero);
  guardar(); // solo marca y ultimos 4; el numero completo, titular y CVV no se guardan
  return r;
}

export async function pagarPorTransferencia(idPedido: number, comprobante: File | undefined, referencia?: string): Promise<void> {
  motor.pagarTransferencia(base(), await exigirCliente(), idPedido, { tieneComprobante: Boolean(comprobante), referencia });
  guardar();
}

export async function cancelarPedido(idPedido: number): Promise<void> {
  motor.cancelar(base(), await exigirCliente(), idPedido);
  guardar();
}
