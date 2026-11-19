/**
 * Motor de la TIENDA DE DEMOSTRACION (modo sin API). Logica pura: sin cookies, sin Next, sin disco.
 * Reproduce las reglas observables de la API .NET (cuentas, carrito, pedido, pagos) para que el flujo completo
 * se pueda probar sin backend. NO es seguridad real: los datos viven en un JSON local y nada se cobra.
 */
import crypto from 'node:crypto';
import { CARRITO_VACIO, MAX_POR_PRODUCTO, type Carrito } from '@/domain/carrito';
import type { Direccion, ZonaEntrega } from '@/domain/cuenta';
import { centavos, type Centavos } from '@/domain/dinero';
import {
  admitePago, type EstadoPedido, type LineaPedido, type MetodoPago, type PagoPedido, type Pedido, type ResumenPedido,
} from '@/domain/pedido';
import { detectarMarca, soloDigitos } from '@/domain/tarjeta';
import { validarCorreo, validarPassword } from '@/domain/validaciones-cuenta';
import { ApiError } from '../api/errores';

export const IVA_DEMO = 15;
export const ZONAS_DEMO: readonly ZonaEntrega[] = [
  { idZona: 1, sector: 'Norte', costoEnvio: centavos(300) },
  { idZona: 2, sector: 'Centro', costoEnvio: centavos(250) },
  { idZona: 3, sector: 'Sur', costoEnvio: centavos(350) },
  { idZona: 4, sector: 'Valles', costoEnvio: centavos(450) },
];
/** Unicas tarjetas que NO se aprueban: sirven para probar el reintento. Cualquier otro numero se aprueba. */
export const TARJETA_RECHAZADA = '4000000000000002';
export const TARJETA_SIN_FONDOS = '4000000000009995';

// ───────────── Modelo persistido ─────────────
export interface UsuarioDemo {
  idCliente: number; correo: string; salt: string; hash: string;
  nombres: string; apellidos: string; cedula: string; telefono: string;
}
export interface DireccionDemo {
  idDireccion: number; idCliente: number; idZona: number; callePrincipal: string;
  calleSecundaria?: string; referencia?: string; ciudad: string; esPrincipal: boolean;
}
export interface PedidoDemo {
  idPedido: number; numero: string; idCliente: number; fecha: string;
  subtotal: Centavos; iva: Centavos; costoEnvio: Centavos; total: Centavos;
  estado: EstadoPedido; lineas: LineaPedido[]; pagos: PagoPedido[]; direccionTexto: string;
}
export interface LineaGuardada { idProducto: number; cantidad: number }
export interface BaseDemo {
  secreto: string;
  usuarios: UsuarioDemo[];
  direcciones: DireccionDemo[];
  /** Clave `c:{idCliente}` (cuenta) o `v:{token}` (visitante). */
  carritos: Record<string, LineaGuardada[]>;
  pedidos: PedidoDemo[];
  stockPorProducto: Record<number, number>;
  reservadoPorProducto: Record<number, number>;
  seq: { cliente: number; direccion: number; pedido: number; pago: number };
}
export const baseVacia = (): BaseDemo => ({
  secreto: crypto.randomBytes(32).toString('hex'),
  usuarios: [], direcciones: [], carritos: {}, pedidos: [],
  stockPorProducto: {}, reservadoPorProducto: {},
  seq: { cliente: 1, direccion: 1, pedido: 1, pago: 1 },
});

export interface ProductoDemo {
  idProducto: number; codigo: string; nombre: string; precio: Centavos; stock: number; imagen?: string;
}
export type Catalogo = (idProducto: number) => ProductoDemo | undefined;

const regla = (m: string) => new ApiError(400, 'Regla de negocio', m);
const noEncontrado = (m: string) => new ApiError(404, 'No encontrado', m);

// ───────────── Cuentas y sesion ─────────────
const hashPassword = (password: string, salt: string): string =>
  crypto.scryptSync(password, salt, 32).toString('hex');

export interface DatosRegistroDemo {
  correo: string; password: string; cedula: string; nombres: string; apellidos: string; telefono: string;
}

