// API FALSA para pruebas E2E del frontend. NO es el backend real.
// Reproduce el CONTRATO leido de api/Endpoints/*.cs, api/Servicios/Mapeos.cs, application/MD/Tienda/*.cs
// y core/Entidades/*.cs. Si el backend cambia, esto debe actualizarse: pasar E2E contra este fake
// demuestra que el frontend cumple ESE contrato, no que el backend real se comporte igual.
import crypto from 'node:crypto';
import http from 'node:http';

const PUERTO = Number(process.env.PUERTO ?? 5099);
const JWT_KEY = 'clave-de-prueba-solo-para-e2e-0123456789abcdef';
const RESERVA_MS = Number(process.env.RESERVA_SEG ?? 1800) * 1000;
const IVA = 15;

const b64u = (b) => Buffer.from(b).toString('base64url');
const firmar = (p) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const c = b64u(JSON.stringify(p));
  return `${h}.${c}.${crypto.createHmac('sha256', JWT_KEY).update(`${h}.${c}`).digest('base64url')}`;
};
const leerJwt = (t) => {
  const [h, c, f] = (t ?? '').split('.');
  if (!f) return null;
  if (crypto.createHmac('sha256', JWT_KEY).update(`${h}.${c}`).digest('base64url') !== f) return null;
  const p = JSON.parse(Buffer.from(c, 'base64url').toString());
  return p.exp * 1000 > Date.now() ? p : null;
};

// ───────── datos ─────────
const categorias = [
  { idCategoria: 1, idCategoriaPadre: null, nombre: 'Flor', descripcion: 'Arreglos florales y flores de corte' },
  { idCategoria: 2, idCategoriaPadre: null, nombre: 'Planta', descripcion: 'Plantas de interior y exterior' },
  { idCategoria: 3, idCategoriaPadre: null, nombre: 'Semilla', descripcion: 'Semillas para cultivo' },
  { idCategoria: 4, idCategoriaPadre: 2, nombre: 'Bonsai', descripcion: 'Bonsais y arboles en miniatura' },
];
const P = (id, cat, codigo, nombre, descripcion, cuidados, precio, stock, img) => ({
  idProducto: id, idCategoria: cat, codigo, nombre, descripcion, cuidados, precio, stock, reservado: 0, img,
});
const productos = [
  P(1, 1, 'ROSA-001', 'Ramo de rosas rojas', '12 rosas rojas de tallo largo con follaje verde y papel kraft. Ideal para aniversarios.', 'Cambiar el agua cada día', 24.9, 20, 'rosas.png'),
  P(2, 1, 'ROSA-002', 'Ramo de rosas rosadas', 'Rosas rosadas con gypsophila.', 'Cortar los tallos en diagonal', 29.5, 2, 'rosas.png'),
  P(3, 2, 'PLA-001', 'Monstera deliciosa', 'Planta tropical de hojas grandes y perforadas.', 'Riego cada 7 días, luz indirecta', 32, 10, 'planta.png'),
  P(4, 2, 'PLA-002', 'Sansevieria', 'Resistente, ideal para principiantes.', 'Riego cada 15 días', 18.75, 0, 'planta.png'),
  P(5, 4, 'BON-001', 'Bonsai ficus', 'Bonsai de ficus de 5 años.', 'Luz brillante', 85, 5, 'planta.png'),
  P(6, 3, 'SEM-001', 'Semillas de girasol', 'Sobre de 30 semillas.', 'Sembrar a pleno sol', 3.5, 100, null),
  P(7, 3, 'SEM-002', 'Semillas de albahaca', 'Sobre de 100 semillas.', 'Mantener húmedo', 2.8, 100, null),
];
const zonas = [
  { idZona: 1, sector: 'Norte', costoEnvio: 3, activa: true },
  { idZona: 2, sector: 'Centro', costoEnvio: 2.5, activa: true },
  { idZona: 3, sector: 'Sur', costoEnvio: 3.5, activa: true },
  { idZona: 4, sector: 'Valles', costoEnvio: 4.5, activa: true },
];
const usuarios = [{ idUsuario: 1, correo: 'admin@floravia.local', password: 'Admin12345', rol: 'ADMIN', nombre: 'Admin Floravia', idCliente: null }];
const clientes = []; const direcciones = []; const carritos = []; const pedidos = []; const detalles = []; const pagos = []; const reservas = [];
let sec = { usuario: 2, cliente: 1, dir: 1, carrito: 1, item: 1, pedido: 1, pago: 1 };
const log = []; const intentos = new Map();

