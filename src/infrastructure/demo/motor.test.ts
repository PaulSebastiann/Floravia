import { describe, expect, it } from 'vitest';
import { centavos } from '@/domain/dinero';
import {
  TARJETA_RECHAZADA, TARJETA_SIN_FONDOS, agregar, autenticar, baseVacia, cancelar, crearDireccion, crearPedido,
  firmarToken, fusionar, obtenerPedido, pagarTarjeta, pagarTransferencia, quitar, registrar, establecer,
  verificarToken, vistaCarrito, listarPedidos, type Catalogo,
} from './motor';

const catalogo: Catalogo = (id) =>
  id === 1 ? { idProducto: 1, codigo: 'P1', nombre: 'Rosa', precio: centavos(1000), stock: 20 }
  : id === 2 ? { idProducto: 2, codigo: 'P2', nombre: 'Cactus', precio: centavos(500), stock: 2 }
  : undefined;

const datos = { correo: 'Ana@Correo.com', password: 'Clave-Segura1', cedula: '1712345678', nombres: 'Ana', apellidos: 'Lopez', telefono: '0999999999' };

function conCuenta() {
  const db = baseVacia();
  const u = registrar(db, datos);
  return { db, u };
}

describe('demo: cuentas', () => {
  it('registra, normaliza el correo y permite iniciar sesion', () => {
    const { db, u } = conCuenta();
    expect(u.correo).toBe('ana@correo.com');
    expect(autenticar(db, ' ANA@correo.com ', 'Clave-Segura1').idCliente).toBe(u.idCliente);
    expect(u.hash).not.toContain('Clave-Segura1');
  });
  it('rechaza correo duplicado, cedula invalida y clave incorrecta', () => {
    const { db } = conCuenta();
    expect(() => registrar(db, datos)).toThrow(/Ya existe/);
    expect(() => registrar(db, { ...datos, correo: 'otra@x.com', cedula: '123' })).toThrow(/cédula/);
    expect(() => autenticar(db, 'ana@correo.com', 'mala')).toThrow(/incorrectos/);
    expect(() => autenticar(db, 'nadie@x.com', 'Clave-Segura1')).toThrow(/incorrectos/);
  });
  it('el token solo es valido para esta base, vigente y de un usuario existente', () => {
    const { db, u } = conCuenta();
    const ahora = 1_800_000_000_000;
    const { token } = firmarToken(db, u, ahora);
    expect(verificarToken(db, token, ahora + 1000)).toBe(u.idCliente);
    expect(verificarToken(db, token, ahora + 9 * 3600 * 1000)).toBeNull();
    expect(verificarToken(baseVacia(), token, ahora)).toBeNull();
    expect(verificarToken(db, token.slice(0, -2) + 'xx', ahora)).toBeNull();
    expect(verificarToken(db, 'basura', ahora)).toBeNull();
  });
});

describe('demo: carrito', () => {
  it('agrega, suma, rechaza exceder stock, establece y quita', () => {
    const db = baseVacia();
    agregar(db, 'v:abc', catalogo, 1, 2);
    agregar(db, 'v:abc', catalogo, 1, 1);
    expect(() => agregar(db, 'v:abc', catalogo, 2, 5)).toThrow(/stock suficiente/); // stock 2: error como la API real
    agregar(db, 'v:abc', catalogo, 2, 2);
    let c = vistaCarrito(db, 'v:abc', catalogo);
    expect(c.lineas.find((l) => l.idProducto === 1)?.cantidad).toBe(3);
    expect(c.lineas.find((l) => l.idProducto === 2)?.cantidad).toBe(2);
    establecer(db, 'v:abc', catalogo, 1, 7);
    quitar(db, 'v:abc', 2);
    c = vistaCarrito(db, 'v:abc', catalogo);
    expect(c.lineas).toHaveLength(1);
    expect(c.subtotal + c.iva).toBe(c.totalSinEnvio);
  });
  it('fusiona el carrito del visitante con el de la cuenta', () => {
    const { db, u } = conCuenta();
    agregar(db, `c:${u.idCliente}`, catalogo, 1, 2);
    agregar(db, 'v:tok', catalogo, 1, 3);
    agregar(db, 'v:tok', catalogo, 2, 1);
    fusionar(db, 'tok', u.idCliente, catalogo);
    const c = vistaCarrito(db, `c:${u.idCliente}`, catalogo);
    expect(c.lineas.find((l) => l.idProducto === 1)?.cantidad).toBe(5);
    expect(c.lineas.find((l) => l.idProducto === 2)?.cantidad).toBe(1);
    expect(db.carritos['v:tok']).toBeUndefined();
  });
});

