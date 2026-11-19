// E2E del flujo de compra contra la API FALSA (e2e/api-falsa.mjs). Uso: ver README ("Pruebas E2E").
import { createRequire } from 'node:module';
// Playwright se resuelve con require para respetar NODE_PATH (instalacion global). Con `npm i -D playwright` tambien funciona.
const { chromium } = createRequire(import.meta.url)('playwright');

const WEB = process.env.WEB ?? 'http://localhost:3100';
const API = process.env.API ?? 'http://localhost:5099';
const OUT = process.env.OUT ?? '/tmp/e2e';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });

let fallos = 0; let total = 0;
const ok = (cond, msg) => { total++; if (!cond) { fallos++; console.log(`  FALLO  ${msg}`); } else console.log(`  ok     ${msg}`); };
const paso = (t) => console.log(`\n# ${t}`);

const browser = await chromium.launch();
const nuevoCtx = (extra = {}) => browser.newContext({ baseURL: WEB, locale: 'es-EC', ...extra });
const correo = `ana.${Date.now()}@correo.com`;
const PASS = 'Clave1234';
const cedula = () => String(Math.floor(1e9 + Math.random() * 9e9)); // la API real rechaza cedulas repetidas: una por corrida

await fetch(`${API}/__test/reset-intentos`);
const ctx = await nuevoCtx({ extraHTTPHeaders: { 'x-forwarded-for': '10.1.1.1' } });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
const badge = () => page.getByRole('button', { name: /Abrir carrito/ });

// ───────────────────────── 1. Visitante agrega al carrito
paso('1. Agregar al carrito (visitante)');
await page.goto('/producto/ramo-de-rosas-rojas-1');
ok(await page.getByText('Pedir por WhatsApp').count() === 0, 'ya no existe "Pedir por WhatsApp"');
await page.getByRole('button', { name: 'Aumentar cantidad' }).click();
await page.getByRole('button', { name: 'Agregar al carrito' }).click();
const dlg = page.getByRole('dialog', { name: 'Agregado al carrito' });
await dlg.waitFor();
ok(await dlg.getByRole('link', { name: 'Ir al carrito' }).isVisible(), 'dialogo ofrece "Ir al carrito"');
ok(await dlg.getByRole('button', { name: 'Seguir comprando' }).isVisible(), 'dialogo ofrece "Seguir comprando"');
await page.screenshot({ path: `${OUT}/01-agregado.png` });
await dlg.getByRole('button', { name: 'Seguir comprando' }).click();
await dlg.waitFor({ state: 'hidden' });
ok((await badge().getAttribute('aria-label')).includes('2 productos'), 'el header muestra 2 productos');

paso('2. El carrito persiste al navegar y al recargar');
await page.goto('/plantas');
await page.getByRole('button', { name: /Abrir carrito, 2/ }).waitFor();
ok(true, 'persiste tras navegar a /plantas');
await page.reload();
await page.getByRole('button', { name: /Abrir carrito, 2/ }).waitFor();
ok(true, 'persiste tras recargar');
const cookies = await ctx.cookies();
const ck = cookies.find((c) => c.name === 'fl_carrito');
ok(ck?.httpOnly === true && /^[0-9a-f]{48}$/.test(ck.value), 'cookie de carrito httpOnly con token de 48 hex generado por el servidor');
ok(!(await page.evaluate(() => document.cookie)).includes('fl_carrito'), 'JS del navegador no puede leer el token del carrito');

// limites de stock y agotado
paso('3. Stock');
await page.goto('/producto/ramo-de-rosas-rosadas-2');
await page.getByRole('button', { name: 'Aumentar cantidad' }).click();
ok(await page.getByRole('button', { name: 'Aumentar cantidad' }).isDisabled(), 'no se puede pedir mas que el stock (2)');
await page.goto('/producto/sansevieria-4');
ok(await page.getByRole('button', { name: 'Agotado por ahora' }).isDisabled(), 'producto agotado: boton deshabilitado');