const dispo = (p) => p.stock - p.reservado;
const money = (n) => Math.round(n * 100) / 100;

// ───────── utilidades http ─────────
class Http extends Error { constructor(status, titulo, detalle) { super(detalle); this.status = status; this.titulo = titulo; this.detalle = detalle; } }
const regla = (m) => new Http(400, 'Regla de negocio', m);
const noEncontrado = (m = 'No encontrado.') => new Http(404, 'No encontrado', m);
const json = (res, status, cuerpo) => { res.writeHead(status, { 'Content-Type': status >= 400 && cuerpo?.title ? 'application/problem+json' : 'application/json' }); res.end(JSON.stringify(cuerpo)); };
const ipDe = (req) => (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress;
const limitarEstricto = (req) => {
  const k = ipDe(req); const ahora = Date.now();
  const arr = (intentos.get(k) ?? []).filter((t) => ahora - t < 60_000);
  arr.push(ahora); intentos.set(k, arr);
  if (arr.length > 10) throw new Http(429, 'Too Many Requests', '');
};
const auth = (req) => { const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? ''); return m ? leerJwt(m[1]) : null; };
const exigirCliente = (req) => { const u = auth(req); if (!u) throw new Http(401, 'Unauthorized', ''); if (u.role !== 'CLIENTE') throw new Http(403, 'Forbidden', ''); return u; };
const leerCuerpo = async (req) => { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c); };
const leerJson = async (req) => { const b = await leerCuerpo(req); try { return b.length ? JSON.parse(b.toString()) : {}; } catch { throw regla('JSON inválido.'); } };

// ───────── vistas ─────────
const publico = (p) => ({ idProducto: p.idProducto, idCategoria: p.idCategoria, codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion, cuidados: p.cuidados, precio: p.precio, stockDisponible: dispo(p), categoriaNombre: categorias.find((c) => c.idCategoria === p.idCategoria).nombre, imagenUrl: p.img ? `/media/productos/${p.img}` : null });
const idsCategoria = (id) => [id, ...categorias.filter((c) => c.idCategoriaPadre === id).map((c) => c.idCategoria)];

function carritoVista(c) {
  const items = c.items.map((i) => { const p = productos.find((x) => x.idProducto === i.idProducto); return { idItem: i.idItem, idCarrito: c.idCarrito, idProducto: i.idProducto, cantidad: i.cantidad, precioUnitario: p.precio, subtotal: money(p.precio * i.cantidad), codigo: p.codigo, nombre: p.nombre, stockDisponible: dispo(p), imagen: p.img ? `productos/${p.img}` : null }; });
  const subtotal = money(items.reduce((a, i) => a + i.subtotal, 0));
  const iva = money(subtotal * IVA / 100);
  return { carrito: { idCarrito: c.idCarrito, idCliente: c.idCliente, estado: c.estado }, items, subtotal, porcentajeIva: IVA, iva, totalSinEnvio: money(subtotal + iva) };
}
const tokenValido = (req) => { const t = req.headers['x-carrito-token']; return typeof t === 'string' && /^[0-9a-f]{48}$/.test(t) ? t : null; };
const buscarCarrito = (req) => {
  const u = auth(req);
  if (u?.idCliente) return carritos.find((c) => c.idCliente === u.idCliente && c.estado === 'ACTIVO');
  const t = tokenValido(req);
  return t ? carritos.find((c) => c.token === t && c.estado === 'ACTIVO') : undefined;
};
const nuevoCarrito = (idCliente, token) => { const c = { idCarrito: sec.carrito++, idCliente, token, estado: 'ACTIVO', items: [] }; carritos.push(c); return c; };

