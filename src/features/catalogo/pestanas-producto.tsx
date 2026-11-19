import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NOMBRES_MES, type Producto } from '@/domain/producto';
import { etiquetaOpcion } from './etiquetas';

type FilaDato = readonly [clave: string, valor: string | undefined];

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-6 border-b border-line py-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-moss-900">{v}</dd>
    </div>
  );
}

/** Filas estructuradas segun la linea. Solo existen las que el backend entrega. */
function filasDe(p: Producto): readonly FilaDato[] {
  switch (p.linea) {
    case 'ramos':
      return [
        ['Ocasiones', p.ocasiones?.map((o) => etiquetaOpcion('ocasion', o)).join(', ')],
        ['Colores', p.colores?.map((c) => etiquetaOpcion('color', c)).join(', ')],
        ['Duración aproximada', p.duracionDias ? `${p.duracionDias} días` : undefined],
      ];
    case 'plantas':
      return [
        ['Nivel de cuidado', p.nivelCuidado ? etiquetaOpcion('cuidado', p.nivelCuidado) : undefined],
        ['Luz', p.luz ? etiquetaOpcion('luz', p.luz) : undefined],
        ['Ubicación', p.ubicacion ? etiquetaOpcion('ubicacion', p.ubicacion) : undefined],
        ['Riego', p.riegoCadaDias ? `Cada ~${p.riegoCadaDias} días (orientativo)` : undefined],
        ['Pet-friendly', p.petFriendly === undefined ? undefined : p.petFriendly ? 'Sí' : 'No: consúltanos si tienes mascotas'],
      ];
    case 'semillas':
      return [
        ['Cultivo', p.cultivo ? etiquetaOpcion('cultivo', p.cultivo) : undefined],
        ['Uso', p.uso ? etiquetaOpcion('uso', p.uso) : undefined],
        ['Germinación', p.germinacionDias ? `${p.germinacionDias.min}–${p.germinacionDias.max} días` : undefined],
        ['Meses de siembra', p.mesesSiembra?.map((m) => NOMBRES_MES[m - 1]).join(', ')],
        ['Contenido', p.contenido],
      ];
  }
}

export function PestanasProducto({ producto }: { producto: Producto }) {
  const esRamo = producto.linea === 'ramos';
  const filas = filasDe(producto).filter((f): f is readonly [string, string] => Boolean(f[1]));
  const composicion = producto.linea === 'ramos' ? producto.composicion : undefined;
  const hayDetalle = filas.length > 0 || Boolean(producto.cuidados) || Boolean(composicion?.length);

  return (
    <Tabs defaultValue="detalle">
      <TabsList aria-label="Información del producto">
        <TabsTrigger value="detalle">{esRamo ? 'Cuidados y composición' : 'Ficha de cuidados'}</TabsTrigger>
        <TabsTrigger value="descripcion">Descripción</TabsTrigger>
        <TabsTrigger value="entrega">Entrega</TabsTrigger>
      </TabsList>
      <TabsContent value="detalle">
        {composicion && composicion.length > 0 && (
          <ul className="mb-4 list-disc space-y-1 pl-5 marker:text-moss-600">
            {composicion.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
        {producto.cuidados && <p className="mb-4 whitespace-pre-line text-lg text-ink">{producto.cuidados}</p>}
        {filas.length > 0 && <dl>{filas.map(([k, v]) => <Fila key={k} k={k} v={v} />)}</dl>}
        {!hayDetalle && (
          <p className="text-muted">Aún no tenemos la ficha de cuidados de este producto. Escríbenos y te asesoramos.</p>
        )}
      </TabsContent>
      <TabsContent value="descripcion">
        <p className="text-lg text-ink">{producto.descripcion || 'Sin descripción por ahora.'}</p>
      </TabsContent>
      <TabsContent value="entrega">
        <p className="text-ink">Entregamos a domicilio en Quito. El costo de envío depende del sector y se muestra antes de confirmar tu compra.</p>
      </TabsContent>
    </Tabs>
  );
}
