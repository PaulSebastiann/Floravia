# Despliegue de preproducción

Floravia se despliega como un único stack: PostgreSQL, migración idempotente del catálogo,
API .NET y frontend Next.js optimizado.

## 1. Preparar variables

```bash
cp .env.example .env
openssl rand -base64 48   # copiar el resultado en JWT_KEY
openssl rand -base64 32   # puede usarse como POSTGRES_PASSWORD
```

Completar obligatoriamente en `.env`:

- `POSTGRES_PASSWORD` y `JWT_KEY` con valores aleatorios distintos.
- `FRONTEND_URL` con la URL pública HTTPS, por ejemplo `https://pre.floravia.com`.
- `ADMIN_CORREO` y `ADMIN_PASSWORD` para el primer administrador.
- Todos los campos `PAGO_*` que se mostrarán en el checkout.
- `NEXT_PUBLIC_WHATSAPP` con código de país y solo dígitos.

SMTP puede quedar vacío durante preproducción; en ese caso la recuperación de contraseña se
registra en los logs y no se envía por correo.

## 2. Validar y desplegar

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

El servicio `catalogo` debe terminar con código 0. Es normal que aparezca como `Exited (0)`:
antes de arrancar la API aplica `database/02_catalogo_tienda.sql`. El script puede correr en cada
despliegue porque no reinicia stock ni elimina usuarios, carritos o pedidos.

Comprobaciones:

```bash
curl -fsS http://127.0.0.1:8081/health/ready
curl -fsS http://127.0.0.1:3000/api/tienda/estado
docker compose exec db psql -U floravia_user -d floravia -c \
  "SET search_path TO floravia; SELECT COUNT(*) AS productos FROM producto;"
```

La última consulta debe devolver 26 productos como mínimo.

## 3. Publicar con HTTPS

El puerto web escucha solo en `127.0.0.1:3000`. Configura Caddy, nginx o Traefik para publicar
`FRONTEND_URL` por HTTPS y enviar el tráfico a ese puerto. No publiques los puertos 5432 ni 8081.
El proxy debe reemplazar `X-Forwarded-For` y enviar `Host`/`X-Forwarded-Proto` correctos.

Ejemplo mínimo de Caddy:

```caddyfile
pre.floravia.com {
    reverse_proxy 127.0.0.1:3000
}
```

## 4. Operación segura

```bash
docker compose logs -f --tail=200 api web
docker compose restart api web
docker compose down             # conserva base y archivos
```

No ejecutar `docker compose down -v`: elimina PostgreSQL y los comprobantes/imágenes almacenados.
Antes de cada actualización importante, respaldar la base:

```bash
docker compose exec -T db pg_dump -U floravia_user -d floravia -Fc > floravia.backup
```