function pedidoVista(ped) {
  const dir = direcciones.find((d) => d.idDireccion === ped.idDireccion);
  const zona = zonas.find((z) => z.idZona === dir.idZona);
  return {
    pedido: { idPedido: ped.idPedido, numero: ped.numero, idCliente: ped.idCliente, idDireccion: ped.idDireccion, fecha: ped.fecha, subtotal: ped.subtotal, iva: ped.iva, costoEnvio: ped.costoEnvio, total: ped.total, estado: ped.estado },
    detalles: detalles.filter((d) => d.idPedido === ped.idPedido),
    pagos: pagos.filter((p) => p.idPedido === ped.idPedido).map(({ ...p }) => p),
    entrega: { idEntrega: ped.idPedido, idPedido: ped.idPedido, direccionEntrega: `${dir.callePrincipal}${dir.calleSecundaria ? ' y ' + dir.calleSecundaria : ''}, ${zona.sector}, ${dir.ciudad}`, fechaProgramada: null, estado: 'PROGRAMADA' },
  };
}
const propio = (idCliente, id) => { const p = pedidos.find((x) => x.idPedido === id && x.idCliente === idCliente); if (!p) throw noEncontrado('Pedido no encontrado.'); return p; };
const reservaVigente = (id) => reservas.some((r) => r.idPedido === id && r.estado === 'ACTIVA' && r.expira > Date.now());

function liberar(ped, estadoReserva) {
  for (const r of reservas.filter((x) => x.idPedido === ped.idPedido && x.estado === 'ACTIVA')) { productos.find((p) => p.idProducto === r.idProducto).reservado -= r.cantidad; r.estado = estadoReserva; }
}
setInterval(() => { // LimpiezaReservasService: cancela PENDIENTE_PAGO / PAGO_FALLIDO con reserva vencida (aunque haya transferencia pendiente)
  for (const ped of pedidos) if (['PENDIENTE_PAGO', 'PAGO_FALLIDO'].includes(ped.estado) && reservas.some((r) => r.idPedido === ped.idPedido && r.estado === 'ACTIVA' && r.expira < Date.now())) { liberar(ped, 'EXPIRADA'); ped.estado = 'CANCELADO'; }
}, 1000).unref();

const luhn = (n) => { let s = 0, d = false; for (let i = n.length - 1; i >= 0; i--) { let x = Number(n[i]); if (d) { x *= 2; if (x > 9) x -= 9; } s += x; d = !d; } return s % 10 === 0; };

