// E2E del MODO DEMOSTRACION: sitio SIN FLORAVIA_API_URL. Cuentas, carrito, pedidos y pagos son locales.
// Uso: e2e/correr-demo.sh
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const WEB = process.env.WEB ?? 'http://localhost:3101';
const OUT = process.env.OUT ?? '/tmp/e2e-demo';
fs.mkdirSync(OUT, { recursive: true });

let fallos = 0;
const ok = (cond, msg) => { if (!cond) { fallos++; console.log(`  FALLO  ${msg}`); } else console.log(`  ok     ${msg}`); };
const paso = (t) => console.log(`\n# ${t}`);
const cedula = () => String(Math.floor(1e9 + Math.random() * 9e9));

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: WEB, locale: 'es-EC' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
const badge = () => page.getByRole('button', { name: /Abrir carrito/ });

paso('1. Agregar al carrito sin API');
await page.goto('/catalogo');
const primero = page.locator('a[href^="/producto/"]').first();
const href = await primero.getAttribute('href');
await page.goto(href);
ok(await page.getByText(/conecta la API/i).count() === 0, 'no aparece "conectar a la API"');
await page.getByRole('button', { name: 'Agregar al carrito' }).click();
const dlg = page.getByRole('dialog', { name: 'Agregado al carrito' });
await dlg.waitFor();
ok(await dlg.getByRole('link', { name: 'Ir al carrito' }).isVisible(), 'ofrece "Ir al carrito"');
await dlg.getByRole('link', { name: 'Ir al carrito' }).click();
await page.waitForURL('**/carrito');
await page.getByRole('link', { name: 'Proceder al pago' }).click();

paso('2. Sin sesion se pide cuenta');
await page.waitForURL(/\/cuenta\/ingresar\?volver=%2Fcheckout/);
ok(await page.getByText('Modo demostración').first().isVisible(), 'aviso de modo demostracion');
await page.getByRole('link', { name: 'Crear cuenta' }).last().click();
await page.waitForURL(/\/cuenta\/crear\?volver=%2Fcheckout/);
await page.getByLabel('Nombres').fill('Ana');
await page.getByLabel('Apellidos').fill('Demo');
await page.getByLabel('Cédula').fill(cedula());
await page.getByLabel('Teléfono').fill('0999999999');
const correo = `demo.${Date.now()}@correo.com`;
await page.getByLabel('Correo electrónico').fill(correo);
await page.getByLabel('Contraseña', { exact: true }).fill('Clave1234');
await page.getByLabel('Repite la contraseña').fill('Clave1234');
await page.getByRole('button', { name: 'Crear cuenta' }).click();
await page.waitForURL('**/checkout');
ok(true, 'cuenta creada y vuelve a /checkout con el carrito');
const ses = (await ctx.cookies()).find((c) => c.name === 'fl_sesion');
ok(ses?.httpOnly === true, 'sesion en cookie httpOnly');

paso('3. Tarjeta con datos cualesquiera');
await page.getByRole('heading', { name: 'Tu pedido' }).waitFor();
ok(await page.getByText('Modo demostración').first().isVisible(), 'aviso de demo en checkout');
await page.getByLabel('Sector de Quito').selectOption({ index: 1 });
await page.getByLabel('Calle principal y número').fill('x');
await page.getByRole('radio', { name: /Tarjeta de crédito/ }).check();
await page.getByLabel('Número de tarjeta').fill('1');
await page.getByLabel('Nombre del titular').fill('x');
await page.getByLabel('Mes (MM)').fill('01');
await page.getByLabel('Año (AAAA)').fill('2001');
await page.getByLabel('CVV').fill('1');
await page.screenshot({ path: `${OUT}/01-checkout-tarjeta.png`, fullPage: true });
await page.getByRole('button', { name: 'Confirmar y pagar' }).click();
await page.getByRole('heading', { name: '¡Gracias por tu compra!' }).waitFor();
const conf = await page.locator('main').innerText();
ok(/FLV-000001/.test(conf), 'numero de pedido');
ok(/Tarjeta/.test(conf) && /0001/.test(conf), 'metodo de pago: solo marca y ultimos 4');
ok(!conf.includes('1 1') , 'no expone datos de la tarjeta');
ok(await page.getByRole('link', { name: 'Volver a la tienda' }).isVisible(), 'boton "Volver a la tienda"');
await page.screenshot({ path: `${OUT}/02-confirmacion.png`, fullPage: true });
ok((await badge().getAttribute('aria-label')).includes('0 productos'), 'carrito vacio tras comprar');

