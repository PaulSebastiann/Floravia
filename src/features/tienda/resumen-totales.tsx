import { formatearUSD, type Centavos } from '@/domain/dinero';
import { cn } from '@/lib/cn';

interface Props {
  readonly subtotal: Centavos;
  readonly iva: Centavos;
  readonly porcentajeIva?: number;
  /** undefined = aun no se conoce (se calcula al elegir direccion). */
  readonly envio?: Centavos;
  readonly total: Centavos;
  readonly className?: string;
}

export function ResumenTotales({ subtotal, iva, porcentajeIva, envio, total, className }: Props) {
  return (
    <dl className={cn('space-y-2 text-sm', className)}>
      <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatearUSD(subtotal)}</dd></div>
      <div className="flex justify-between">
        <dt className="text-muted">IVA{porcentajeIva ? ` (${porcentajeIva}%)` : ''}</dt>
        <dd className="tabular-nums">{formatearUSD(iva)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">Envío</dt>
        <dd className="tabular-nums">{envio === undefined ? 'Se calcula con tu dirección' : formatearUSD(envio)}</dd>
      </div>
      <div className="flex justify-between border-t border-line pt-3 text-base font-semibold text-moss-900">
        <dt>Total</dt><dd className="tabular-nums">{formatearUSD(total)}</dd>
      </div>
    </dl>
  );
}
