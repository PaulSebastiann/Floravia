import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { baseVacia, type BaseDemo } from './motor';

/**
 * Persistencia de la tienda de demostracion: un JSON local (`.demo-data/tienda.json`, ignorado por git) para que
 * cuentas y pedidos sobrevivan a reinicios del servidor de desarrollo. Si el disco es de solo lectura
 * (hosting serverless) sigue funcionando en memoria. NO usar como base de datos real.
 */
type ConEstado = typeof globalThis & { __floraviaDemo?: BaseDemo };
const g = globalThis as ConEstado;

const ruta = (): string =>
  process.env['FLORAVIA_DEMO_DATA']?.trim() || path.join(process.cwd(), '.demo-data', 'tienda.json');

function cargar(): BaseDemo {
  const vacia = baseVacia();
  try {
    const o = JSON.parse(fs.readFileSync(ruta(), 'utf8')) as Partial<BaseDemo>;
    if (typeof o.secreto !== 'string' || !Array.isArray(o.usuarios)) return vacia;
    return {
      ...vacia, ...o,
      usuarios: o.usuarios, direcciones: o.direcciones ?? [], pedidos: o.pedidos ?? [],
      carritos: o.carritos ?? {}, seq: { ...vacia.seq, ...o.seq },
      stockPorProducto: o.stockPorProducto ?? {}, reservadoPorProducto: o.reservadoPorProducto ?? {},
    };
  } catch {
    return vacia; // no existe todavia o esta corrupto: se empieza limpio
  }
}

/** Base compartida por todo el proceso (sobrevive al hot reload gracias a globalThis). */
export const base = (): BaseDemo => (g.__floraviaDemo ??= cargar());

let avisado = false;
export function guardar(): void {
  const destino = ruta();
  try {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    const tmp = `${destino}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(base()), { mode: 0o600 });
    fs.renameSync(tmp, destino); // escritura atomica: un corte no deja el archivo a medias
  } catch (e) {
    if (!avisado) {
      avisado = true;
      console.warn('[floravia] Demo: no se pudo guardar en disco; los datos viviran solo en memoria.', e instanceof Error ? e.message : e);
    }
  }
}
