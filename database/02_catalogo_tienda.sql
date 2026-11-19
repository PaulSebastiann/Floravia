-- Ejecutar contra la base existente.
-- ADVERTENCIA: limpia producto y todos los datos dependientes (carritos, pedidos,
-- reservas, movimientos e imágenes). Úsalo solo para sincronizar desde cero.
\set ON_ERROR_STOP on
SET search_path TO floravia;

BEGIN;

TRUNCATE TABLE producto RESTART IDENTITY CASCADE;

-- Categorías
INSERT INTO categoria (nombre, descripcion)
VALUES
    ('Flor', 'Arreglos florales y flores de corte'),
    ('Planta', 'Plantas de interior y exterior'),
    ('Semilla', 'Semillas para cultivo')
ON CONFLICT (nombre) DO NOTHING;

-- Todos los productos visibles en el frontend
INSERT INTO producto (id_categoria, codigo, nombre, descripcion, cuidados, precio, stock, stock_minimo, estado)
VALUES
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Flor'), 'ramo-aurora', 'Ramo Aurora', 'Docena de rosas rojas envueltas en papel kraft con eucalipto. Un clásico para decir te quiero.', 'Mantén las flores con agua limpia y evita el sol directo.', 38.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Flor'), 'ramo-girasol', 'Ramo Girasol', 'Cinco girasoles con gypsophila. Alegría inmediata para cumpleaños y agradecimientos.', 'Renueva el agua cada dos días y conserva los tallos lejos del calor.', 32.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Flor'), 'ramo-nube', 'Ramo Nube', 'Arreglo sereno de rosas blancas y lirios, ideal para acompañar y recordar.', 'Mantén las flores frescas y retira el polen de los lirios.', 45.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Flor'), 'ramo-ternura', 'Ramo Ternura', 'Mezcla en tonos rosa pastel con tarjeta incluida. Perfecto para aniversarios.', 'Coloca los tallos en agua fresca y cambia el agua diariamente.', 42.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Flor'), 'ramo-fiesta', 'Ramo Fiesta', 'Gerberas de colores vivos para cualquier cumpleaños.', 'Corta los tallos en diagonal y evita dejar hojas bajo el agua.', 28.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Flor'), 'ramo-primavera', 'Ramo Primavera', 'Tulipanes con flores de temporada. La composición puede variar según disponibilidad.', 'Mantén el ramo en un lugar fresco y con poca luz directa.', 36.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Flor'), 'ramo-atardecer', 'Ramo Atardecer', 'Rosas naranjas con girasoles pequeños. Cálido y energético.', 'Renueva el agua cada dos días y recorta los tallos.', 40.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Flor'), 'ramo-eterno', 'Ramo Eterno', 'Cincuenta rosas rojas en presentación de lujo.', 'Corta los tallos en diagonal y mantiene el arreglo con agua limpia.', 120.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Flor'), 'ramo-lirio', 'Ramo Lirio Real', 'Lirios blancos de olor intenso. Para espacios amplios.', 'Retira el polen y cambia el agua con frecuencia.', 34.00, 0, 2, 'ACTIVO'),

    ((SELECT id_categoria FROM categoria WHERE nombre = 'Planta'), 'planta-suculenta-echeveria', 'Echeveria en maceta', 'Suculenta en forma de roseta. Tolera descuidos y luce en cualquier escritorio luminoso.', 'Sol directo y riego cada 14 días.', 9.50, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Planta'), 'planta-pothos', 'Pothos', 'Hojas acorazonadas que se adaptan a poca luz.', 'Luz indirecta y riego semanal.', 14.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Planta'), 'planta-sansevieria', 'Sansevieria', 'Hojas erguidas, casi indestructible y adecuada para sombra.', 'Riego espaciado cada 14 días.', 18.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Planta'), 'planta-monstera', 'Monstera deliciosa', 'Hojas perforadas de gran presencia para interiores luminosos.', 'Luz indirecta, riego semanal y humedad ambiental.', 32.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Planta'), 'planta-calathea', 'Calathea', 'Hojas decorativas que se pliegan de noche.', 'Luz indirecta, humedad alta y riego cada 5 días.', 22.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Planta'), 'planta-helecho', 'Helecho de Boston', 'Follaje arqueado que ama la humedad y es seguro para mascotas.', 'Luz indirecta y riego cada 4 días.', 16.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Planta'), 'planta-lavanda', 'Lavanda en maceta', 'Flores moradas y aroma relajante.', 'Sol directo, buen drenaje y riego cada 6 días.', 12.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Planta'), 'planta-bonsai-ficus', 'Bonsai de ficus', 'Bonsai formado que requiere poda y paciencia.', 'Luz indirecta y riego cada 3 días.', 55.00, 20, 2, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Planta'), 'planta-aloe', 'Aloe vera', 'Pencas carnosas y resistentes para una ventana soleada.', 'Sol directo y riego espaciado.', 11.00, 20, 2, 'ACTIVO'),

    ((SELECT id_categoria FROM categoria WHERE nombre = 'Semilla'), 'semilla-girasol', 'Semillas de girasol', 'Girasol ornamental de crecimiento rápido. Siembra directa en sitio soleado.', 'Siembra en profundidad superficial y mantiene el sustrato húmedo hasta germinar.', 2.50, 20, 5, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Semilla'), 'semilla-albahaca', 'Semillas de albahaca', 'Albahaca genovesa para cosechar desde casa.', 'Sustrato húmedo y sol parcial.', 2.00, 20, 5, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Semilla'), 'semilla-cilantro', 'Semillas de cilantro', 'Hierba de uso diario para siembra directa.', 'Siembra directa y riego suave.', 1.80, 20, 5, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Semilla'), 'semilla-lechuga', 'Semillas de lechuga', 'Lechuga de hoja para cosechas repetidas.', 'Prefiere clima fresco y riego regular.', 1.90, 20, 5, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Semilla'), 'semilla-tomate', 'Semillas de tomate cherry', 'Variedad de crecimiento indeterminado para maceta.', 'Requiere tutor, sol y riego regular.', 2.80, 20, 5, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Semilla'), 'semilla-cosmos', 'Semillas de cosmos', 'Flor de campo para polinizadores.', 'Siembra en pleno sol y riega moderadamente.', 2.20, 20, 5, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Semilla'), 'semilla-menta', 'Semillas de menta', 'Aromática vigorosa de crecimiento rápido.', 'Mejor en maceta propia y con humedad constante.', 2.40, 20, 5, 'ACTIVO'),
    ((SELECT id_categoria FROM categoria WHERE nombre = 'Semilla'), 'semilla-capuchina', 'Semillas de capuchina', 'Flor comestible con hojas y flores de sabor picante.', 'Sol o semisombra y suelo bien drenado.', 2.60, 20, 5, 'ACTIVO');

