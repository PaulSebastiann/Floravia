import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cancelarPedidoAccion, type AvisoPedido } from '@/app/acciones/checkout';
import { Alerta } from '@/components/ui/campo';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { formatearUSD } from '@/domain/dinero';
import { admitePago, estaConfirmado, ETIQUETA_ESTADO, ETIQUETA_METODO } from '@/domain/pedido';
import { mensajeUsuario } from '@/infrastructure/api/errores';
import { tienda } from '@/infrastructure/tienda';
import { AvisoDemo } from '@/features/tienda/aviso-demo';
import { exigirSesion } from '@/features/tienda/cuenta-guard';
import { PanelReintento } from '@/features/tienda/panel-reintento';
import { ResumenTotales } from '@/features/tienda/resumen-totales';

export const metadata: Metadata = { title: 'Tu pedido', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string; nuevo?: string }> };

const AVISOS: Record<AvisoPedido, string> = {
  rechazada: 'Tu tarjeta fue rechazada (simulación). Tu pedido sigue reservado: prueba con otra tarjeta o elige transferencia.',
  fondos: 'Fondos insuficientes (simulación). Tu pedido sigue reservado: prueba con otra tarjeta o elige transferencia.',
  'pago-error': 'No pudimos procesar el pago. No se registró ningún cobro. Inténtalo de nuevo.',
  'comprobante-error': 'No pudimos registrar tu comprobante. Tu pedido sigue reservado: súbelo de nuevo.',
};
const esAviso = (v: string | undefined): v is AvisoPedido => v !== undefined && Object.hasOwn(AVISOS, v);

const fechaCorta = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(d);
};

