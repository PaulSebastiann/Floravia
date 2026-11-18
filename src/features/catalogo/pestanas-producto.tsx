import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NOMBRES_MES, type Producto } from '@/domain/producto';
import { etiquetaOpcion } from './etiquetas';

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-6 border-b border-line py-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-moss-900">{v}</dd>
    </div>
  );
}

function Detalle({ producto }: { producto: Producto }) {
  switch (producto.linea) {
    case 'ramos':
      return (
        <dl>
          <Fila k="Ocasiones" v={producto.ocasiones.map((o) => etiquetaOpcion('ocasion', o)).join(', ')} />
          <Fila k="Colores" v={producto.colores.map((c) => etiquetaOpcion('color', c)).join(', ')} />
          <Fila k="Duración aproximada" v={`${producto.duracionDias} días`} />
        </dl>
      );
    case 'plantas':
      return (
        <dl>
          <Fila k="Nivel de cuidado" v={etiquetaOpcion('cuidado', producto.nivelCuidado)} />
          <Fila k="Luz" v={etiquetaOpcion('luz', producto.luz)} />
          <Fila k="Ubicación" v={etiquetaOpcion('ubicacion', producto.ubicacion)} />
          <Fila k="Riego" v={`Cada ~${producto.riegoCadaDias} días (orientativo)`} />
          <Fila k="Pet-friendly" v={producto.petFriendly ? 'Sí' : 'No: consúltanos si tienes mascotas'} />
        </dl>
      );
    case 'semillas':
      return (
        <dl>
          <Fila k="Cultivo" v={etiquetaOpcion('cultivo', producto.cultivo)} />
          <Fila k="Uso" v={etiquetaOpcion('uso', producto.uso)} />
          <Fila k="Germinación" v={`${producto.germinacionDias.min}–${producto.germinacionDias.max} días`} />
          <Fila k="Meses de siembra" v={producto.mesesSiembra.map((m) => NOMBRES_MES[m - 1]).join(', ')} />
          <Fila k="Contenido" v={producto.contenido} />
        </dl>
      );
  }
}

export function PestanasProducto({ producto }: { producto: Producto }) {
  const esRamo = producto.linea === 'ramos';
  return (
    <Tabs defaultValue="detalle">
      <TabsList aria-label="Información del producto">
        <TabsTrigger value="detalle">{esRamo ? 'Composición' : 'Ficha de cuidados'}</TabsTrigger>
        <TabsTrigger value="descripcion">Descripción</TabsTrigger>
        <TabsTrigger value="entrega">Entrega</TabsTrigger>
      </TabsList>
      <TabsContent value="detalle">
        {producto.linea === 'ramos' && (
          <ul className="mb-4 list-disc space-y-1 pl-5 marker:text-moss-600">
            {producto.composicion.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
        <Detalle producto={producto} />
      </TabsContent>
      <TabsContent value="descripcion"><p className="text-lg text-ink">{producto.descripcion}</p></TabsContent>
      <TabsContent value="entrega">
        <p className="text-ink">Entregamos a domicilio en Quito. Coordinamos día, horario y costo según tu dirección. Para pedidos del mismo día, consúltanos antes de confirmar.</p>
      </TabsContent>
    </Tabs>
  );
}
