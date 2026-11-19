import { Package } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/ui/campo';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { EmptyState } from '@/components/ui/empty-state';
import { formatearUSD } from '@/domain/dinero';
import { ETIQUETA_ESTADO } from '@/domain/pedido';
import { mensajeUsuario } from '@/infrastructure/api/errores';
import { tienda } from '@/infrastructure/tienda';
import { exigirSesion } from '@/features/tienda/cuenta-guard';

export const metadata: Metadata = { title: 'Mis pedidos', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function MisPedidosPage() {
  await exigirSesion('/cuenta/pedidos');
  let pedidos;
  try {
    pedidos = await tienda().listarMisPedidos();
  } catch (e) {
    return <Container className="py-12"><Alerta>{mensajeUsuario(e)}</Alerta></Container>;
  }
  return (
    <Container className="py-8 sm:py-12">
      <h1 className="font-display text-4xl font-semibold text-moss-900">Mis pedidos</h1>
      <div className="mt-8">
        {pedidos.length === 0 ? (
          <EmptyState icono={<Package className="size-10" />} titulo="Aún no tienes pedidos" descripcion="Cuando compres, tus pedidos aparecerán aquí."
            accion={<Button asChild><Link href="/catalogo">Explorar catálogo</Link></Button>} />
        ) : (
          <ul className="divide-y divide-line rounded-[1.5rem] border border-line bg-white">
            {pedidos.map((p) => (
              <li key={p.idPedido}>
                <Link href={`/pedido/${p.idPedido}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 hover:bg-moss-50">
                  <span className="font-semibold tabular-nums text-moss-900">{p.numero}</span>
                  <span className="text-sm text-muted">{ETIQUETA_ESTADO[p.estado]}</span>
                  <span className="font-semibold tabular-nums">{formatearUSD(p.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
