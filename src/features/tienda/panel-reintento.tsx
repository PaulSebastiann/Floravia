'use client';

import { Lock } from 'lucide-react';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { pagarPedidoAccion } from '@/app/acciones/checkout';
import type { EstadoForm } from '@/app/acciones/estado';
import { Button } from '@/components/ui/button';
import { Alerta } from '@/components/ui/campo';
import { validarComprobante } from '@/domain/comprobante';
import type { MetodosPago } from '@/domain/cuenta';
import type { Centavos } from '@/domain/dinero';
import { PanelPago, type MetodoElegido } from './panel-pago';

/** Pago (o reintento) sobre un pedido que ya existe: tarjeta de nuevo, o subir el comprobante. */
export function PanelReintento({ idPedido, metodos, total, inicial }: {
  idPedido: number; metodos: MetodosPago; total: Centavos; inicial: MetodoElegido;
}) {
  const [estado, accion, pendienteAccion] = useActionState<EstadoForm, FormData>(pagarPedidoAccion, {});
  const [, iniciar] = useTransition();
  const [enviando, setEnviando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const aviso = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!pendienteAccion) setEnviando(false); }, [pendienteAccion, estado]);
  useEffect(() => { if (estado.error || estado.errores) aviso.current?.focus(); }, [estado]);

  const enviar = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setErrorLocal(null);
    const fd = new FormData(ev.currentTarget);
    const archivo = fd.get('comprobante');
    if (fd.get('metodo') === 'TRANSFERENCIA') {
      const hayArchivo = archivo instanceof File && archivo.size > 0;
      const e = validarComprobante(hayArchivo && archivo instanceof File ? archivo : null);
      if (e) { setErrorLocal(e); return; }
    }
    if (!(archivo instanceof File) || archivo.size === 0) fd.delete('comprobante'); // input vacio: no mandar un File de 0 bytes
    setEnviando(true);
    iniciar(() => accion(fd));
  };
  const ocupado = enviando || pendienteAccion;

  return (
    <form onSubmit={enviar} noValidate className="space-y-6">
      <input type="hidden" name="idPedido" value={idPedido} />
      <div ref={aviso} tabIndex={-1} className="outline-none">
        {(errorLocal || estado.error) && <Alerta>{errorLocal ?? estado.error}</Alerta>}
      </div>
      <PanelPago metodos={metodos} errores={estado.errores ?? {}} total={total} inicial={inicial} comprobanteObligatorio deshabilitado={ocupado} />
      <Button type="submit" tamano="lg" cargando={ocupado}><Lock className="size-5" aria-hidden="true" />Pagar este pedido</Button>
    </form>
  );
}
