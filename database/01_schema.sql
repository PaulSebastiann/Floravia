-- =====================================================================
-- FLORAVIA - Esquema relacional (PostgreSQL)
-- Normalizado a 3FN, con integridad referencial, CHECK y datos semilla.
-- Ejecutar completo en DBeaver con "Execute SQL Script" (Alt+X).
-- Es re-ejecutable: al inicio borra y recrea el esquema "floravia".
-- =====================================================================

DROP SCHEMA IF EXISTS floravia CASCADE;
CREATE SCHEMA floravia;
SET search_path TO floravia;

-- =====================================================================
-- 1. SEGURIDAD Y USUARIOS
-- =====================================================================

CREATE TABLE usuario (
    id_usuario          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    correo              VARCHAR(150) NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    rol                 VARCHAR(10)  NOT NULL,
    estado              VARCHAR(10)  NOT NULL DEFAULT 'ACTIVO',
    intentos_fallidos   INT          NOT NULL DEFAULT 0,
    bloqueado_hasta     TIMESTAMP,
    ultimo_acceso       TIMESTAMP,
    creado_en           TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usuario_correo UNIQUE (correo),
    CONSTRAINT ck_usuario_rol    CHECK (rol IN ('ADMIN', 'CLIENTE')),
    CONSTRAINT ck_usuario_estado CHECK (estado IN ('ACTIVO', 'BLOQUEADO', 'INACTIVO')),
    CONSTRAINT ck_usuario_intentos CHECK (intentos_fallidos >= 0)
);

CREATE TABLE cliente (
    id_cliente  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario  INT          NOT NULL,
    cedula      VARCHAR(10)  NOT NULL,
    nombres     VARCHAR(100) NOT NULL,
    apellidos   VARCHAR(100) NOT NULL,
    telefono    VARCHAR(20)  NOT NULL,
    CONSTRAINT uq_cliente_usuario UNIQUE (id_usuario),
    CONSTRAINT uq_cliente_cedula  UNIQUE (cedula),
    CONSTRAINT ck_cliente_cedula  CHECK (cedula ~ '^[0-9]{10}$'),
    CONSTRAINT fk_cliente_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario) ON DELETE CASCADE
);

CREATE TABLE administrador (
    id_admin    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario  INT          NOT NULL,
    nombres     VARCHAR(100) NOT NULL,
    apellidos   VARCHAR(100) NOT NULL,
    cargo       VARCHAR(80),
    CONSTRAINT uq_admin_usuario UNIQUE (id_usuario),
    CONSTRAINT fk_admin_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario) ON DELETE CASCADE
);

-- Token temporal para recuperar contraseña (CU-19). Se guarda el hash, no el token.
CREATE TABLE token_recuperacion (
    id_token    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario  INT          NOT NULL,
    token_hash  VARCHAR(255) NOT NULL,
    expira_en   TIMESTAMP    NOT NULL,
    usado_en    TIMESTAMP,
    creado_en   TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_token_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario) ON DELETE CASCADE
);

-- =====================================================================
-- 2. ENTREGA Y DIRECCIONES
-- =====================================================================

CREATE TABLE zona_entrega (
    id_zona      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sector       VARCHAR(100)  NOT NULL,
    costo_envio  NUMERIC(8,2)  NOT NULL,
    activa       BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_zona_sector UNIQUE (sector),
    CONSTRAINT ck_zona_costo  CHECK (costo_envio >= 0)
);

-- El sector NO se repite aqui: se obtiene por id_zona (evita redundancia).
CREATE TABLE direccion (
    id_direccion      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente        INT          NOT NULL,
    id_zona           INT          NOT NULL,
    calle_principal   VARCHAR(150) NOT NULL,
    calle_secundaria  VARCHAR(150),
    referencia        VARCHAR(250),
    ciudad            VARCHAR(80)  NOT NULL DEFAULT 'Quito',
    es_principal      BOOLEAN      NOT NULL DEFAULT FALSE,
    activa            BOOLEAN      NOT NULL DEFAULT TRUE,  -- baja logica: no se borra si hay pedidos
    CONSTRAINT fk_direccion_cliente FOREIGN KEY (id_cliente)
        REFERENCES cliente (id_cliente) ON DELETE CASCADE,
    CONSTRAINT fk_direccion_zona FOREIGN KEY (id_zona)
        REFERENCES zona_entrega (id_zona) ON DELETE RESTRICT
);
-- Un cliente solo puede tener una direccion principal activa
CREATE UNIQUE INDEX uq_direccion_principal
    ON direccion (id_cliente) WHERE es_principal AND activa;