// agregar una planta, editar en el carrito
await page.goto('/producto/monstera-deliciosa-3');
await page.getByRole('button', { name: 'Agregar al carrito' }).click();
await page.getByRole('dialog').getByRole('link', { name: 'Ir al carrito' }).click();
await page.waitForURL('**/carrito');
paso('4. Pagina de carrito');
await page.getByRole('heading', { name: 'Resumen' }).waitFor();
ok(await page.getByText('Ramo de rosas rojas').first().isVisible(), 'lista el ramo');
ok(await page.getByText('Monstera deliciosa').first().isVisible(), 'lista la planta');
// 2x24.90 + 32.00 = 81.80 ; IVA 15% = 12.27 ; total 94.07
const textoResumen = await page.getByRole('complementary').innerText();
ok(/81,80/.test(textoResumen) && /12,27/.test(textoResumen) && /94,07/.test(textoResumen), `totales correctos (81,80 / 12,27 / 94,07): ${textoResumen.replace(/\s+/g, ' ').slice(0, 120)}`);
await page.getByRole('button', { name: 'Disminuir cantidad de Ramo de rosas rojas' }).click();
await page.getByText(/1 × |Cantidad/).first().waitFor().catch(() => {});
await page.waitForFunction(() => document.body.innerText.includes('56,90') || document.body.innerText.includes('56,9'));
ok(true, 'bajar cantidad actualiza totales desde el servidor');
await page.getByRole('button', { name: 'Quitar Monstera deliciosa del carrito' }).click();
await page.getByText('Monstera deliciosa').waitFor({ state: 'detached' });
ok(true, 'quitar un producto');
await page.getByRole('button', { name: 'Aumentar cantidad de Ramo de rosas rojas' }).click();
await page.screenshot({ path: `${OUT}/02-carrito.png`, fullPage: true });

// ───────────────────────── 5. Proceder al pago sin sesion
paso('5. Proceder al pago sin sesion -> pide cuenta');
await page.getByRole('link', { name: 'Proceder al pago' }).click();
await page.waitForURL(/\/cuenta\/ingresar\?volver=%2Fcheckout/);
ok(await page.getByText('Tu carrito está guardado').isVisible(), 'avisa que el carrito esta guardado');
ok(await page.getByRole('link', { name: 'Crear cuenta' }).first().isVisible(), '"Crear cuenta" visible en la pantalla de ingreso');
await page.screenshot({ path: `${OUT}/03-ingresar.png` });
await page.getByRole('link', { name: 'Crear cuenta' }).last().click();
await page.waitForURL(/\/cuenta\/crear\?volver=%2Fcheckout/);

paso('6. Crear cuenta (validacion y exito)');
await page.getByRole('button', { name: 'Crear cuenta' }).click();
await page.getByText('Tu nombre es obligatorio.').waitFor();
ok(await page.getByText('El correo no es válido.').isVisible() || await page.getByText('Ingresa tu correo.').isVisible(), 'valida campos vacios en el servidor');
await page.getByLabel('Nombres').fill('Ana');
await page.getByLabel('Apellidos').fill('Prueba');
await page.getByLabel('Cédula').fill(cedula());
await page.getByLabel('Teléfono').fill('0999999999');
await page.getByLabel('Correo electrónico').fill(correo);
await page.getByLabel('Contraseña', { exact: true }).fill(PASS);
await page.getByLabel('Repite la contraseña').fill('Otra12345');
await page.getByRole('button', { name: 'Crear cuenta' }).click();
await page.getByText('Las contraseñas no coinciden.').waitFor();
ok(await page.getByLabel('Nombres').inputValue() === 'Ana', 'conserva lo escrito tras un error');
ok((await page.getByLabel('Contraseña', { exact: true }).inputValue()) === '', 'la contrasena no se reinyecta desde el servidor (hay que reescribirla)');
await page.getByLabel('Contraseña', { exact: true }).fill(PASS);
await page.getByLabel('Repite la contraseña').fill(PASS);
await page.getByRole('button', { name: 'Crear cuenta' }).click();
await page.waitForURL('**/checkout');
ok(true, 'tras crear la cuenta vuelve a /checkout');
const sesion = (await ctx.cookies()).find((c) => c.name === 'fl_sesion');
ok(sesion?.httpOnly === true && sesion.sameSite === 'Lax', 'cookie de sesion httpOnly + SameSite=Lax');
ok(!(await page.evaluate(() => document.cookie)).includes('fl_sesion') && !(await page.evaluate(() => JSON.stringify(localStorage))).includes('eyJ'), 'el JWT no es accesible desde JS ni esta en localStorage');
ok((await page.content()).includes('Ramo de rosas rojas'), 'el carrito de visitante se fusiono con la cuenta');
ok(!(await ctx.cookies()).some((c) => c.name === 'fl_carrito'), 'cookie de visitante eliminada tras fusionar');
await page.locator('summary').filter({ hasText: /Hola, Ana/ }).waitFor();