export default async function PedidoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const idPedido = /^\d{1,9}$/.test(id) ? Number(id) : NaN;
  if (!Number.isInteger(idPedido)) notFound();
  await exigirSesion(`/pedido/${idPedido}`);
  const sp = await searchParams;

  let pedido;
  try {
    pedido = await tienda().obtenerPedido(idPedido);
  } catch (e) {
    console.error('[floravia] pedido', e instanceof Error ? e.message : e);
    return <Container className="py-12"><Alerta>{mensajeUsuario(e)}</Alerta></Container>;
  }
  if (!pedido) notFound(); // 404 tambien si el pedido es de otro cliente: la API no distingue

  const confirmado = estaConfirmado(pedido.estado);
  const pagoPendiente = pedido.pagos.find((p) => p.estado === 'PENDIENTE');
  const puedePagar = admitePago(pedido);
  const cancelado = pedido.estado === 'CANCELADO';
  const pagoTarjetaOk = pedido.pagos.find((p) => p.metodo === 'TARJETA' && p.estado === 'APROBADO');
  const metodos = puedePagar ? await tienda().metodosDePago().catch(() => null) : null;
  const aviso = esAviso(sp.aviso) ? AVISOS[sp.aviso] : null;
  const pagoVisible = pagoPendiente ?? pedido.pagos.find((p) => p.estado === 'APROBADO') ?? pedido.pagos.at(-1);

  const cabecera = confirmado
    ? { Icono: CheckCircle2, color: 'text-moss-700', titulo: '¡Gracias por tu compra!', texto: 'Tu pedido está confirmado y lo estamos preparando.' }
    : cancelado
      ? { Icono: XCircle, color: 'text-petal-700', titulo: 'Pedido cancelado', texto: 'Este pedido ya no está activo. Tu carrito puede volver a armarse desde el catálogo.' }
      : pagoPendiente
        ? { Icono: Clock, color: 'text-sun-800', titulo: 'Recibimos tu pedido', texto: 'Estamos esperando la verificación de tu transferencia. Te confirmaremos cuando un administrador la apruebe.' }
        : { Icono: Clock, color: 'text-sun-800', titulo: 'Tu pedido está reservado', texto: 'Falta completar el pago. Reservamos tus productos por tiempo limitado.' };

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start gap-4">
          <cabecera.Icono className={`size-10 shrink-0 ${cabecera.color}`} aria-hidden="true" />
          <div>
            <h1 className="font-display text-4xl font-semibold text-moss-900">{cabecera.titulo}</h1>
            <p className="mt-2 text-muted">{cabecera.texto}</p>
          </div>
        </div>

        <AvisoDemo className="mt-6" />
        <div className="mt-6 space-y-3" aria-live="polite">
          {aviso && <Alerta tono="error">{aviso}</Alerta>}
          {pagoTarjetaOk && <Alerta tono="aviso"><strong>Compra simulada:</strong> no se realizó ningún cobro real a ninguna tarjeta.</Alerta>}
        </div>

        <section aria-labelledby="t-detalle" className="mt-8 rounded-[1.5rem] border border-line bg-white p-6 shadow-soft sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
            <div>
              <p className="text-sm text-muted">Número de pedido</p>
              <h2 id="t-detalle" className="font-display text-3xl font-semibold tabular-nums text-moss-900">{pedido.numero}</h2>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted">{fechaCorta(pedido.fecha)}</p>
              <p className="font-semibold text-moss-900">{ETIQUETA_ESTADO[pedido.estado]}</p>
            </div>
          </div>

          <ul className="divide-y divide-line">
            {pedido.lineas.map((l) => (
              <li key={l.idProducto} className="flex items-center justify-between gap-4 py-4 text-sm">
                <div className="min-w-0"><p className="font-medium text-moss-900">{l.nombre}</p><p className="text-muted">{l.cantidad} × {formatearUSD(l.precioUnitario)}</p></div>
                <p className="font-semibold tabular-nums">{formatearUSD(l.subtotal)}</p>
              </li>
            ))}
          </ul>

          <ResumenTotales className="border-t border-line pt-5" subtotal={pedido.subtotal} iva={pedido.iva} envio={pedido.costoEnvio} total={pedido.total} />

          <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Método de pago</dt>
              <dd className="font-semibold text-moss-900">
                {pagoVisible ? ETIQUETA_METODO[pagoVisible.metodo] : 'Aún sin elegir'}
                {pagoVisible?.tarjeta ? ` · ${pagoVisible.tarjeta.marca} •••• ${pagoVisible.tarjeta.ultimos4}` : ''}
              </dd>
              {pagoVisible?.referencia && <dd className="text-muted">Referencia: {pagoVisible.referencia}</dd>}
            </div>
            {pedido.entrega && (
              <div><dt className="text-muted">Entrega en</dt><dd className="font-semibold text-moss-900">{pedido.entrega.direccion}</dd></div>
            )}
          </dl>
        </section>

        {puedePagar && metodos && (
          <section aria-labelledby="t-pagar" className="mt-8 rounded-[1.5rem] border border-line bg-white p-6 shadow-soft sm:p-8">
            <h2 id="t-pagar" className="font-display text-2xl font-semibold text-moss-900">Completar el pago</h2>
            <p className="mb-5 mt-1 text-sm text-muted">Usa el número de pedido <strong className="tabular-nums">{pedido.numero}</strong> como referencia si pagas por transferencia.</p>
            <PanelReintento idPedido={pedido.idPedido} metodos={metodos} total={pedido.total} inicial={sp.aviso === 'rechazada' || sp.aviso === 'fondos' || sp.aviso === 'pago-error' ? 'TARJETA' : 'TRANSFERENCIA'} />
            <form action={cancelarPedidoAccion} className="mt-6 border-t border-line pt-5">
              <input type="hidden" name="idPedido" value={pedido.idPedido} />
              <Button type="submit" variante="fantasma" tamano="sm">Cancelar este pedido</Button>
            </form>
          </section>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild tamano="lg"><Link href="/">Volver a la tienda</Link></Button>
          <Button asChild tamano="lg" variante="contorno"><Link href="/cuenta/pedidos">Ver mis pedidos</Link></Button>
        </div>
      </div>
    </Container>
  );
}