function pedidoListo() {
  const { db, u } = conCuenta();
  agregar(db, `c:${u.idCliente}`, catalogo, 1, 2);
  const dir = crearDireccion(db, u.idCliente, { idZona: 1, callePrincipal: 'Av. Siempre Viva', esPrincipal: true });
  const id = crearPedido(db, u.idCliente, dir, catalogo, new Date('2026-11-19T10:00:00Z'));
  return { db, u, id };
}

describe('demo: pedidos y pagos', () => {
  it('convierte el carrito en pedido PENDIENTE_PAGO con total = lineas + envio', () => {
    const { db, u, id } = pedidoListo();
    const p = obtenerPedido(db, u.idCliente, id)!;
    expect(p.estado).toBe('PENDIENTE_PAGO');
    expect(p.total).toBe(p.subtotal + p.iva + p.costoEnvio);
    expect(vistaCarrito(db, `c:${u.idCliente}`, catalogo).lineas).toHaveLength(0);
    expect(listarPedidos(db, u.idCliente)).toHaveLength(1);
  });
  it('no crea pedido con carrito vacio ni con direccion ajena', () => {
    const { db, u } = conCuenta();
    expect(() => crearPedido(db, u.idCliente, 1, catalogo, new Date())).toThrow(/vacío/);
    agregar(db, `c:${u.idCliente}`, catalogo, 1, 1);
    expect(() => crearPedido(db, u.idCliente, 999, catalogo, new Date())).toThrow(/dirección/);
  });
  it('tarjeta: cualquier numero se aprueba y solo guarda marca y ultimos 4', () => {
    for (const n of ['1', '1234', '4242 4242 4242 4242', '9999999999999999']) {
      const { db, u, id } = pedidoListo();
      const r = pagarTarjeta(db, u.idCliente, id, n);
      expect(r.aprobado).toBe(true);
      const p = obtenerPedido(db, u.idCliente, id)!;
      expect(p.estado).toBe('PAGADO');
      expect(JSON.stringify(p)).not.toContain('4242 4242 4242 4242');
      expect(p.pagos[0]?.tarjeta?.ultimos4).toHaveLength(4);
    }
  });
  it('tarjeta: los dos numeros de prueba fallan y el pedido admite reintento', () => {
    for (const n of [TARJETA_RECHAZADA, TARJETA_SIN_FONDOS]) {
      const { db, u, id } = pedidoListo();
      expect(pagarTarjeta(db, u.idCliente, id, n).aprobado).toBe(false);
      expect(obtenerPedido(db, u.idCliente, id)!.estado).toBe('PAGO_FALLIDO');
      expect(pagarTarjeta(db, u.idCliente, id, '1').aprobado).toBe(true);
      expect(obtenerPedido(db, u.idCliente, id)!.estado).toBe('PAGADO');
    }
  });
  it('tarjeta: exige algun digito', () => {
    const { db, u, id } = pedidoListo();
    expect(() => pagarTarjeta(db, u.idCliente, id, 'abc')).toThrow(/número/);
  });
  it('transferencia: queda pendiente de verificacion, con o sin comprobante, y no admite doble pago', () => {
    const { db, u, id } = pedidoListo();
    pagarTransferencia(db, u.idCliente, id, { tieneComprobante: false });
    const p = obtenerPedido(db, u.idCliente, id)!;
    expect(p.estado).toBe('PENDIENTE_PAGO');
    expect(p.pagos[0]?.estado).toBe('PENDIENTE');
    expect(() => pagarTransferencia(db, u.idCliente, id, { tieneComprobante: true })).toThrow(/revisión/);
    expect(() => pagarTarjeta(db, u.idCliente, id, '1')).toThrow(/revisión/);
  });
  it('un cliente no ve ni paga pedidos ajenos (404) y se puede cancelar un pedido pendiente', () => {
    const { db, id } = pedidoListo();
    const otro = registrar(db, { ...datos, correo: 'otro@x.com' });
    expect(obtenerPedido(db, otro.idCliente, id)).toBeNull();
    expect(() => pagarTarjeta(db, otro.idCliente, id, '1')).toThrow(/no encontrado/i);
    expect(() => cancelar(db, otro.idCliente, id)).toThrow(/no encontrado/i);
    cancelar(db, 1, id);
    expect(obtenerPedido(db, 1, id)!.estado).toBe('CANCELADO');
    expect(() => cancelar(db, 1, id)).toThrow(/no se puede cancelar/);
  });
});