const metodosPago = () => ({ metodos: [
  { codigo: 'TRANSFERENCIA', nombre: 'Transferencia bancaria', requiereComprobante: true, datos: { banco: process.env.PAGO_BANCO || null, tipoCuenta: process.env.PAGO_TIPO || null, numeroCuenta: process.env.PAGO_NUM || null, titular: process.env.PAGO_TITULAR || null, identificacion: process.env.PAGO_ID || null } },
  { codigo: 'TARJETA', nombre: 'Tarjeta de crédito / débito', simulado: true, aviso: 'Pasarela de práctica: no se realiza ningún cobro y los datos de la tarjeta no se guardan.', tarjetasDePrueba: [{ numero: '4242 4242 4242 4242', resultado: 'aprobada' }, { numero: '4000000000000002', resultado: 'rechazada' }, { numero: '4000000000009995', resultado: 'fondos insuficientes' }] },
] });

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// ───────── router ─────────
async function manejar(req, res) {
  const url = new URL(req.url, 'http://x');
  const ruta = url.pathname; const m = req.method;
  log.push({ m, ruta, xff: req.headers['x-forwarded-for'] ?? null, auth: Boolean(req.headers.authorization), carrito: Boolean(req.headers['x-carrito-token']) });
  let g;

  if (ruta === '/__test/log') return json(res, 200, log);
  if (ruta === '/__test/reset-intentos') { intentos.clear(); return json(res, 200, {}); }
  if (ruta.startsWith('/media/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (ruta === '/health') return json(res, 200, { ok: true });

  if (m === 'GET' && ruta === '/api/categorias') return json(res, 200, categorias);
  if (m === 'GET' && ruta === '/api/zonas-entrega') return json(res, 200, zonas);
  if (m === 'GET' && ruta === '/api/pagos/metodos') return json(res, 200, metodosPago());

  if (m === 'GET' && ruta === '/api/productos') {
    const q = url.searchParams; let lista = productos.slice();
    if (q.get('idCategoria')) lista = lista.filter((p) => idsCategoria(Number(q.get('idCategoria'))).includes(p.idCategoria));
    const t = q.get('texto')?.toLowerCase(); if (t) lista = lista.filter((p) => `${p.nombre} ${p.descripcion}`.toLowerCase().includes(t));
    const o = q.get('orden'); if (o === 'precio_asc') lista.sort((a, b) => a.precio - b.precio); else if (o === 'precio_desc') lista.sort((a, b) => b.precio - a.precio); else if (o === 'nombre') lista.sort((a, b) => a.nombre.localeCompare(b.nombre)); else lista.sort((a, b) => b.idProducto - a.idProducto);
    const tam = Math.min(50, Math.max(1, Number(q.get('tamanoPagina') ?? 12))); const pag = Math.max(1, Number(q.get('pagina') ?? 1));
    return json(res, 200, { items: lista.slice((pag - 1) * tam, pag * tam).map(publico), total: lista.length, pagina: pag, tamanoPagina: tam, totalPaginas: Math.ceil(lista.length / tam) });
  }
  if (m === 'GET' && (g = /^\/api\/productos\/(\d+)$/.exec(ruta))) {
    const p = productos.find((x) => x.idProducto === Number(g[1])); if (!p) return json(res, 404, { status: 404, title: 'Not Found' });
    return json(res, 200, { producto: publico(p), imagenes: p.img ? [{ idImagen: 1, url: `/media/productos/${p.img}`, esPrincipal: true, orden: 0 }] : [], colores: [] });
  }
  if (m === 'GET' && (g = /^\/api\/productos\/(\d+)\/relacionados$/.exec(ruta))) {
    const p = productos.find((x) => x.idProducto === Number(g[1])); if (!p) return json(res, 200, []);
    return json(res, 200, productos.filter((x) => x.idCategoria === p.idCategoria && x.idProducto !== p.idProducto).slice(0, Number(url.searchParams.get('cantidad') ?? 4)).map(publico));
  }

  // ── auth
  if (m === 'POST' && ruta === '/api/auth/registro') {
    limitarEstricto(req); const d = await leerJson(req);
    const correo = String(d.correo ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw regla('El correo no es válido.');
    if (!/^[0-9]{10}$/.test(String(d.cedula ?? ''))) throw regla('La cédula debe tener 10 dígitos.');
    if (String(d.password ?? '').length < 8 || !/[a-zA-Z]/.test(d.password) || !/\d/.test(d.password)) throw regla('La contraseña debe tener al menos 8 caracteres, con letras y números.');
    if (usuarios.some((u) => u.correo === correo)) throw regla('Ya existe una cuenta con ese correo.');
    if (clientes.some((c) => c.cedula === d.cedula)) throw regla('Ya existe un cliente con esa cédula.');
    const cli = { idCliente: sec.cliente++, idUsuario: sec.usuario, cedula: d.cedula, nombres: d.nombres, apellidos: d.apellidos, telefono: d.telefono };
    const u = { idUsuario: sec.usuario++, correo, password: d.password, rol: 'CLIENTE', nombre: `${d.nombres} ${d.apellidos}`, idCliente: cli.idCliente };
    clientes.push(cli); usuarios.push(u);
    const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
    return json(res, 201, { token: firmar({ sub: String(u.idUsuario), email: correo, role: 'CLIENTE', idCliente: u.idCliente, exp }), expiraEn: new Date(exp * 1000).toISOString(), rol: 'CLIENTE', nombre: u.nombre });
  }
  if (m === 'POST' && ruta === '/api/auth/login') {
    limitarEstricto(req); const d = await leerJson(req);
    const u = usuarios.find((x) => x.correo === String(d.correo ?? '').trim().toLowerCase());
    if (!u || u.password !== d.password) return json(res, 401, { status: 401, title: 'No se pudo iniciar sesión', detail: 'Correo o contraseña incorrectos.' });
    const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
    return json(res, 200, { token: firmar({ sub: String(u.idUsuario), email: u.correo, role: u.rol, ...(u.idCliente ? { idCliente: u.idCliente } : {}), exp }), expiraEn: new Date(exp * 1000).toISOString(), rol: u.rol, nombre: u.nombre });
  }

  // ── carrito
  if (ruta === '/api/carrito' && m === 'GET') { const c = buscarCarrito(req); return json(res, 200, c ? carritoVista(c) : { carrito: { idCarrito: 0, idCliente: null, estado: 'ACTIVO' }, items: [], subtotal: 0, porcentajeIva: IVA, iva: 0, totalSinEnvio: 0 }); }
  if (ruta === '/api/carrito/items' && m === 'POST') {
    const d = await leerJson(req);
    if (!Number.isInteger(d.cantidad) || d.cantidad < 1 || d.cantidad > 99) throw regla('La cantidad debe estar entre 1 y 99.');
    let tokenNuevo = null; let c = buscarCarrito(req); const u = auth(req);
    if (!c) { if (u?.idCliente) c = nuevoCarrito(u.idCliente, null); else { tokenNuevo = crypto.randomBytes(24).toString('hex'); c = nuevoCarrito(null, tokenNuevo); } }
    const p = productos.find((x) => x.idProducto === d.idProducto); if (!p) throw noEncontrado('Producto no encontrado.');
    const ya = c.items.find((i) => i.idProducto === p.idProducto); const nueva = (ya?.cantidad ?? 0) + d.cantidad;
    if (nueva > dispo(p)) throw regla(`No hay stock suficiente de «${p.nombre}». Disponible: ${dispo(p)}.`);
    if (ya) ya.cantidad = nueva; else c.items.push({ idItem: sec.item++, idProducto: p.idProducto, cantidad: d.cantidad });
    return json(res, 200, { token: tokenNuevo, carrito: carritoVista(c) });
  }
  if ((g = /^\/api\/carrito\/items\/(\d+)$/.exec(ruta)) && (m === 'PUT' || m === 'DELETE')) {
    const c = buscarCarrito(req); if (!c) throw noEncontrado('Aún no tienes un carrito.');
    const id = Number(g[1]);
    if (m === 'DELETE') c.items = c.items.filter((i) => i.idProducto !== id);
    else { const d = await leerJson(req); const p = productos.find((x) => x.idProducto === id); if (d.cantidad > 99) throw regla('La cantidad máxima por producto es 99.'); if (d.cantidad > dispo(p)) throw regla(`No hay stock suficiente de «${p.nombre}». Disponible: ${dispo(p)}.`); if (d.cantidad <= 0) c.items = c.items.filter((i) => i.idProducto !== id); else { const i = c.items.find((x) => x.idProducto === id); if (!i) throw noEncontrado('Ese producto no está en tu carrito.'); i.cantidad = d.cantidad; } }
    return json(res, 200, carritoVista(c));
  }
  if (ruta === '/api/carrito/fusionar' && m === 'POST') {
    const u = exigirCliente(req); const t = tokenValido(req);
    let mio = carritos.find((c) => c.idCliente === u.idCliente && c.estado === 'ACTIVO');
    const anon = t ? carritos.find((c) => c.token === t && c.estado === 'ACTIVO') : null;
    if (!mio) mio = nuevoCarrito(u.idCliente, null);
    if (anon) { for (const i of anon.items) { const ya = mio.items.find((x) => x.idProducto === i.idProducto); const p = productos.find((x) => x.idProducto === i.idProducto); const tot = Math.min(dispo(p), (ya?.cantidad ?? 0) + i.cantidad); if (ya) ya.cantidad = tot; else mio.items.push({ idItem: sec.item++, idProducto: i.idProducto, cantidad: tot }); } anon.estado = 'ABANDONADO'; }
    return json(res, 200, carritoVista(mio));
  }

  // ── cuenta
  if (ruta === '/api/cuenta/perfil' && m === 'GET') { const u = exigirCliente(req); const c = clientes.find((x) => x.idCliente === u.idCliente); return json(res, 200, { ...c, correo: u.email }); }
  if (ruta === '/api/cuenta/direcciones' && m === 'GET') { const u = exigirCliente(req); return json(res, 200, direcciones.filter((d) => d.idCliente === u.idCliente && d.activa).map((d) => ({ ...d, sector: zonas.find((z) => z.idZona === d.idZona).sector, costoEnvio: zonas.find((z) => z.idZona === d.idZona).costoEnvio }))); }
  if (ruta === '/api/cuenta/direcciones' && m === 'POST') {
    const u = exigirCliente(req); const d = await leerJson(req);
    if (!zonas.some((z) => z.idZona === d.idZona)) throw regla('La zona de entrega no existe.');
    if (!String(d.callePrincipal ?? '').trim()) throw regla('La calle principal es obligatoria.');
    if (d.esPrincipal) direcciones.filter((x) => x.idCliente === u.idCliente).forEach((x) => { x.esPrincipal = false; });
    const nueva = { idDireccion: sec.dir++, idCliente: u.idCliente, idZona: d.idZona, callePrincipal: d.callePrincipal.trim(), calleSecundaria: d.calleSecundaria || null, referencia: d.referencia || null, ciudad: d.ciudad || 'Quito', esPrincipal: Boolean(d.esPrincipal), activa: true };
    direcciones.push(nueva); return json(res, 201, nueva);
  }

  // ── pedidos
  if (ruta === '/api/pedidos' && m === 'POST') {
    const u = exigirCliente(req); const d = await leerJson(req);
    const c = carritos.find((x) => x.idCliente === u.idCliente && x.estado === 'ACTIVO');
    if (!c || c.items.length === 0) throw regla('Tu carrito está vacío.');
    const dir = direcciones.find((x) => x.idDireccion === d.idDireccion && x.idCliente === u.idCliente && x.activa); if (!dir) throw regla('La dirección no es válida.');
    for (const i of c.items) { const p = productos.find((x) => x.idProducto === i.idProducto); if (i.cantidad > dispo(p)) throw regla(`No hay stock suficiente de «${p.nombre}».`); }
    const v = carritoVista(c); const envio = zonas.find((z) => z.idZona === dir.idZona).costoEnvio;
    const ped = { idPedido: sec.pedido, numero: `FLV-${String(sec.pedido++).padStart(6, '0')}`, idCliente: u.idCliente, idDireccion: dir.idDireccion, fecha: new Date().toISOString().replace('Z', ''), subtotal: v.subtotal, iva: v.iva, costoEnvio: envio, total: money(v.subtotal + v.iva + envio), estado: 'PENDIENTE_PAGO' };
    pedidos.push(ped);
    for (const i of v.items) { detalles.push({ idDetalle: detalles.length + 1, idPedido: ped.idPedido, idProducto: i.idProducto, cantidad: i.cantidad, precioUnitario: i.precioUnitario, subtotal: i.subtotal, codigoProducto: i.codigo, nombreProducto: i.nombre }); productos.find((p) => p.idProducto === i.idProducto).reservado += i.cantidad; reservas.push({ idPedido: ped.idPedido, idProducto: i.idProducto, cantidad: i.cantidad, expira: Date.now() + RESERVA_MS, estado: 'ACTIVA' }); }
    c.estado = 'CONVERTIDO';
    return json(res, 201, ped);
  }
  if (ruta === '/api/pedidos' && m === 'GET') { const u = exigirCliente(req); const l = pedidos.filter((p) => p.idCliente === u.idCliente).reverse(); return json(res, 200, { items: l, total: l.length, pagina: 1, tamanoPagina: 10, totalPaginas: 1 }); }
  if ((g = /^\/api\/pedidos\/(\d+)$/.exec(ruta)) && m === 'GET') { const u = exigirCliente(req); return json(res, 200, pedidoVista(propio(u.idCliente, Number(g[1])))); }
  if ((g = /^\/api\/pedidos\/(\d+)\/cancelar$/.exec(ruta)) && m === 'POST') { const u = exigirCliente(req); const p = propio(u.idCliente, Number(g[1])); if (!['PENDIENTE_PAGO', 'PAGO_FALLIDO'].includes(p.estado)) throw regla('Este pedido ya no se puede cancelar.'); liberar(p, 'LIBERADA'); p.estado = 'CANCELADO'; return json(res, 200, pedidoVista(p)); }

  if ((g = /^\/api\/pedidos\/(\d+)\/pagos\/tarjeta$/.exec(ruta)) && m === 'POST') {
    const u = exigirCliente(req); limitarEstricto(req); const d = await leerJson(req); const ped = propio(u.idCliente, Number(g[1]));
    const num = String(d.numero ?? '').replace(/[\s-]/g, '');
    if (num.length < 13 || num.length > 19 || !/^\d+$/.test(num) || !luhn(num)) throw regla('El número de tarjeta no es válido.');
    if (!(d.mesVencimiento >= 1 && d.mesVencimiento <= 12)) throw regla('El mes de vencimiento no es válido.');
    const anio = d.anioVencimiento < 100 ? 2000 + d.anioVencimiento : d.anioVencimiento; const hoy = new Date();
    if (anio < hoy.getFullYear() || (anio === hoy.getFullYear() && d.mesVencimiento < hoy.getMonth() + 1)) throw regla('La tarjeta está vencida.');
    const marca = num.startsWith('4') ? 'Visa' : /^5[1-5]/.test(num) ? 'Mastercard' : /^3[47]/.test(num) ? 'Amex' : 'Tarjeta';
    if (!/^\d+$/.test(String(d.cvv ?? '')) || String(d.cvv).length !== (marca === 'Amex' ? 4 : 3)) throw regla('El CVV no es válido.');
    if (!['PENDIENTE_PAGO', 'PAGO_FALLIDO'].includes(ped.estado)) throw regla('Este pedido no admite pagos en su estado actual.');
    if (!reservaVigente(ped.idPedido)) throw regla('El tiempo de reserva del pedido venció. Realiza un nuevo pedido.');
    if (pagos.some((p) => p.idPedido === ped.idPedido && p.estado === 'PENDIENTE')) throw regla('Ya tienes un pago en revisión para este pedido.');
    const ult = num.slice(-4);
    const rechazo = num === '4000000000000002' ? 'Tarjeta rechazada por el emisor (simulación).' : num === '4000000000009995' ? 'Fondos insuficientes (simulación).' : null;
    const pago = { idPago: sec.pago++, idPedido: ped.idPedido, metodo: 'TARJETA', monto: ped.total, estado: rechazo ? 'RECHAZADO' : 'APROBADO', referenciaExterna: `SIM-${marca}-${ult}-${crypto.randomUUID().replace(/-/g, '')}`, rutaComprobante: null, fechaPago: rechazo ? null : new Date().toISOString() };
    pagos.push(pago);
    if (rechazo) ped.estado = 'PAGO_FALLIDO'; else { ped.estado = 'PAGADO'; for (const r of reservas.filter((x) => x.idPedido === ped.idPedido && x.estado === 'ACTIVA')) { const p = productos.find((x) => x.idProducto === r.idProducto); p.reservado -= r.cantidad; p.stock -= r.cantidad; r.estado = 'CONFIRMADA'; } }
    return json(res, rechazo ? 402 : 200, { aprobado: !rechazo, mensaje: rechazo ?? 'Pago aprobado (simulación).', marca, ultimos4: ult, pedido: pedidoVista(ped) });
  }
  if ((g = /^\/api\/pedidos\/(\d+)\/pagos\/transferencia$/.exec(ruta)) && m === 'POST') {
    const u = exigirCliente(req); const ped = propio(u.idCliente, Number(g[1]));
    if (!(req.headers['content-type'] ?? '').startsWith('multipart/form-data')) throw regla('Envía el comprobante como multipart/form-data (campo «comprobante»).');
    const body = await leerCuerpo(req);
    const fd = await new Response(body, { headers: { 'content-type': req.headers['content-type'] } }).formData();
    const f = fd.get('comprobante');
    if (!(f instanceof File) || f.size === 0) throw regla('Adjunta el comprobante de tu transferencia.');
    if (f.size > 5 * 1024 * 1024) throw regla('El comprobante no puede superar los 5 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(f.type)) throw regla('Formato de comprobante no permitido.');
    if (!['PENDIENTE_PAGO', 'PAGO_FALLIDO'].includes(ped.estado)) throw regla('Este pedido no admite pagos en su estado actual.');
    if (!reservaVigente(ped.idPedido)) throw regla('El tiempo de reserva del pedido venció. Realiza un nuevo pedido.');
    if (pagos.some((p) => p.idPedido === ped.idPedido && p.estado === 'PENDIENTE')) throw regla('Ya tienes un pago en revisión para este pedido.');
    pagos.push({ idPago: sec.pago++, idPedido: ped.idPedido, metodo: 'TRANSFERENCIA', monto: ped.total, estado: 'PENDIENTE', referenciaExterna: String(fd.get('referencia') ?? '') || null, rutaComprobante: `comprobantes/${ped.idPedido}-${Date.now()}.png`, fechaPago: null });
    if (ped.estado === 'PAGO_FALLIDO') ped.estado = 'PENDIENTE_PAGO';
    return json(res, 201, pedidoVista(ped));
  }

  return json(res, 404, { status: 404, title: 'Not Found', detail: 'Ruta no encontrada.' });
}

http.createServer((req, res) => {
  manejar(req, res).catch((e) => {
    if (e instanceof Http) return json(res, e.status, { status: e.status, title: e.titulo, detail: e.detalle, traceId: 'fake' });
    console.error(e); json(res, 500, { status: 500, title: 'Error', detail: 'Error interno.' });
  });
}).listen(PUERTO, () => console.log(`API falsa en http://localhost:${PUERTO}`));
