# 🌿 Floravia

Plataforma e-commerce de plantas, flores, bonsáis y semillas. Este repositorio contiene el **backend**: una API REST en C# / ASP.NET Core sobre PostgreSQL, lista para desplegarse con Docker.

## 🧱 Arquitectura

```
core/            Entidades, constantes y reglas compartidas (sin dependencias)
infrastructure/  Acceso a datos (Dapper + Npgsql) y almacenamiento de archivos
application/     TODA la lógica de negocio (carrito, pedidos, stock, pagos, inventario...)
api/             Capa HTTP: traduce peticiones ⇄ casos de uso. Sin lógica de negocio ni SQL.
tests/           Pruebas de negocio y de integración de la API (contra PostgreSQL real)
database/        Esquema SQL con restricciones, índices y datos semilla
```

Regla de oro: **la API nunca habla con la base de datos**; solo llama a `FloraviaServicios` (capa `application`). Así cada regla vive en un único sitio y está cubierta por pruebas.

## 🚀 Puesta en marcha

### Desarrollo (API con `dotnet run`, base de datos en Docker)

```bash
cp .env.example .env                 # y completa POSTGRES_PASSWORD
docker compose up -d db              # PostgreSQL con el esquema ya aplicado

cd api
dotnet user-secrets set "ConnectionStrings:Default" "Host=localhost;Port=5432;Database=floravia;Username=floravia_user;Password=TU_CLAVE"
dotnet user-secrets set "Admin:Correo" "admin@floravia.local"      # primer administrador
dotnet user-secrets set "Admin:Password" "Admin12345"
dotnet run                           # http://localhost:5071  (prueba con api/Api.http)
```

### Todo con Docker (base de datos + API)

```bash
cp .env.example .env                 # completa POSTGRES_PASSWORD, JWT_KEY (openssl rand -base64 48) y ADMIN_*
docker compose up -d --build         # API en http://127.0.0.1:8081
```

En producción pon un proxy inverso con HTTPS (Caddy, nginx, Traefik) delante de la API y activa `ASPNETCORE_FORWARDEDHEADERS_ENABLED` en `docker-compose.yml`.

## ⚙️ Configuración

Se define con variables de entorno (en Docker) o `user-secrets` (en desarrollo). `Seccion__Clave` en variables = `Seccion:Clave` en JSON.

| Clave | Para qué | Por defecto |
|---|---|---|
| `ConnectionStrings:Default` | Conexión a PostgreSQL (**obligatoria**) | — |
| `Jwt:Key` | Clave de firma de sesiones, ≥ 32 caracteres (**obligatoria**; en producción no puede ser la de desarrollo) | solo en Development |
| `Jwt:HorasValidez` | Duración de la sesión | 8 |
| `Cors:Origins` | Orígenes permitidos del frontend | `http://localhost:5173` |
| `Frontend:Url` | URL base de los enlaces de los correos | `http://localhost:5173` |
| `Admin:Correo` / `Admin:Password` | Crean el primer administrador si no existe ninguno | — |
| `Reservas:IntervaloSegundos` | Cada cuánto se liberan reservas vencidas (0 = desactivado) | 60 |
| `RateLimit:PorMinuto` / `EstrictoPorMinuto` | Peticiones por IP: general / login, registro, recuperar y tarjeta | 300 / 10 |
| `Pagos:Transferencia:*` | Datos bancarios que ve el cliente al elegir transferencia | — |
| `Smtp:Host`, `Puerto`, `Usuario`, `Password`, `Remitente` | Correo real. Sin `Host`, el correo solo se escribe en el log (en Development) | — |
| `Almacen:RutaImagenes` / `RutaComprobantes` | Dónde se guardan los archivos subidos | `./almacen/...` |
| `Seguridad:ForzarHttps` | HSTS + redirección a HTTPS (fuera de Development) | false |
| `OpenApi:Habilitado` | Publica `/openapi/v1.json` fuera de Development | false |

## 💳 Pagos

El cliente elige entre dos métodos (`GET /api/pagos/metodos` devuelve los datos para pintar la pantalla):

- **Transferencia:** sube el comprobante (JPG, PNG, WEBP o PDF, máx. 5 MB, validado por su contenido real). El pago queda `PENDIENTE` hasta que un administrador lo **aprueba** o **rechaza**. Los comprobantes son **privados**: solo los descarga el cliente dueño del pedido o un admin.
- **Tarjeta de crédito/débito (SIMULADA):** valida los datos como un formulario real (algoritmo de Luhn, vencimiento, CVV según la marca) pero **no cobra ni se conecta a ningún banco**. El número y el CVV **no se guardan**: solo la marca y los últimos 4 dígitos dentro de la referencia del pago.

| Tarjeta de prueba | Resultado |
|---|---|
| `4242 4242 4242 4242` (cualquier número válido) | Aprobada → pedido `PAGADO` (HTTP 200) |
| `4000 0000 0000 0002` | Rechazada → pedido `PAGO_FALLIDO` (HTTP 402); se puede reintentar |
| `4000 0000 0000 9995` | Fondos insuficientes (HTTP 402) |