// ───────────────────────── 7. Checkout con tarjeta
paso('7. Portal de pago: items y metodos');
await page.getByRole('heading', { name: 'Tu pedido' }).waitFor();
ok(await page.getByRole('radio', { name: /Transferencia bancaria/ }).isVisible() && await page.getByRole('radio', { name: /Tarjeta de crédito/ }).isVisible(), 'muestra transferencia y tarjeta');
ok(await page.getByText('Datos para transferir').isVisible() && await page.getByText('Banco de PRUEBA').isVisible(), 'datos bancarios vienen de la configuracion de la API');
await page.getByRole('button', { name: 'Confirmar y pagar' }).click();
await page.getByText('Revisa los campos marcados').waitFor();
ok(await page.getByText('Elige tu sector.').isVisible(), 'exige direccion');
await page.getByLabel('Sector de Quito').selectOption({ label: 'Norte · envío $3,00' });
await page.getByLabel('Calle principal y número').fill('Av. Amazonas N10');
await page.getByLabel('Calle secundaria').fill('Naciones Unidas');
await page.getByRole('radio', { name: /Tarjeta de crédito/ }).check();
ok(await page.getByText('Compra simulada').first().isVisible(), 'banner "Compra simulada" visible');
await page.screenshot({ path: `${OUT}/04-checkout-tarjeta.png`, fullPage: true });

await page.getByRole('button', { name: 'Confirmar y pagar' }).click();
await page.getByText('El número de tarjeta no es válido.').waitFor();
ok(true, 'tarjeta vacia: error por campo');

// Tarjeta RECHAZADA
await page.getByLabel('Número de tarjeta').fill('4000000000000002');
await page.getByLabel('Nombre del titular').fill('Ana Prueba');
await page.getByLabel('Mes (MM)').fill('12');
await page.getByLabel('Año (AAAA)').fill('2030');
await page.getByLabel('CVV').fill('123');
await page.getByRole('button', { name: 'Confirmar y pagar' }).click();
await page.waitForURL(/\/pedido\/1\?aviso=rechazada/);
ok(await page.getByText(/Tu tarjeta fue rechazada/).isVisible(), '402 se muestra como resultado esperado (no como error de la app)');
ok(await page.getByRole('heading', { name: 'Completar el pago' }).isVisible(), 'ofrece reintentar el pago sobre el mismo pedido');
ok(await page.getByText('FLV-000001').first().isVisible(), 'muestra el numero de pedido');
await page.screenshot({ path: `${OUT}/05-rechazada.png`, fullPage: true });
ok((await page.getByLabel('Número de tarjeta').inputValue()) === '' && (await page.getByLabel('CVV').inputValue()) === '', 'tras el rechazo el formulario NO conserva numero ni CVV');
ok(!(await ctx.cookies()).some((c) => /4000|4242|cvv/i.test(c.value)) && !(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).match(/4000|4242/), 'ni cookies ni storage contienen datos de tarjeta');

// Reintento aprobado
await page.getByLabel('Número de tarjeta').fill('4242 4242 4242 4242');
await page.getByLabel('Nombre del titular').fill('Ana Prueba');
await page.getByLabel('Mes (MM)').fill('12');
await page.getByLabel('Año (AAAA)').fill('2030');
await page.getByLabel('CVV').fill('123');
await page.getByRole('button', { name: 'Pagar este pedido' }).click();
await page.waitForURL(/\/pedido\/1\?nuevo=1/);
paso('8. Confirmacion');
await page.getByRole('heading', { name: '¡Gracias por tu compra!' }).waitFor();
const conf = await page.locator('main').innerText();
ok(/FLV-000001/.test(conf), 'numero de pedido');
ok(/Ramo de rosas rojas/.test(conf) && /2 × /.test(conf), 'productos comprados');
// 2x24.90 = 49.80 ; iva 7.47 ; envio 3.00 ; total 60.27
ok(/60,27/.test(conf), 'total = 60,27 (49,80 + IVA 7,47 + envio 3,00)');
ok(/Tarjeta \(compra simulada\) · Visa •••• 4242/.test(conf), 'metodo de pago con solo marca y ultimos 4');
ok(/Compra simulada: no se realizó ningún cobro real/.test(conf), 'aclara que no hubo cobro real');
ok(await page.getByRole('link', { name: 'Volver a la tienda' }).isVisible(), 'boton "Volver a la tienda"');
await page.screenshot({ path: `${OUT}/06-confirmacion.png`, fullPage: true });
ok((await badge().getAttribute('aria-label')).includes('0 productos'), 'el carrito queda vacio tras comprar');
await page.getByRole('link', { name: 'Volver a la tienda' }).click();
await page.waitForURL(`${WEB}/`);

