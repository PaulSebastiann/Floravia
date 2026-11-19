import { Alerta } from '@/components/ui/campo';
import { modoDemo } from '@/infrastructure/tienda';

/** Franja visible en cuenta, checkout y pedido cuando la tienda corre sin API: nada de esto es real. */
export function AvisoDemo({ className }: { className?: string }) {
  if (!modoDemo()) return null;
  return (
    <Alerta tono="aviso" className={className}>
      <strong>Modo demostración.</strong> Las cuentas, pedidos y pagos son de prueba: no se cobra nada ni se envía ningún pedido.
    </Alerta>
  );
}