export function registrar(db: BaseDemo, d: DatosRegistroDemo): UsuarioDemo {
  const correo = d.correo.trim().toLowerCase();
  const err = validarCorreo(correo) ?? validarPassword(d.password);
  if (err) throw regla(err);
  if (!/^[0-9]{10}$/.test(d.cedula.trim())) throw regla('La cédula debe tener 10 dígitos.');
  if (!d.nombres.trim() || !d.apellidos.trim()) throw regla('Nombre y apellido son obligatorios.');
  if (db.usuarios.some((u) => u.correo === correo)) throw regla('Ya existe una cuenta con ese correo.');
  const salt = crypto.randomBytes(16).toString('hex');
  const u: UsuarioDemo = {
    idCliente: db.seq.cliente++, correo, salt, hash: hashPassword(d.password, salt),
    nombres: d.nombres.trim(), apellidos: d.apellidos.trim(), cedula: d.cedula.trim(), telefono: d.telefono.trim(),
  };
  db.usuarios.push(u);
  return u;
}

export function autenticar(db: BaseDemo, correo: string, password: string): UsuarioDemo {
  const u = db.usuarios.find((x) => x.correo === correo.trim().toLowerCase());
  // Se calcula el hash igual si el usuario no existe: mismo costo, sin revelar que cuentas existen por el tiempo.
  const esperado = Buffer.from(u?.hash ?? '0'.repeat(64), 'hex');
  const calculado = Buffer.from(hashPassword(password, u?.salt ?? '0'.repeat(32)), 'hex');
  if (!u || !crypto.timingSafeEqual(esperado, calculado)) {
    throw new ApiError(401, 'No se pudo iniciar sesión', 'Correo o contraseña incorrectos.');
  }
  return u;
}

const b64u = (s: string): string => Buffer.from(s).toString('base64url');
const firma = (db: BaseDemo, datos: string): string =>
  crypto.createHmac('sha256', db.secreto).update(datos).digest('base64url');

/** Token con forma de JWT (el resto del frontend solo lee `exp`, `email` y `role`). Firmado con el secreto local. */
export function firmarToken(db: BaseDemo, u: UsuarioDemo, ahoraMs: number): { token: string; expiraEn: string } {
  const exp = Math.floor(ahoraMs / 1000) + 8 * 3600;
  const cuerpo = `${b64u('{"alg":"HS256","typ":"JWT"}')}.${b64u(JSON.stringify({
    sub: String(u.idCliente), email: u.correo, role: 'CLIENTE', idCliente: u.idCliente, exp,
  }))}`;
  return { token: `${cuerpo}.${firma(db, cuerpo)}`, expiraEn: new Date(exp * 1000).toISOString() };
}

/** idCliente si el token es nuestro, no vencio y el usuario sigue existiendo; si no, null. */
export function verificarToken(db: BaseDemo, token: string, ahoraMs: number): number | null {
  const [h, c, f] = token.split('.');
  if (!h || !c || !f) return null;
  const esperado = Buffer.from(firma(db, `${h}.${c}`));
  const recibido = Buffer.from(f);
  if (esperado.length !== recibido.length || !crypto.timingSafeEqual(esperado, recibido)) return null;
  try {
    const p = JSON.parse(Buffer.from(c, 'base64url').toString('utf8')) as { idCliente?: unknown; exp?: unknown };
    if (typeof p.idCliente !== 'number' || typeof p.exp !== 'number' || p.exp * 1000 <= ahoraMs) return null;
    return db.usuarios.some((u) => u.idCliente === p.idCliente) ? p.idCliente : null;
  } catch {
    return null;
  }
}

export const nombreCompleto = (u: UsuarioDemo): string => `${u.nombres} ${u.apellidos}`;

// ───────────── Carrito ─────────────
const maxLinea = (p: ProductoDemo): number => Math.max(0, Math.min(MAX_POR_PRODUCTO, p.stock));