-- =====================================================================
-- 3. CATALOGO
-- =====================================================================

CREATE TABLE categoria (
    id_categoria        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_categoria_padre  INT,
    nombre              VARCHAR(80)  NOT NULL,
    descripcion         VARCHAR(300),
    CONSTRAINT uq_categoria_nombre UNIQUE (nombre),
    CONSTRAINT fk_categoria_padre FOREIGN KEY (id_categoria_padre)
        REFERENCES categoria (id_categoria) ON DELETE RESTRICT,
    CONSTRAINT ck_categoria_no_self CHECK (id_categoria_padre IS NULL
                                           OR id_categoria_padre <> id_categoria)
);

CREATE TABLE producto (
    id_producto      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_categoria     INT           NOT NULL,
    codigo           VARCHAR(30)   NOT NULL,
    nombre           VARCHAR(150)  NOT NULL,
    descripcion      TEXT,
    cuidados         TEXT,
    precio           NUMERIC(10,2) NOT NULL,
    stock            INT           NOT NULL DEFAULT 0,
    stock_reservado  INT           NOT NULL DEFAULT 0,
    stock_minimo     INT           NOT NULL DEFAULT 0,
    estado           VARCHAR(10)   NOT NULL DEFAULT 'ACTIVO',
    creado_en        TIMESTAMP     NOT NULL DEFAULT NOW(),
    actualizado_en   TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_producto_codigo UNIQUE (codigo),
    CONSTRAINT fk_producto_categoria FOREIGN KEY (id_categoria)
        REFERENCES categoria (id_categoria) ON DELETE RESTRICT,
    CONSTRAINT ck_producto_precio   CHECK (precio >= 0),
    CONSTRAINT ck_producto_stock    CHECK (stock >= 0),                    -- RN-02
    CONSTRAINT ck_producto_reserva  CHECK (stock_reservado >= 0 AND stock_reservado <= stock),
    CONSTRAINT ck_producto_minimo   CHECK (stock_minimo >= 0),
    CONSTRAINT ck_producto_estado   CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

CREATE TABLE color (
    id_color    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL,
    codigo_hex  CHAR(7),
    CONSTRAINT uq_color_nombre UNIQUE (nombre),
    CONSTRAINT ck_color_hex CHECK (codigo_hex IS NULL OR codigo_hex ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE producto_color (
    id_producto  INT NOT NULL,
    id_color     INT NOT NULL,
    PRIMARY KEY (id_producto, id_color),
    CONSTRAINT fk_pc_producto FOREIGN KEY (id_producto)
        REFERENCES producto (id_producto) ON DELETE CASCADE,
    CONSTRAINT fk_pc_color FOREIGN KEY (id_color)
        REFERENCES color (id_color) ON DELETE RESTRICT
);

CREATE TABLE imagen_producto (
    id_imagen    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_producto  INT          NOT NULL,
    ruta         VARCHAR(300) NOT NULL,
    es_principal BOOLEAN      NOT NULL DEFAULT FALSE,
    orden        INT          NOT NULL DEFAULT 0,
    CONSTRAINT fk_imagen_producto FOREIGN KEY (id_producto)
        REFERENCES producto (id_producto) ON DELETE CASCADE
);
-- Solo una imagen principal por producto
CREATE UNIQUE INDEX uq_imagen_principal
    ON imagen_producto (id_producto) WHERE es_principal;

-- =====================================================================
-- 4. CARRITO
-- =====================================================================

CREATE TABLE carrito (
    id_carrito     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente     INT,                       -- NULL = carrito anonimo
    token_sesion   VARCHAR(100),
    estado         VARCHAR(12) NOT NULL DEFAULT 'ACTIVO',
    creado_en      TIMESTAMP   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_carrito_cliente FOREIGN KEY (id_cliente)
        REFERENCES cliente (id_cliente) ON DELETE CASCADE,
    CONSTRAINT ck_carrito_estado CHECK (estado IN ('ACTIVO', 'CONVERTIDO', 'ABANDONADO')),
    CONSTRAINT ck_carrito_dueno  CHECK (id_cliente IS NOT NULL OR token_sesion IS NOT NULL)
);
-- Un cliente tiene como maximo un carrito activo; un token anonimo tambien
CREATE UNIQUE INDEX uq_carrito_activo_cliente
    ON carrito (id_cliente) WHERE estado = 'ACTIVO' AND id_cliente IS NOT NULL;
CREATE UNIQUE INDEX uq_carrito_activo_token
    ON carrito (token_sesion) WHERE estado = 'ACTIVO' AND token_sesion IS NOT NULL;

CREATE TABLE item_carrito (
    id_item          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_carrito       INT           NOT NULL,
    id_producto      INT           NOT NULL,
    cantidad         INT           NOT NULL,
    precio_unitario  NUMERIC(10,2) NOT NULL,
    CONSTRAINT uq_item_carrito_producto UNIQUE (id_carrito, id_producto),
    CONSTRAINT ck_item_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_item_precio   CHECK (precio_unitario >= 0),
    CONSTRAINT fk_item_carrito FOREIGN KEY (id_carrito)
        REFERENCES carrito (id_carrito) ON DELETE CASCADE,
    CONSTRAINT fk_item_producto FOREIGN KEY (id_producto)
        REFERENCES producto (id_producto) ON DELETE RESTRICT
);

-- =====================================================================
-- 5. PEDIDOS, PAGOS Y ENTREGA
-- =====================================================================

CREATE TABLE pedido (
    id_pedido     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero        VARCHAR(20)   NOT NULL,
    id_cliente    INT           NOT NULL,
    id_direccion  INT           NOT NULL,
    fecha         TIMESTAMP     NOT NULL DEFAULT NOW(),
    subtotal      NUMERIC(10,2) NOT NULL,
    iva           NUMERIC(10,2) NOT NULL,
    costo_envio   NUMERIC(8,2)  NOT NULL,
    total         NUMERIC(10,2) NOT NULL,
    estado        VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE_PAGO',
    CONSTRAINT uq_pedido_numero UNIQUE (numero),
    CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente)
        REFERENCES cliente (id_cliente) ON DELETE RESTRICT,
    CONSTRAINT fk_pedido_direccion FOREIGN KEY (id_direccion)
        REFERENCES direccion (id_direccion) ON DELETE RESTRICT,
    CONSTRAINT ck_pedido_montos CHECK (subtotal >= 0 AND iva >= 0 AND costo_envio >= 0),
    CONSTRAINT ck_pedido_total  CHECK (total = subtotal + iva + costo_envio),
    CONSTRAINT ck_pedido_estado CHECK (estado IN
        ('PENDIENTE_PAGO','PAGADO','EN_PREPARACION','EN_CAMINO',
         'ENTREGADO','CANCELADO','PAGO_FALLIDO'))
);

CREATE TABLE detalle_pedido (
    id_detalle       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido        INT           NOT NULL,
    id_producto      INT           NOT NULL,
    cantidad         INT           NOT NULL,
    precio_unitario  NUMERIC(10,2) NOT NULL,   -- copia del precio al comprar (RN-04)
    subtotal         NUMERIC(10,2) NOT NULL,
    CONSTRAINT uq_detalle_pedido_producto UNIQUE (id_pedido, id_producto),
    CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_detalle_precio   CHECK (precio_unitario >= 0),
    CONSTRAINT ck_detalle_subtotal CHECK (subtotal = cantidad * precio_unitario),
    CONSTRAINT fk_detalle_pedido FOREIGN KEY (id_pedido)
        REFERENCES pedido (id_pedido) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto)
        REFERENCES producto (id_producto) ON DELETE RESTRICT
);

CREATE TABLE pago (
    id_pago             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido           INT           NOT NULL,
    metodo              VARCHAR(15)   NOT NULL,
    monto               NUMERIC(10,2) NOT NULL,
    estado              VARCHAR(12)   NOT NULL DEFAULT 'PENDIENTE',
    referencia_externa  VARCHAR(100),          -- id de transaccion de la pasarela
    ruta_comprobante    VARCHAR(300),          -- transferencia
    fecha_pago          TIMESTAMP,
    CONSTRAINT ck_pago_metodo CHECK (metodo IN ('TRANSFERENCIA','TARJETA')),
    CONSTRAINT ck_pago_monto  CHECK (monto > 0),
    CONSTRAINT ck_pago_estado CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO','REEMBOLSADO')),
    CONSTRAINT fk_pago_pedido FOREIGN KEY (id_pedido)
        REFERENCES pedido (id_pedido) ON DELETE RESTRICT
);
-- Un pedido solo puede tener un pago aprobado (los fallidos pueden reintentarse)
CREATE UNIQUE INDEX uq_pago_aprobado ON pago (id_pedido) WHERE estado = 'APROBADO';
-- La referencia de la pasarela no se repite
CREATE UNIQUE INDEX uq_pago_referencia ON pago (referencia_externa) WHERE referencia_externa IS NOT NULL;

CREATE TABLE entrega (
    id_entrega          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido           INT          NOT NULL,
    direccion_entrega   VARCHAR(600) NOT NULL,  -- copia de la direccion al comprar
    fecha_programada    DATE,
    fecha_entrega       TIMESTAMP,
    estado              VARCHAR(12)  NOT NULL DEFAULT 'PROGRAMADA',
    observacion         VARCHAR(300),
    CONSTRAINT uq_entrega_pedido UNIQUE (id_pedido),
    CONSTRAINT ck_entrega_estado CHECK (estado IN ('PROGRAMADA','EN_CAMINO','ENTREGADA','FALLIDA')),
    CONSTRAINT fk_entrega_pedido FOREIGN KEY (id_pedido)
        REFERENCES pedido (id_pedido) ON DELETE RESTRICT
);

-- =====================================================================
-- 6. INVENTARIO
-- =====================================================================

CREATE TABLE proveedor (
    id_proveedor  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(150) NOT NULL,
    ruc           VARCHAR(13),
    telefono      VARCHAR(20),
    CONSTRAINT uq_proveedor_ruc UNIQUE (ruc)
);

-- Kardex: cada entrada, salida o ajuste deja una fila con el saldo resultante (RN-07)
CREATE TABLE movimiento_inventario (
    id_movimiento  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_producto    INT           NOT NULL,
    id_pedido      INT,                          -- origen de una SALIDA por venta
    id_admin       INT,                          -- quien registro entrada/ajuste
    id_proveedor   INT,                          -- origen de una ENTRADA
    fecha          TIMESTAMP     NOT NULL DEFAULT NOW(),
    tipo           VARCHAR(10)   NOT NULL,
    cantidad       INT           NOT NULL,
    costo_unitario NUMERIC(10,2),
    saldo          INT           NOT NULL,
    motivo         VARCHAR(250),
    CONSTRAINT ck_mov_tipo     CHECK (tipo IN ('ENTRADA','SALIDA','AJUSTE')),
    CONSTRAINT ck_mov_cantidad CHECK (
        (tipo IN ('ENTRADA','SALIDA') AND cantidad > 0) OR (tipo = 'AJUSTE' AND cantidad <> 0)),
    CONSTRAINT ck_mov_saldo    CHECK (saldo >= 0),
    CONSTRAINT ck_mov_costo    CHECK (costo_unitario IS NULL OR costo_unitario >= 0),
    CONSTRAINT fk_mov_producto FOREIGN KEY (id_producto)
        REFERENCES producto (id_producto) ON DELETE RESTRICT,
    CONSTRAINT fk_mov_pedido FOREIGN KEY (id_pedido)
        REFERENCES pedido (id_pedido) ON DELETE RESTRICT,
    CONSTRAINT fk_mov_admin FOREIGN KEY (id_admin)
        REFERENCES administrador (id_admin) ON DELETE SET NULL,
    CONSTRAINT fk_mov_proveedor FOREIGN KEY (id_proveedor)
        REFERENCES proveedor (id_proveedor) ON DELETE SET NULL
);

-- Reserva temporal de stock mientras el pedido espera el pago (RN-03)
CREATE TABLE reserva_stock (
    id_reserva   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido    INT         NOT NULL,
    id_producto  INT         NOT NULL,
    cantidad     INT         NOT NULL,
    expira_en    TIMESTAMP   NOT NULL,
    estado       VARCHAR(12) NOT NULL DEFAULT 'ACTIVA',
    CONSTRAINT uq_reserva_pedido_producto UNIQUE (id_pedido, id_producto),
    CONSTRAINT ck_reserva_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_reserva_estado CHECK (estado IN ('ACTIVA','CONFIRMADA','EXPIRADA','LIBERADA')),
    CONSTRAINT fk_reserva_pedido FOREIGN KEY (id_pedido)
        REFERENCES pedido (id_pedido) ON DELETE CASCADE,
    CONSTRAINT fk_reserva_producto FOREIGN KEY (id_producto)
        REFERENCES producto (id_producto) ON DELETE RESTRICT
);

-- =====================================================================
-- 7. CONFIGURACION Y AUDITORIA
-- =====================================================================

-- IVA y otros valores parametrizables (RN-06)
CREATE TABLE parametro (
    clave        VARCHAR(50)  PRIMARY KEY,
    valor        VARCHAR(100) NOT NULL,
    descripcion  VARCHAR(250)
);

CREATE TABLE auditoria (
    id_log      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario  INT,
    accion      VARCHAR(60)  NOT NULL,
    entidad     VARCHAR(60),
    id_entidad  VARCHAR(40),
    ip          VARCHAR(45),
    fecha       TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario) ON DELETE SET NULL
);

