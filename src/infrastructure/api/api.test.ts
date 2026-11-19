import { describe, expect, it } from 'vitest';
import { estaVigente, leerPayload } from './jwt';
import { aCentavos, mapearCarrito, mapearPedido, mapearMetodos, urlMedia } from './mapeos';
import { idDeSlug, slugDe } from './slug';
import type { PedidoDetalleVistaDto } from './dto';

const jwt = (p: object) => `x.${Buffer.from(JSON.stringify(p)).toString('base64url')}.y`;

describe('jwt (solo lectura)', () => {
  it('lee exp, email y role', () => {
    const p = leerPayload(jwt({ exp: 2_000_000_000, email: 'a@b.co', role: 'CLIENTE' }));
    expect(p).toEqual({ exp: 2_000_000_000, email: 'a@b.co', role: 'CLIENTE' });
    expect(estaVigente(p, 1_000_000_000_000)).toBe(true);
    expect(estaVigente(p, 2_000_000_001_000)).toBe(false);
  });
  it('tolera basura', () => {
    expect(leerPayload('nada')).toBeNull();
    expect(leerPayload('a.%%%.c')).toBeNull();
    expect(estaVigente(null)).toBe(false);
    expect(estaVigente({})).toBe(false);
  });
});

describe('mapeos de dinero', () => {
  it('evita errores de punto flotante', () => {
    expect(aCentavos(0.1 + 0.2)).toBe(30);
    expect(aCentavos(24.9)).toBe(2490);
    expect(aCentavos(18.75)).toBe(1875);
  });
  it('rechaza montos invalidos', () => {
    expect(() => aCentavos(-1)).toThrow();
    expect(() => aCentavos(Number.NaN)).toThrow();
  });
  it('urlMedia antepone /media/ una sola vez', () => {
    expect(urlMedia('productos/a.jpg')).toBe('/media/productos/a.jpg');
    expect(urlMedia('/media/productos/a.jpg')).toBe('/media/productos/a.jpg');
    expect(urlMedia('/images/productos/ramos/a.jpg')).toBe('/images/productos/ramos/a.jpg');
    expect(urlMedia(null)).toBeUndefined();
  });
});

describe('mapearCarrito', () => {
  it('convierte decimales y calcula cantidad total', () => {
    const c = mapearCarrito({
      carrito: { idCarrito: 1, idCliente: null, estado: 'ACTIVO' },
      items: [
        { idItem: 1, idCarrito: 1, idProducto: 7, cantidad: 2, precioUnitario: 24.9, subtotal: 49.8, codigo: 'R', nombre: 'Ramo', stockDisponible: 5, imagen: 'productos/r.jpg' },
        { idItem: 2, idCarrito: 1, idProducto: 8, cantidad: 1, precioUnitario: 3.5, subtotal: 3.5, codigo: null, nombre: null, stockDisponible: 1, imagen: null },
      ],
      subtotal: 53.3, porcentajeIva: 15, iva: 8, totalSinEnvio: 61.3,
    });
    expect(c.cantidadTotal).toBe(3);
    expect(c.subtotal).toBe(5330);
    expect(c.lineas[0]?.imagen).toBe('/media/productos/r.jpg');
    expect(c.lineas[1]?.nombre).toBe('Producto');
    expect(mapearCarrito(undefined).lineas).toEqual([]);
  });
});

describe('mapearPedido', () => {
  const base: PedidoDetalleVistaDto = {
    pedido: { idPedido: 3, numero: 'FLV-000003', idCliente: 1, idDireccion: 1, fecha: '2026-11-18T10:00:00', subtotal: 20, iva: 3, costoEnvio: 2.5, total: 25.5, estado: 'PAGADO' },
    detalles: [{ idDetalle: 1, idPedido: 3, idProducto: 1, cantidad: 1, precioUnitario: 20, subtotal: 20, codigoProducto: 'X', nombreProducto: 'Ramo' }],
    pagos: [{ idPago: 1, idPedido: 3, metodo: 'TARJETA', monto: 25.5, estado: 'APROBADO', referenciaExterna: 'SIM-Visa-4242-abcdef', rutaComprobante: null, fechaPago: null }],
    entrega: null,
  };
  it('extrae solo marca y ultimos 4 de la tarjeta simulada', () => {
    const p = mapearPedido(base);
    expect(p.pagos[0]?.tarjeta).toEqual({ marca: 'Visa', ultimos4: '4242' });
    expect(p.pagos[0]?.referencia).toBeUndefined();
    expect(p.total).toBe(2550);
  });
  it('no expone la ruta del comprobante, solo si existe', () => {
    const p = mapearPedido({ ...base, pagos: [{ ...base.pagos[0]!, metodo: 'TRANSFERENCIA', referenciaExterna: 'TRF-1', rutaComprobante: 'comprobantes/9.png' }] });
    expect(p.pagos[0]?.tieneComprobante).toBe(true);
    expect(p.pagos[0]?.referencia).toBe('TRF-1');
    expect(JSON.stringify(p)).not.toContain('comprobantes/9.png');
  });
  it('estado desconocido cae a PENDIENTE_PAGO', () => {
    expect(mapearPedido({ ...base, pedido: { ...base.pedido, estado: 'RARO' } }).estado).toBe('PENDIENTE_PAGO');
  });
});

describe('mapearMetodos', () => {
  it('limpia vacios y conserva tarjetas de prueba', () => {
    const m = mapearMetodos({ metodos: [
      { codigo: 'TRANSFERENCIA', nombre: 'T', requiereComprobante: true, datos: { banco: ' ', tipoCuenta: null, numeroCuenta: '123', titular: null, identificacion: null } },
      { codigo: 'TARJETA', nombre: 'C', simulado: true, aviso: 'aviso', tarjetasDePrueba: [{ numero: '4242', resultado: 'ok' }] },
    ] });
    expect(m.transferencia).toEqual({ banco: undefined, tipoCuenta: undefined, numeroCuenta: '123', titular: undefined, identificacion: undefined });
    expect(m.tarjetasDePrueba).toHaveLength(1);
  });
});

describe('slug', () => {
  it('ida y vuelta con tildes y signos', () => {
    const s = slugDe('Ramo de rosas ¡rojas! Ñandú', 12);
    expect(s).toBe('ramo-de-rosas-rojas-nandu-12');
    expect(idDeSlug(s)).toBe(12);
  });
  it('solo id numerico y sin nombre', () => {
    expect(slugDe('***', 5)).toBe('5');
    expect(idDeSlug('5')).toBe(5);
  });
  it('rechaza slugs sin id', () => {
    expect(idDeSlug('ramo-de-rosas')).toBeUndefined();
    expect(idDeSlug('')).toBeUndefined();
  });
});
