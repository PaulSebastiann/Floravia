import { centavos } from '@/domain/dinero';
import type { Planta, Producto, Ramo, Semilla } from '@/domain/producto';

/**
 * DATOS DE MUESTRA. Nombres, descripciones y precios son ficticios (como en la v0.0).
 * Reemplazar por la API real; no usar como catalogo del cliente.
 */
const base = (id: string, nombre: string, resumen: string, descripcion: string, usd: number) => ({
  id,
  slug: id,
  nombre,
  resumen,
  descripcion,
  precio: centavos(Math.round(usd * 100)),
  imagenes: id.startsWith('semilla-')
    ? []
    : [{
        url: `/images/productos/${id.startsWith('ramo-') ? 'ramos' : 'plantas'}/${id}.jpg`,
        alt: nombre,
      }],
  disponible: true,
  destacado: false,
  masVendido: false,
});

const ramo = (
  r: ReturnType<typeof base>,
  x: Omit<Ramo, keyof ReturnType<typeof base> | 'linea'> & Partial<Pick<Ramo, 'destacado' | 'masVendido' | 'disponible'>>,
): Ramo => ({ ...r, linea: 'ramos', ...x });

const planta = (
  r: ReturnType<typeof base>,
  x: Omit<Planta, keyof ReturnType<typeof base> | 'linea'> & Partial<Pick<Planta, 'destacado' | 'masVendido' | 'disponible'>>,
): Planta => ({ ...r, linea: 'plantas', ...x });

const semilla = (
  r: ReturnType<typeof base>,
  x: Omit<Semilla, keyof ReturnType<typeof base> | 'linea'> & Partial<Pick<Semilla, 'destacado' | 'masVendido' | 'disponible'>>,
): Semilla => ({ ...r, linea: 'semillas', ...x });