-- =====================================================================
-- 8. INDICES (consultas frecuentes del catalogo, pedidos y kardex)
-- =====================================================================

CREATE INDEX ix_producto_catalogo   ON producto (id_categoria, estado, precio);
CREATE INDEX ix_producto_nombre     ON producto (LOWER(nombre));
CREATE INDEX ix_pedido_cliente      ON pedido (id_cliente, fecha DESC);
CREATE INDEX ix_pedido_estado       ON pedido (estado);
CREATE INDEX ix_detalle_producto    ON detalle_pedido (id_producto);
CREATE INDEX ix_pago_pedido         ON pago (id_pedido);
CREATE INDEX ix_mov_producto_fecha  ON movimiento_inventario (id_producto, fecha);
CREATE INDEX ix_reserva_expira      ON reserva_stock (expira_en) WHERE estado = 'ACTIVA';
CREATE INDEX ix_direccion_cliente   ON direccion (id_cliente);
CREATE INDEX ix_auditoria_fecha     ON auditoria (fecha);
CREATE INDEX ix_item_producto       ON item_carrito (id_producto);
CREATE INDEX ix_pc_color            ON producto_color (id_color);

-- =====================================================================
-- 9. DATOS SEMILLA
-- =====================================================================

INSERT INTO categoria (nombre, descripcion) VALUES
    ('Flor',    'Arreglos florales y flores de corte'),
    ('Planta',  'Plantas de interior y exterior'),
    ('Semilla', 'Semillas para cultivo');