export function vistaCarrito(db: BaseDemo, clave: string | undefined, catalogo: Catalogo): Carrito {
  const guardadas = clave ? db.carritos[clave] ?? [] : [];
  const lineas = guardadas.flatMap((g) => {
    const p = catalogo(g.idProducto);
    if (!p) return [];
    return [{
      idProducto: p.idProducto, codigo: p.codigo, nombre: p.nombre, cantidad: g.cantidad,
      precioUnitario: p.precio, subtotal: centavos(p.precio * g.cantidad), stockDisponible: p.stock, imagen: p.imagen,
    }];
  });
  if (lineas.length === 0) return { ...CARRITO_VACIO, porcentajeIva: IVA_DEMO };
  const subtotal = centavos(lineas.reduce((a, l) => a + l.subtotal, 0));
  const iva = centavos(Math.round((subtotal * IVA_DEMO) / 100));
  return {
    lineas, cantidadTotal: lineas.reduce((a, l) => a + l.cantidad, 0), subtotal,
    porcentajeIva: IVA_DEMO, iva, totalSinEnvio: centavos(subtotal + iva),
  };
}

export function agregar(db: BaseDemo, clave: string, catalogo: Catalogo, idProducto: number, cantidad: number): void {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_POR_PRODUCTO) {
    throw regla(`La cantidad debe estar entre 1 y ${MAX_POR_PRODUCTO}.`);
  }
  const p = catalogo(idProducto);
  if (!p) throw noEncontrado('Producto no encontrado.');
  const lineas = (db.carritos[clave] ??= []);
  const ya = lineas.find((l) => l.idProducto === idProducto);
  const nueva = (ya?.cantidad ?? 0) + cantidad;
  if (nueva > maxLinea(p)) {
    throw regla(p.stock <= 0 ? `«${p.nombre}» está agotado.` : `No hay stock suficiente de «${p.nombre}». Disponible: ${maxLinea(p)}.`);
  }
  if (ya) ya.cantidad = nueva;
  else lineas.push({ idProducto, cantidad });
}

export function establecer(db: BaseDemo, clave: string, catalogo: Catalogo, idProducto: number, cantidad: number): void {
  const lineas = db.carritos[clave];
  if (!lineas) throw noEncontrado('Aún no tienes un carrito.');
  if (cantidad <= 0) { quitar(db, clave, idProducto); return; }
  const p = catalogo(idProducto);
  const l = lineas.find((x) => x.idProducto === idProducto);
  if (!p || !l) throw noEncontrado('Ese producto no está en tu carrito.');
  if (cantidad > maxLinea(p)) throw regla(`No hay stock suficiente de «${p.nombre}». Disponible: ${maxLinea(p)}.`);
  l.cantidad = cantidad;
}

export function quitar(db: BaseDemo, clave: string, idProducto: number): void {
  const lineas = db.carritos[clave];
  if (!lineas) throw noEncontrado('Aún no tienes un carrito.');
  db.carritos[clave] = lineas.filter((l) => l.idProducto !== idProducto);
}

/** Une el carrito del visitante con el de la cuenta (suma cantidades hasta el maximo permitido). */
export function fusionar(db: BaseDemo, tokenVisitante: string | undefined, idCliente: number, catalogo: Catalogo): void {
  if (!tokenVisitante) return;
  const origen = db.carritos[`v:${tokenVisitante}`];
  if (!origen) return;
  const destino = (db.carritos[`c:${idCliente}`] ??= []);
  for (const l of origen) {
    const p = catalogo(l.idProducto);
    if (!p) continue;
    const ya = destino.find((x) => x.idProducto === l.idProducto);
    const total = Math.min(maxLinea(p), (ya?.cantidad ?? 0) + l.cantidad);
    if (total <= 0) continue;
    if (ya) ya.cantidad = total;
    else destino.push({ idProducto: l.idProducto, cantidad: total });
  }
  delete db.carritos[`v:${tokenVisitante}`];
}

// ───────────── Direcciones ─────────────
const zonaDe = (id: number): ZonaEntrega | undefined => ZONAS_DEMO.find((z) => z.idZona === id);

function aDireccion(d: DireccionDemo): Direccion {
  const z = zonaDe(d.idZona);
  return {
    idDireccion: d.idDireccion, idZona: d.idZona, callePrincipal: d.callePrincipal, calleSecundaria: d.calleSecundaria,
    referencia: d.referencia, ciudad: d.ciudad, esPrincipal: d.esPrincipal, sector: z?.sector, costoEnvio: z?.costoEnvio ?? centavos(0),
  };
}