paso('4. Transferencia con datos ficticios');
await page.goto(href);
await page.getByRole('button', { name: 'Agregar al carrito' }).click();
await page.getByRole('dialog', { name: 'Agregado al carrito' }).getByRole('link', { name: 'Ir al carrito' }).click();
await page.getByRole('link', { name: 'Proceder al pago' }).click();
await page.waitForURL('**/checkout');
await page.getByLabel('Calle principal y número').waitFor().catch(() => {});
const guardada = page.getByRole('radio', { name: /Usar otra dirección/ });
if (await guardada.count()) await page.locator('input[name="direccion"]').first().check();
await page.getByRole('radio', { name: /Transferencia bancaria/ }).check();
ok(await page.getByText('Datos para transferir').isVisible(), 'muestra datos para transferir');
ok(await page.getByText('Datos ficticios de demostración').isVisible(), 'rotulados como ficticios');
await page.screenshot({ path: `${OUT}/03-transferencia.png`, fullPage: true });
await page.getByRole('button', { name: 'Confirmar y pagar' }).click();
await page.getByRole('heading', { name: /Gracias|Recibimos/ }).waitFor();
const c2 = await page.locator('main').innerText();
ok(/FLV-000002/.test(c2), 'segundo pedido');
ok(/[Tt]ransferencia/.test(c2) && /(verific|revisi)/i.test(c2), 'transferencia queda pendiente de verificacion');
await page.screenshot({ path: `${OUT}/04-transferencia-ok.png`, fullPage: true });

paso('5. Pedidos y volver a iniciar sesion');
await page.goto('/cuenta/pedidos');
ok(await page.getByText('FLV-000001').isVisible() && await page.getByText('FLV-000002').isVisible(), 'lista los dos pedidos');
await page.locator('summary').filter({ hasText: /Hola, Ana/ }).click();
await page.getByRole('button', { name: /Cerrar sesión/ }).click();
await page.waitForURL(/\/$|\/cuenta\/ingresar/);
await page.goto('/cuenta/ingresar');
await page.getByLabel('Correo electrónico').fill(correo);
await page.getByLabel('Contraseña', { exact: true }).fill('Clave1234');
await page.getByRole('button', { name: 'Ingresar' }).click();
await page.waitForURL(`${WEB}/`);
ok((await ctx.cookies()).some((c) => c.name === 'fl_sesion'), 'inicia sesion con la cuenta demo creada antes');
await page.goto('/cuenta/pedidos');
ok(await page.getByText('FLV-000001').isVisible(), 'los pedidos siguen ahi tras cerrar e iniciar sesion');

paso('6. Movil y consola');
const pm = await browser.newContext({ baseURL: WEB, viewport: { width: 390, height: 844 } });
const mp = await pm.newPage();
await mp.goto(href);
await mp.getByRole('button', { name: 'Agregar al carrito' }).click();
await mp.getByRole('dialog', { name: 'Agregado al carrito' }).waitFor();
ok(true, 'agregar al carrito en movil');
await pm.close();
ok(errores.length === 0, `sin errores de consola/pagina${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);

await browser.close();
console.log(`\n${fallos === 0 ? 'TODO OK' : `${fallos} FALLO(S)`}`);
process.exit(fallos === 0 ? 0 : 1);
