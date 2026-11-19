# Floravia Web (Next.js)

Vitrina y flujo de compra de Floravia. Next.js 16 (App Router) + React 19 + TypeScript estricto + Tailwind v4.
Vive en la raiz de este repositorio (`src/`, `package.json`, `next.config.mjs`) junto al backend .NET.

## Fuente de datos obligatoria

`FLORAVIA_API_URL` es obligatoria. Catálogo, cuentas, carrito, pedidos y pagos siempre pasan por la
API .NET y PostgreSQL. Si falta la variable, la aplicación falla explícitamente y no usa datos mock.

```bash
printf 'FLORAVIA_API_URL=http://localhost:8081\nFLORAVIA_COOKIE_SECURE=false\n' > .env.local
npm install
npm run dev                         # http://localhost:3000
npm run verify                      # typecheck + vitest + build
```

## Flujo de compra

1. **Agregar al carrito** en la ficha del producto (cantidad limitada por el stock real). Aparece "Ir al carrito / Seguir comprando".
2. El carrito vive **en el servidor** (API). Visitante: token de 48 hex que genera la API, guardado en cookie `httpOnly`. Cliente: ligado a su cuenta.
3. **Proceder al pago** (`/carrito` o el cajon lateral) -> `/checkout`. Sin sesion se redirige a `/cuenta/ingresar?volver=/checkout` (con enlace a **Crear cuenta**). Al autenticarse el carrito de visitante se **fusiona** con el del cliente (`POST /api/carrito/fusionar`) y se vuelve al checkout.
4. **Portal de pago** (`/checkout`): productos, direccion (guardadas o nueva con sector de Quito), totales (subtotal, IVA, envio, total) y metodo: **transferencia** (datos bancarios desde la configuracion de la API; comprobante opcional en este paso) o **tarjeta SIMULADA**.
5. **Confirmacion** (`/pedido/[id]`): numero de pedido, productos, total, metodo de pago y "Volver a la tienda". Si el pago falla o falta el comprobante, la misma pantalla permite **reintentar** sin rehacer el carrito.

## Cuenta: `usuario` y `cliente`

El correo vive **solo en `usuario`**. `cliente.id_usuario` es una FK `UNIQUE` hacia `usuario` (relacion 1:1), asi que duplicar el correo en `cliente` crearia dos fuentes de verdad que pueden divergir. No hay cambio de esquema. El registro (`POST /api/auth/registro`) crea ambas filas en una transaccion y la API devuelve el JWT.

## Arquitectura (BFF)

El navegador **nunca habla con la API**. Next actua de BFF:

```
src/
  domain/            Tipos y reglas puras (dinero en centavos, carrito, pedido, validaciones, tarjeta, redireccion segura)
  infrastructure/
    api/             Cliente HTTP (solo servidor), DTO exactos de la API, mapeos, sesion por cookies, adaptador de catalogo
    mocks/           Fixtures conservados únicamente para pruebas unitarias
  app/acciones/      Server Actions: cuenta, carrito, checkout (validan TODO en servidor)
  app/api/tienda/estado   Sesion + carrito para el header (no-store)
  features/tienda/   UI de carrito, cuenta, checkout, pedido
```

Cookies (`httpOnly`, `SameSite=Lax`, `Secure` en produccion): `fl_sesion` (JWT 8 h), `fl_nombre`, `fl_carrito` (visitante, 30 dias). El JWT nunca llega a JavaScript del navegador ni a `localStorage`.

## Seguridad: decisiones concretas

- **Tarjeta simulada**: banner permanente "Compra simulada"; numero y CVV viven solo en el formulario y en el POST a la accion; **no se guardan, registran ni devuelven** (tras un rechazo el formulario queda vacio). La confirmacion muestra solo marca y ultimos 4 (la API guarda `SIM-{marca}-{ultimos4}-{guid}`).
- **Open redirect**: `volver` solo admite rutas internas (`rutaInternaSegura`, con pruebas contra `//`, `\`, `%2F`, esquemas, control chars).
- **ADMIN**: si el login devuelve rol ADMIN, la vitrina **no guarda su token**.
- **CSRF**: Server Actions comparan `Origin` con `Host`. Detras de un proxy inverso configura `experimental.serverActions.allowedOrigins`.
- **Rate limit por IP**: Next reenvia `X-Forwarded-For` en llamadas personales. El proxy que este delante de Next debe **sobrescribir** esa cabecera; en la API `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` confia en cualquier proxy, asi que **la API no debe ser alcanzable desde internet** (en `docker-compose.yml` solo escucha en `127.0.0.1`).
- **Montos**: la UI nunca calcula precios finales; muestra lo que devuelve la API. Estimado de total en checkout = `totalSinEnvio` + envio de la zona; el pedido creado es la cifra oficial.
- **Comprobantes**: se valida tipo y tamano (5 MB) en cliente y servidor; la ruta interna del archivo no se expone.

## Brechas del BACKEND que afectan a este frontend

1. **Sin atributos de producto** (cuidado, luz, ocasion, mes de siembra...), **sin "destacado/mas vendido"** y **sin slug ni "linea"**. El adaptador deduce la linea por la categoria raiz (`Flor`->ramos, `Planta`/`Bonsai`->plantas, `Semilla`->semillas) y el slug como `nombre-{id}`. Se ocultan filtros y secciones que no pueden funcionar y "Mas vendidos" pasa a "Novedades". Un producto en una categoria raiz con otro nombre se **omite** (y se avisa en el log del servidor).
2. **Sin fecha/hora de entrega ni nota de tarjeta** en el pedido: el checkout no las pide (no hay donde guardarlas).
3. **Sin `Idempotency-Key`** al crear pedidos. Mitigacion actual: crear el pedido convierte el carrito, asi que un doble clic recibe "tu carrito esta vacio".
4. **JWT de 8 h sin refresh token**: al vencer, el usuario vuelve a iniciar sesion (el carrito se conserva por cuenta).
5. **Cedula**: el backend solo exige 10 digitos; el frontend replica eso (no exige digito verificador) para no rechazar datos que el backend acepta.

## Fotos reales

El frontend muestra las fotos que cargue el administrador (`POST /api/admin/productos/{id}/imagenes`) servidas desde `/media/...` (rewrite a la API). Un producto de la API **sin foto** muestra un marcador neutro "Foto proximamente". Las fotos deben ser propias o contar con licencia.

## Pruebas

- `npm test`: dominio, validaciones, tarjeta, `volver`, JWT, mapeos y slug, buscador, menu, boton.
- `motor.test.ts` conserva cobertura del motor histórico, que ya no forma parte del runtime desplegable.
- `e2e/`: **E2E contra una API FALSA** (`e2e/api-falsa.mjs`) escrita a partir del contrato leido en el codigo C#. Verifica que **el frontend cumple ese contrato**, no que el backend real se comporte igual. Para correrlo:

```bash
FLORAVIA_API_URL=http://localhost:5099 FLORAVIA_COOKIE_SECURE=false npm run build
FLORAVIA_API_URL=http://localhost:5099 FLORAVIA_COOKIE_SECURE=false npx next start -p 3100 &
npm i -g playwright && npx playwright install chromium   # una vez
e2e/correr.sh
```

**Antes de entregar al cliente**: repetir el flujo completo contra la API real (docker compose up) y con datos bancarios reales en `.env` (`PAGO_*`).