-- Imágenes principales reales disponibles en public/images
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/ramos/ramo-aurora.jpg', true, 0 FROM producto WHERE codigo = 'ramo-aurora';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/ramos/ramo-girasol.jpg', true, 0 FROM producto WHERE codigo = 'ramo-girasol';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/ramos/ramo-nube.jpg', true, 0 FROM producto WHERE codigo = 'ramo-nube';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/ramos/ramo-ternura.jpg', true, 0 FROM producto WHERE codigo = 'ramo-ternura';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/ramos/ramo-fiesta.jpg', true, 0 FROM producto WHERE codigo = 'ramo-fiesta';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/ramos/ramo-primavera.jpg', true, 0 FROM producto WHERE codigo = 'ramo-primavera';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/ramos/ramo-atardecer.jpg', true, 0 FROM producto WHERE codigo = 'ramo-atardecer';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/ramos/ramo-eterno.jpg', true, 0 FROM producto WHERE codigo = 'ramo-eterno';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/ramos/ramo-lirio.jpg', true, 0 FROM producto WHERE codigo = 'ramo-lirio';

INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/plantas/planta-suculenta-echeveria.jpg', true, 0 FROM producto WHERE codigo = 'planta-suculenta-echeveria';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/plantas/planta-pothos.jpg', true, 0 FROM producto WHERE codigo = 'planta-pothos';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/plantas/planta-sansevieria.jpg', true, 0 FROM producto WHERE codigo = 'planta-sansevieria';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/plantas/planta-monstera.jpg', true, 0 FROM producto WHERE codigo = 'planta-monstera';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/plantas/planta-calathea.jpg', true, 0 FROM producto WHERE codigo = 'planta-calathea';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/plantas/planta-helecho.jpg', true, 0 FROM producto WHERE codigo = 'planta-helecho';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/plantas/planta-lavanda.jpg', true, 0 FROM producto WHERE codigo = 'planta-lavanda';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/plantas/planta-bonsai-ficus.jpg', true, 0 FROM producto WHERE codigo = 'planta-bonsai-ficus';
INSERT INTO imagen_producto (id_producto, ruta, es_principal, orden)
SELECT id_producto, '/images/productos/plantas/planta-aloe.jpg', true, 0 FROM producto WHERE codigo = 'planta-aloe';

COMMIT;

-- Verificación
SELECT c.nombre AS categoria, COUNT(p.id_producto) AS productos,
       SUM(p.stock) AS stock_total, SUM(p.stock - p.stock_reservado) AS disponible
FROM categoria c
LEFT JOIN producto p ON p.id_categoria = c.id_categoria
GROUP BY c.nombre
ORDER BY c.nombre;