export const listarDirecciones = (db: BaseDemo, idCliente: number): Direccion[] =>
  db.direcciones.filter((d) => d.idCliente === idCliente).map(aDireccion);

export function crearDireccion(
  db: BaseDemo, idCliente: number,
  d: { idZona: number; callePrincipal: string; calleSecundaria?: string; referencia?: string; esPrincipal: boolean },
): number {
  if (!zonaDe(d.idZona)) throw regla('La zona de entrega no existe.');
  if (!d.callePrincipal.trim()) throw regla('La calle principal es obligatoria.');
  if (d.esPrincipal) db.direcciones.filter((x) => x.idCliente === idCliente).forEach((x) => { x.esPrincipal = false; });
  const nueva: DireccionDemo = {
    idDireccion: db.seq.direccion++, idCliente, idZona: d.idZona, callePrincipal: d.callePrincipal.trim(),
    calleSecundaria: d.calleSecundaria?.trim() || undefined, referencia: d.referencia?.trim() || undefined,
    ciudad: 'Quito', esPrincipal: d.esPrincipal,
  };
  db.direcciones.push(nueva);
  return nueva.idDireccion;
}

// ───────────── Pedidos ─────────────
const propio = (db: BaseDemo, idCliente: number, id: number): PedidoDemo => {
  const p = db.pedidos.find((x) => x.idPedido === id && x.idCliente === idCliente);
  if (!p) throw noEncontrado('Pedido no encontrado.'); // tambien si es de otro cliente
  return p;
};

export function vistaPedido(p: PedidoDemo): Pedido {
  return {
    idPedido: p.idPedido, numero: p.numero, fecha: p.fecha, subtotal: p.subtotal, iva: p.iva, costoEnvio: p.costoEnvio,
    total: p.total, estado: p.estado, lineas: p.lineas, pagos: p.pagos,
    entrega: { direccion: p.direccionTexto, estado: 'PROGRAMADA' },
  };
}

export function crearPedido(
  db: BaseDemo, idCliente: number, idDireccion: number, catalogo: Catalogo, ahora: Date,
): number {
  const clave = `c:${idCliente}`;
  const guardadas = db.carritos[clave] ?? [];
  if (guardadas.length === 0) throw regla('Tu carrito está vacío.');
  const dir = db.direcciones.find((d) => d.idDireccion === idDireccion && d.idCliente === idCliente);
  if (!dir) throw regla('La dirección de entrega no es válida.');
  const zona = zonaDe(dir.idZona);
  if (!zona) throw regla('La zona de entrega no existe.');
  for (const g of guardadas) {
    const p = catalogo(g.idProducto);
    if (!p || g.cantidad > p.stock) throw regla(`No hay stock suficiente de «${p?.nombre ?? 'un producto'}».`);
  }
  const v = vistaCarrito(db, clave, catalogo);
  const idPedido = db.seq.pedido++;
  db.pedidos.push({
    idPedido, numero: `FLV-${String(idPedido).padStart(6, '0')}`, idCliente, fecha: ahora.toISOString().replace('Z', ''),
    subtotal: v.subtotal, iva: v.iva, costoEnvio: zona.costoEnvio, total: centavos(v.totalSinEnvio + zona.costoEnvio),
    estado: 'PENDIENTE_PAGO',
    lineas: v.lineas.map((l) => ({
      idProducto: l.idProducto, codigo: l.codigo, nombre: l.nombre, cantidad: l.cantidad,
      precioUnitario: l.precioUnitario, subtotal: l.subtotal,
    })),
    pagos: [],
    direccionTexto: `${dir.callePrincipal}${dir.calleSecundaria ? ` y ${dir.calleSecundaria}` : ''}, ${zona.sector}, ${dir.ciudad}`,
  });
  for (const g of guardadas) {
    const reservadoAnterior = db.reservadoPorProducto[g.idProducto] ?? 0;
    db.stockPorProducto[g.idProducto] ??=
      (catalogo(g.idProducto)?.stock ?? 0) + reservadoAnterior;
    db.reservadoPorProducto[g.idProducto] = reservadoAnterior + g.cantidad;
  }
  delete db.carritos[clave]; // el carrito se convierte en pedido
  return idPedido;
}