// ───────────────────────── 9. Transferencia
paso('9. Transferencia');
await page.goto('/producto/monstera-deliciosa-3');
await page.getByRole('button', { name: 'Agregar al carrito' }).click();
await page.getByRole('dialog').getByRole('link', { name: 'Ir al carrito' }).click();
await page.waitForURL('**/carrito');
await page.getByRole('link', { name: 'Proceder al pago' }).click();
await page.waitForURL('**/checkout');
ok(await page.getByRole('radio', { name: /Usar otra dirección/ }).isVisible(), 'ofrece la direccion guardada de la compra anterior');
await page.getByRole('radio', { name: /Transferencia bancaria/ }).check();
await page.getByRole('button', { name: 'Confirmar y pagar' }).click();
await page.waitForURL(/\/pedido\/2\?nuevo=1/);
await page.getByRole('heading', { name: 'Tu pedido está reservado' }).waitFor();
ok(await page.getByText('Datos para transferir').isVisible(), 'transferencia sin comprobante: el pedido queda reservado y pide subirlo');
// archivo demasiado grande -> error local sin viajar
fs.writeFileSync(`${OUT}/grande.png`, Buffer.alloc(5 * 1024 * 1024 + 10));
await page.locator('input[type=file]').setInputFiles(`${OUT}/grande.png`);
await page.getByRole('button', { name: 'Pagar este pedido' }).click();
await page.getByText('El archivo supera los 5 MB.').first().waitFor();
ok(true, 'rechaza comprobante > 5 MB en el cliente');
fs.writeFileSync(`${OUT}/malo.exe`, 'MZ');
await page.locator('input[type=file]').setInputFiles({ name: 'malo.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') });
await page.getByRole('button', { name: 'Pagar este pedido' }).click();
await page.getByText('Formato no permitido').first().waitFor();
ok(true, 'rechaza formato no permitido');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
await page.locator('input[type=file]').setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: png });
await page.getByLabel('Referencia de la transferencia').fill('TRF-123');
await page.getByRole('button', { name: 'Pagar este pedido' }).click();
await page.getByRole('heading', { name: 'Recibimos tu pedido' }).waitFor();
const t = await page.locator('main').innerText();
ok(/esperando la verificación/.test(t) && /Transferencia bancaria/.test(t) && /Referencia: TRF-123/.test(t), 'pedido por transferencia queda pendiente de verificacion con su referencia');
ok(!/comprobantes\//.test(await page.content()), 'la ruta interna del comprobante no se expone');
await page.screenshot({ path: `${OUT}/07-transferencia.png`, fullPage: true });

// ───────────────────────── 10. Sesion
paso('10. Cerrar sesion, volver a entrar y redirecciones');
await page.locator('summary').filter({ hasText: /Hola, Ana/ }).click();
await page.getByRole('button', { name: 'Cerrar sesión' }).click();
await page.waitForURL(`${WEB}/`);
await page.getByRole('link', { name: 'Ingresar' }).first().waitFor();
ok(!(await ctx.cookies()).some((c) => c.name === 'fl_sesion'), 'logout borra la cookie de sesion');
await page.goto('/pedido/1');
await page.waitForURL(/\/cuenta\/ingresar\?volver=%2Fpedido%2F1/);
ok(true, 'ruta protegida redirige a ingresar con retorno');
await page.getByLabel('Correo electrónico').fill(correo);
await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta1');
await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
await page.getByText('Correo o contraseña incorrectos.').waitFor();
ok(true, 'credenciales malas: mensaje del backend');
await page.getByLabel('Contraseña', { exact: true }).fill(PASS);
await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
await page.waitForURL('**/pedido/1');
ok(true, 'login correcto vuelve a /pedido/1');

// open redirect
const ctxR = await nuevoCtx({ extraHTTPHeaders: { 'x-forwarded-for': '10.1.1.2' } });
const pr = await ctxR.newPage();
await pr.goto('/cuenta/ingresar?volver=https%3A%2F%2Fevil.example%2Fx');
await pr.getByLabel('Correo electrónico').fill(correo);
await pr.getByLabel('Contraseña', { exact: true }).fill(PASS);
await pr.getByRole('button', { name: 'Ingresar', exact: true }).click();
await pr.waitForURL(`${WEB}/`);
ok(new URL(pr.url()).origin === WEB, 'volver=https://evil... se ignora (no hay open redirect)');
// otro cliente no ve pedidos ajenos
await pr.goto('/cuenta/crear');
await pr.waitForURL(`${WEB}/`); // con sesion, /cuenta/crear redirige
const ctxB = await nuevoCtx({ extraHTTPHeaders: { 'x-forwarded-for': '10.1.1.3' } });
const pb = await ctxB.newPage();
await pb.goto('/cuenta/crear');
await pb.getByLabel('Nombres').fill('Beto'); await pb.getByLabel('Apellidos').fill('Otro'); await pb.getByLabel('Cédula').fill(cedula());
await pb.getByLabel('Teléfono').fill('0988888888'); await pb.getByLabel('Correo electrónico').fill(`beto.${Date.now()}@correo.com`);
await pb.getByLabel('Contraseña', { exact: true }).fill(PASS); await pb.getByLabel('Repite la contraseña').fill(PASS);
await pb.getByRole('button', { name: 'Crear cuenta' }).click();
await pb.waitForURL(`${WEB}/`);
const r404 = await pb.goto('/pedido/1');
ok(r404?.status() === 404, 'un cliente no puede ver el pedido de otro (404)');

// ───────────────────────── 11. Admin no entra a la vitrina
paso('11. Un ADMIN no obtiene sesion en la vitrina');
const ctxA = await nuevoCtx({ extraHTTPHeaders: { 'x-forwarded-for': '10.1.1.4' } });
const pa = await ctxA.newPage();
await pa.goto('/cuenta/ingresar');
await pa.getByLabel('Correo electrónico').fill('admin@floravia.local');
await pa.getByLabel('Contraseña', { exact: true }).fill('Admin12345');
await pa.getByRole('button', { name: 'Ingresar', exact: true }).click();
await pa.getByText(/no es de cliente/).waitFor();
ok(!(await ctxA.cookies()).some((c) => c.name === 'fl_sesion'), 'no se guarda el token de administrador');

// ───────────────────────── 12. Rate limit por IP real (X-Forwarded-For)
paso('12. Rate limit: un visitante abusivo no bloquea a los demas');
await fetch(`${API}/__test/reset-intentos`);
const ctxX = await nuevoCtx({ extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.9' } });
const px = await ctxX.newPage();
await px.goto('/cuenta/ingresar');
let bloqueado = false;
for (let i = 0; i < 12 && !bloqueado; i++) {
  await px.getByLabel('Correo electrónico').fill('nadie@correo.com');
  await px.getByLabel('Contraseña', { exact: true }).fill('x');
  await px.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await px.waitForTimeout(150);
  bloqueado = await px.getByText(/Demasiados intentos/).isVisible();
}
ok(bloqueado, 'IP abusiva recibe mensaje de "Demasiados intentos" (429)');
const pq = await (await nuevoCtx({ extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.7' } })).newPage();
await pq.goto('/cuenta/ingresar');
await pq.getByLabel('Correo electrónico').fill(correo); await pq.getByLabel('Contraseña', { exact: true }).fill(PASS);
await pq.getByRole('button', { name: 'Ingresar', exact: true }).click();
await pq.waitForURL(`${WEB}/`);
ok(true, 'otra IP puede ingresar normalmente (la IP real llega a la API)');
const logApi = await (await fetch(`${API}/__test/log`)).json();
ok(logApi.some((l) => l.ruta === '/api/auth/login' && l.xff === '203.0.113.9'), 'la API recibio X-Forwarded-For con la IP del visitante');
ok(!logApi.filter((l) => l.ruta.startsWith('/api/productos') || l.ruta === '/api/categorias').some((l) => l.xff), 'llamadas de catalogo (cacheables) no llevan datos del visitante');

// ───────────────────────── 13. Movil
paso('13. Responsive movil');
const ctxM = await nuevoCtx({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, extraHTTPHeaders: { 'x-forwarded-for': '10.1.1.9' } });
const pm = await ctxM.newPage();
await pm.goto('/producto/ramo-de-rosas-rojas-1');
await pm.getByRole('button', { name: 'Agregar al carrito' }).click();
await pm.getByRole('dialog').getByRole('link', { name: 'Ir al carrito' }).click();
await pm.waitForURL('**/carrito');
await pm.getByRole('heading', { name: 'Resumen' }).waitFor();
const anchoDoc = await pm.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
ok(anchoDoc[0] <= anchoDoc[1], `carrito sin scroll horizontal en 390px (${anchoDoc.join('/')})`);
await pm.screenshot({ path: `${OUT}/08-movil-carrito.png`, fullPage: true });
await pm.goto('/cuenta/crear');
const ancho2 = await pm.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
ok(ancho2[0] <= ancho2[1], 'crear cuenta sin scroll horizontal en 390px');
await pm.screenshot({ path: `${OUT}/09-movil-crear.png`, fullPage: true });

ok(errores.length === 0, `sin errores de consola/JS en el flujo principal ${errores.length ? JSON.stringify(errores.slice(0, 3)) : ''}`);
await browser.close();
console.log(`\n${total - fallos}/${total} verificaciones OK`);
process.exit(fallos ? 1 : 0);