Flujo de un pedido: `PENDIENTE_PAGO → PAGADO → EN_PREPARACION → EN_CAMINO → ENTREGADO` (o `CANCELADO` / `PAGO_FALLIDO`). Al crear el pedido se **reserva** el stock; si no se paga a tiempo (30 min por defecto) una tarea automática cancela el pedido y devuelve las unidades.

## 🔌 Endpoints

Errores siempre en formato `application/problem+json`: `{ status, title, detail, traceId }`.

**Públicos**

| Método y ruta | Descripción |
|---|---|
| `GET /health`, `/health/ready` | Estado de la app / de la app + base de datos |
| `GET /api/categorias`, `/colores`, `/zonas-entrega` | Datos del catálogo |
| `GET /api/productos` | Búsqueda: `texto, idCategoria, precioMin, precioMax, idColor, soloConStock, orden, pagina, tamanoPagina` |
| `GET /api/productos/{id}`, `/codigo/{codigo}`, `/{id}/relacionados`, `/novedades` | Detalle y recomendaciones |
| `GET /api/pagos/metodos` | Métodos de pago y datos bancarios |
| `POST /api/auth/registro`, `/login`, `/recuperar`, `/restablecer` | Cuenta (límite estricto por IP) |
| `GET/POST/PUT/DELETE /api/carrito...` | Carrito de visitante (cabecera `X-Carrito-Token`) o de cliente |
| `GET /media/productos/...` | Fotos de productos |

**Cliente con sesión** (`Authorization: Bearer <token>`)

| Método y ruta | Descripción |
|---|---|
| `GET /api/auth/me`, `POST /api/auth/cambiar-password` | Sesión y contraseña |
| `POST /api/carrito/fusionar` | Une el carrito de visitante con el del cliente tras iniciar sesión |
| `GET/PUT /api/cuenta/perfil` | Perfil |
| `GET/POST/PUT/DELETE /api/cuenta/direcciones...`, `POST .../{id}/principal` | Libreta de direcciones |
| `POST /api/pedidos`, `GET /api/pedidos`, `GET /api/pedidos/{id}`, `POST .../{id}/cancelar` | Pedidos |
| `POST /api/pedidos/{id}/pagos/transferencia` | `multipart/form-data`: `comprobante` + `referencia` |
| `POST /api/pedidos/{id}/pagos/tarjeta` | JSON con los datos de la tarjeta (simulada) |
| `GET /api/pedidos/{id}/pagos/{idPago}/comprobante` | Descarga del comprobante propio |

**Administración** (`/api/admin/**`, solo rol `ADMIN`)

| Grupo | Rutas |
|---|---|
| Dashboard | `GET /dashboard` |
| Productos | `GET/POST /productos`, `GET/PUT/DELETE /productos/{id}`, `PATCH .../estado`, `PUT .../colores` |
| Imágenes | `GET/POST /productos/{id}/imagenes`, `PUT .../orden`, `POST/DELETE /imagenes/{id}...` |
| Inventario | `POST /productos/{id}/stock/entrada|salida|ajuste`, `GET .../kardex`, `GET /inventario/movimientos|stock-bajo` |
| Pedidos y pagos | `GET /pedidos`, `GET /pedidos/{id}`, `POST .../estado`, `PUT .../entrega`, `POST .../cancelar`, `GET /pagos/pendientes`, `POST /pagos/{id}/aprobar|rechazar`, `POST /reservas/liberar-vencidas` |
| Configuración | CRUD de `/categorias`, `/colores`, `/zonas-entrega`, `/proveedores`; `GET/PUT /parametros` (IVA, minutos de reserva...) |
| Usuarios | `GET /clientes`, `PUT /usuarios/{id}/estado`, `POST /administradores` |

## 🔒 Seguridad

- Todo exige sesión salvo lo marcado explícitamente como público; **todo el panel cuelga de un único grupo `/api/admin`** con política de rol (no puede quedar una ruta pública por descuido).
- Contraseñas con BCrypt, bloqueo temporal tras intentos fallidos, mensajes de login que no revelan si el correo existe, recuperación con token de un solo uso guardado como hash.
- Límite de peticiones por IP, cabeceras de seguridad, CORS restringido, errores internos que nunca filtran detalles.
- El carrito de visitante usa un token generado por el servidor; no se acepta uno inventado por el cliente.
- Subidas validadas por tamaño, extensión **y firma real del archivo**; nombres generados por el servidor; imágenes públicas y comprobantes privados en carpetas distintas.

## 🧪 Pruebas

Necesitan un PostgreSQL con un usuario que pueda crear bases de datos (crean y borran `floravia_test`; por seguridad el nombre debe contener «test»).

```bash
docker run -d --rm --name pg-test -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:17-alpine
dotnet test            # usa FLORAVIA_TEST_CONN o, por defecto, postgres/postgres en localhost:5432
```

Incluyen pruebas de negocio (carrito, pedidos, stock, inventario, pagos), de la pasarela de tarjeta simulada y de **integración de la API real** (seguridad por roles, formato de errores, flujo de compra completo, comprobantes privados, subida de imágenes, panel de administración). GitHub Actions las ejecuta en cada push (`.github/workflows/ci.yml`).

## 📄 Licencia

Ver [LICENSE](LICENSE).