INSERT INTO categoria (nombre, descripcion, id_categoria_padre)
SELECT 'Bonsai', 'Bonsais y arboles en miniatura', id_categoria
FROM categoria WHERE nombre = 'Planta';

INSERT INTO color (nombre, codigo_hex) VALUES
    ('Rojo',     '#D32F2F'),
    ('Blanco',   '#FFFFFF'),
    ('Rosado',   '#F48FB1'),
    ('Amarillo', '#FBC02D'),
    ('Morado',   '#7B1FA2'),
    ('Naranja',  '#F57C00'),
    ('Verde',    '#388E3C'),
    ('Azul',     '#1976D2');

INSERT INTO zona_entrega (sector, costo_envio) VALUES
    ('Norte',    3.00),
    ('Centro',   2.50),
    ('Sur',      3.50),
    ('Valles',   4.50);

-- Verificar el IVA vigente con el SRI antes de produccion
INSERT INTO parametro (clave, valor, descripcion) VALUES
    ('IVA_PORCENTAJE',          '15',  'Porcentaje de IVA (confirmar con el SRI)'),
    ('RESERVA_STOCK_MINUTOS',   '30',  'Minutos que se reserva el stock mientras se paga'),
    ('MAX_INTENTOS_LOGIN',      '5',   'Intentos fallidos antes de bloquear la cuenta'),
    ('MINUTOS_BLOQUEO_LOGIN',   '15',  'Minutos de bloqueo tras exceder los intentos');