export const obtenerPedido = (db: BaseDemo, idCliente: number, id: number): Pedido | null => {
  const p = db.pedidos.find((x) => x.idPedido === id && x.idCliente === idCliente);
  return p ? vistaPedido(p) : null;
};

export const listarPedidos = (db: BaseDemo, idCliente: number): ResumenPedido[] =>
  db.pedidos.filter((p) => p.idCliente === idCliente).reverse().map((p) => ({
    idPedido: p.idPedido, numero: p.numero, fecha: p.fecha, total: p.total, estado: p.estado,
  }));

export function cancelar(db: BaseDemo, idCliente: number, id: number): void {
  const p = propio(db, idCliente, id);
  if (p.estado !== 'PENDIENTE_PAGO' && p.estado !== 'PAGO_FALLIDO') throw regla('Este pedido ya no se puede cancelar.');
  for (const linea of p.lineas) {
    db.reservadoPorProducto[linea.idProducto] =
      Math.max(0, (db.reservadoPorProducto[linea.idProducto] ?? 0) - linea.cantidad);
  }
  p.pagos = p.pagos.map((g) => (g.estado === 'PENDIENTE' ? { ...g, estado: 'RECHAZADO' as const } : g));
  p.estado = 'CANCELADO';
}

function exigirPagable(p: PedidoDemo): void {
  if (!admitePago(p)) {
    throw regla(p.pagos.some((g) => g.estado === 'PENDIENTE')
      ? 'Ya tienes un pago en revisión para este pedido.'
      : 'Este pedido no admite pagos en su estado actual.');
  }
}

export interface ResultadoPagoTarjeta { aprobado: boolean; mensaje: string }

/** Tarjeta SIMULADA: cualquier dato se aprueba salvo dos numeros de prueba. Solo se conservan marca y ultimos 4. */
export function pagarTarjeta(
  db: BaseDemo, idCliente: number, idPedido: number, numeroTarjeta: string,
): ResultadoPagoTarjeta {
  const p = propio(db, idCliente, idPedido);
  exigirPagable(p);
  const digitos = soloDigitos(numeroTarjeta);
  if (digitos.length === 0) throw regla('Escribe un número de tarjeta.');
  const marca = detectarMarca(digitos);
  const ultimos4 = digitos.slice(-4).padStart(4, '0');
  const mensaje = digitos === TARJETA_RECHAZADA ? 'Tarjeta rechazada por el emisor (simulación).'
    : digitos === TARJETA_SIN_FONDOS ? 'Fondos insuficientes (simulación).' : null;
  p.pagos.push({
    idPago: db.seq.pago++, metodo: 'TARJETA', monto: p.total, estado: mensaje ? 'RECHAZADO' : 'APROBADO',
    tarjeta: { marca, ultimos4 }, tieneComprobante: false,
  });
  if (mensaje) {
    p.estado = 'PAGO_FALLIDO';
  } else {
    p.estado = 'PAGADO';
    for (const linea of p.lineas) {
      const reservado = db.reservadoPorProducto[linea.idProducto] ?? 0;
      db.reservadoPorProducto[linea.idProducto] = Math.max(0, reservado - linea.cantidad);
      db.stockPorProducto[linea.idProducto] =
        Math.max(0, (db.stockPorProducto[linea.idProducto] ?? 0) - linea.cantidad);
    }
  }
  return { aprobado: !mensaje, mensaje: mensaje ?? 'Pago aprobado (simulación).' };
}

/** Transferencia: queda PENDIENTE de verificacion (en la demo el comprobante es opcional). */
export function pagarTransferencia(
  db: BaseDemo, idCliente: number, idPedido: number, d: { tieneComprobante: boolean; referencia?: string },
): void {
  const p = propio(db, idCliente, idPedido);
  exigirPagable(p);
  p.pagos.push({
    idPago: db.seq.pago++, metodo: 'TRANSFERENCIA' as MetodoPago, monto: p.total, estado: 'PENDIENTE',
    tieneComprobante: d.tieneComprobante, referencia: d.referencia?.trim() || undefined,
  });
  p.estado = 'PENDIENTE_PAGO';
}