const BRUTOS: readonly Producto[] = [
  // ---------- RAMOS ----------
  ramo(base('ramo-aurora', 'Ramo Aurora', 'Rosas rojas con follaje verde', 'Docena de rosas rojas envueltas en papel kraft con eucalipto. Un clasico para decir te quiero.', 38), {
    ocasiones: ['aniversario', 'amor'], tiposFlor: ['rosas'], colores: ['rojo'], duracionDias: 7,
    composicion: ['12 rosas rojas', 'Eucalipto', 'Papel kraft y lazo'], destacado: true, masVendido: true,
  }),
  ramo(base('ramo-girasol', 'Ramo Girasol', 'Girasoles luminosos para celebrar', 'Cinco girasoles con gypsophila. Alegria inmediata para cumpleanos y agradecimientos.', 32), {
    ocasiones: ['cumpleanos', 'agradecimiento'], tiposFlor: ['girasoles'], colores: ['amarillo'], duracionDias: 6,
    composicion: ['5 girasoles', 'Gypsophila', 'Papel blanco'], destacado: true, masVendido: true,
  }),
  ramo(base('ramo-nube', 'Ramo Nube', 'Rosas blancas y lirios', 'Arreglo sereno de rosas blancas y lirios, ideal para acompanar y recordar.', 45), {
    ocasiones: ['condolencias', 'agradecimiento'], tiposFlor: ['rosas', 'lirios'], colores: ['blanco'], duracionDias: 8,
    composicion: ['8 rosas blancas', '3 lirios', 'Follaje'], destacado: true,
  }),
  ramo(base('ramo-ternura', 'Ramo Ternura', 'Rosas rosadas y peonias suaves', 'Mezcla en tonos rosa pastel con tarjeta incluida. Perfecto para aniversarios.', 42), {
    ocasiones: ['aniversario', 'amor', 'cumpleanos'], tiposFlor: ['rosas', 'mixtas'], colores: ['rosa'], duracionDias: 7,
    composicion: ['10 rosas rosadas', 'Flor de relleno', 'Tarjeta'], masVendido: true,
  }),
  ramo(base('ramo-fiesta', 'Ramo Fiesta', 'Gerberas multicolor', 'Gerberas de colores vivos para cualquier cumpleanos. Duran bien y alegran la mesa.', 28), {
    ocasiones: ['cumpleanos'], tiposFlor: ['gerberas'], colores: ['multicolor'], duracionDias: 6,
    composicion: ['10 gerberas', 'Follaje'], masVendido: true,
  }),
  ramo(base('ramo-primavera', 'Ramo Primavera', 'Tulipanes y flores de temporada', 'Tulipanes con flores de temporada. La composicion puede variar segun disponibilidad.', 36), {
    ocasiones: ['agradecimiento', 'cumpleanos'], tiposFlor: ['tulipanes', 'mixtas'], colores: ['morado', 'rosa'], duracionDias: 5,
    composicion: ['8 tulipanes', 'Flores de temporada'],
  }),
  ramo(base('ramo-atardecer', 'Ramo Atardecer', 'Tonos naranja y amarillo', 'Rosas naranjas con girasoles pequenos. Calido y energico.', 40), {
    ocasiones: ['cumpleanos', 'agradecimiento'], tiposFlor: ['rosas', 'girasoles'], colores: ['naranja', 'amarillo'], duracionDias: 7,
    composicion: ['8 rosas naranjas', '3 girasoles'],
  }),
  ramo(base('ramo-eterno', 'Ramo Eterno', 'Cincuenta rosas rojas', 'El gran gesto: cincuenta rosas rojas en presentacion de lujo.', 120), {
    ocasiones: ['aniversario', 'amor'], tiposFlor: ['rosas'], colores: ['rojo'], duracionDias: 8,
    composicion: ['50 rosas rojas', 'Caja de presentacion'], destacado: true,
  }),
  ramo(base('ramo-lirio', 'Ramo Lirio Real', 'Lirios aromaticos', 'Lirios blancos de olor intenso. Para espacios amplios.', 34), {
    ocasiones: ['condolencias', 'agradecimiento'], tiposFlor: ['lirios'], colores: ['blanco'], duracionDias: 8,
    composicion: ['6 lirios', 'Follaje'], disponible: false,
  }),

  // ---------- PLANTAS ----------
  planta(base('planta-suculenta-echeveria', 'Echeveria en maceta', 'Roseta compacta de bajo riego', 'Suculenta en forma de roseta. Tolera descuidos y luce en cualquier escritorio luminoso.', 9.5), {
    nivelCuidado: 'facil', luz: 'sol-directo', ubicacion: 'ambos', petFriendly: true, riegoCadaDias: 14,
    tamanos: [{ etiqueta: 'Chica', alturaCm: 8 }, { etiqueta: 'Mediana', alturaCm: 14 }], maceta: 'Barro con drenaje',
    destacado: true, masVendido: true,
  }),
  planta(base('planta-pothos', 'Pothos', 'Colgante resistente para interiores', 'Hojas acorazonadas que se adaptan a poca luz. Ideal para empezar.', 14), {
    nivelCuidado: 'facil', luz: 'luz-indirecta', ubicacion: 'interior', petFriendly: false, riegoCadaDias: 7,
    tamanos: [{ etiqueta: 'Mediana', alturaCm: 25 }, { etiqueta: 'Grande', alturaCm: 45 }], maceta: 'Ceramica con plato',
    destacado: true, masVendido: true,
  }),
  planta(base('planta-sansevieria', 'Sansevieria', 'Casi indestructible', 'Hojas erguidas, purifica la vista y perdona el olvido. Aguanta sombra.', 18), {
    nivelCuidado: 'facil', luz: 'sombra', ubicacion: 'interior', petFriendly: false, riegoCadaDias: 14,
    tamanos: [{ etiqueta: 'Mediana', alturaCm: 40 }, { etiqueta: 'Grande', alturaCm: 70 }], maceta: 'Ceramica o plastico con drenaje',
    masVendido: true,
  }),
  planta(base('planta-monstera', 'Monstera deliciosa', 'La reina de las hojas grandes', 'Hojas perforadas de gran presencia. Pide luz indirecta y espacio.', 32), {
    nivelCuidado: 'medio', luz: 'luz-indirecta', ubicacion: 'interior', petFriendly: false, riegoCadaDias: 7,
    tamanos: [{ etiqueta: 'Mediana', alturaCm: 40 }, { etiqueta: 'Grande', alturaCm: 80 }], maceta: 'Maceta amplia con drenaje',
    destacado: true,
  }),
  planta(base('planta-calathea', 'Calathea', 'Hojas pintadas que se mueven', 'Hojas decorativas que se pliegan de noche. Exige humedad y agua sin cal.', 22), {
    nivelCuidado: 'experto', luz: 'luz-indirecta', ubicacion: 'interior', petFriendly: true, riegoCadaDias: 5,
    tamanos: [{ etiqueta: 'Mediana', alturaCm: 35 }], maceta: 'Ceramica con plato',
  }),
  planta(base('planta-helecho', 'Helecho de Boston', 'Verde frondoso y pet-friendly', 'Follaje arqueado que ama la humedad. Seguro si conviven mascotas.', 16), {
    nivelCuidado: 'medio', luz: 'luz-indirecta', ubicacion: 'ambos', petFriendly: true, riegoCadaDias: 4,
    tamanos: [{ etiqueta: 'Mediana', alturaCm: 30 }, { etiqueta: 'Grande', alturaCm: 50 }], maceta: 'Colgante o maceta con drenaje',
  }),
  planta(base('planta-lavanda', 'Lavanda en maceta', 'Aromatica de exterior', 'Flores moradas y aroma relajante. Necesita sol y buen drenaje.', 12), {
    nivelCuidado: 'medio', luz: 'sol-directo', ubicacion: 'exterior', petFriendly: false, riegoCadaDias: 6,
    tamanos: [{ etiqueta: 'Chica', alturaCm: 20 }, { etiqueta: 'Mediana', alturaCm: 35 }], maceta: 'Barro con drenaje',
  }),
  planta(base('planta-bonsai-ficus', 'Bonsai de ficus', 'Un proyecto a largo plazo', 'Bonsai de ficus formado. Requiere poda, riego constante y paciencia.', 55), {
    nivelCuidado: 'experto', luz: 'luz-indirecta', ubicacion: 'ambos', petFriendly: false, riegoCadaDias: 3,
    tamanos: [{ etiqueta: 'Unico', alturaCm: 30 }], maceta: 'Bandeja de bonsai',
  }),
  planta(base('planta-aloe', 'Aloe vera', 'Suculenta util y resistente', 'Pencas carnosas, buena compania de ventana. Riego espaciado.', 11), {
    nivelCuidado: 'facil', luz: 'sol-directo', ubicacion: 'ambos', petFriendly: false, riegoCadaDias: 14,
    tamanos: [{ etiqueta: 'Mediana', alturaCm: 25 }], maceta: 'Barro con drenaje',
  }),

  // ---------- SEMILLAS ----------
  semilla(base('semilla-girasol', 'Semillas de girasol', 'Flores grandes y faciles', 'Girasol ornamental de crecimiento rapido. Siembra directa en sitio soleado.', 2.5), {
    cultivo: 'flores', uso: 'ornamental', mesesSiembra: [9, 10, 11, 12, 1], germinacionDias: { min: 7, max: 14 },
    contenido: '25 semillas', destacado: true, masVendido: true,
  }),
  semilla(base('semilla-albahaca', 'Semillas de albahaca', 'Aromatica para la cocina', 'Albahaca genovesa. Cosecha hojas frescas desde casa en una maceta soleada.', 2), {
    cultivo: 'aromaticas', uso: 'comestible', mesesSiembra: [3, 4, 5, 9, 10], germinacionDias: { min: 5, max: 10 },
    contenido: '100 semillas', destacado: true, masVendido: true,
  }),
  semilla(base('semilla-cilantro', 'Semillas de cilantro', 'Hierba de uso diario', 'Cilantro de siembra directa. No tolera bien el trasplante.', 1.8), {
    cultivo: 'aromaticas', uso: 'comestible', mesesSiembra: [3, 4, 9, 10, 11], germinacionDias: { min: 7, max: 14 },
    contenido: '150 semillas', masVendido: true,
  }),
  semilla(base('semilla-lechuga', 'Semillas de lechuga', 'Huerto en casa', 'Lechuga de hoja para cosechas repetidas. Prefiere clima fresco.', 1.9), {
    cultivo: 'huerto', uso: 'comestible', mesesSiembra: [2, 3, 4, 8, 9, 10], germinacionDias: { min: 4, max: 10 },
    contenido: '200 semillas', destacado: true,
  }),
  semilla(base('semilla-tomate', 'Semillas de tomate cherry', 'Cosecha dulce en maceta', 'Variedad de crecimiento indeterminado. Requiere tutor y sol.', 2.8), {
    cultivo: 'huerto', uso: 'comestible', mesesSiembra: [8, 9, 10, 11], germinacionDias: { min: 6, max: 12 },
    contenido: '30 semillas',
  }),
  semilla(base('semilla-cosmos', 'Semillas de cosmos', 'Flor de campo para polinizadores', 'Flores ligeras en tonos rosados y blancos. Muy generosas.', 2.2), {
    cultivo: 'flores', uso: 'ornamental', mesesSiembra: [9, 10, 11, 12], germinacionDias: { min: 7, max: 10 },
    contenido: '60 semillas',
  }),
  semilla(base('semilla-menta', 'Semillas de menta', 'Aromatica vigorosa', 'Menta de crecimiento rapido; mejor en maceta propia para que no invada.', 2.4), {
    cultivo: 'aromaticas', uso: 'comestible', mesesSiembra: [3, 4, 5, 9, 10], germinacionDias: { min: 10, max: 15 },
    contenido: '80 semillas',
  }),
  semilla(base('semilla-capuchina', 'Semillas de capuchina', 'Flor comestible', 'Hojas y flores comestibles de sabor picante. Ornamental y util.', 2.6), {
    cultivo: 'flores', uso: 'comestible', mesesSiembra: [9, 10, 11, 3], germinacionDias: { min: 7, max: 14 },
    contenido: '20 semillas',
  }),
];

/** Stock de la demostracion: lo bastante alto para probar cantidades; 0 si el producto esta marcado no disponible. */
export const STOCK_DEMO = 20;

/** `idProducto` estable (posicion + 1) para que el carrito de la demostracion funcione igual que con la API. */
export const PRODUCTOS_MOCK: readonly Producto[] = BRUTOS.map(
  (p, i): Producto => ({ ...p, idProducto: i + 1, stockDisponible: p.disponible ? STOCK_DEMO : 0 }),
);
