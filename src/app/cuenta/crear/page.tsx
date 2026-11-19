import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alerta } from '@/components/ui/campo';
import { rutaInternaSegura } from '@/domain/redireccion';
import { leerSesion } from '@/infrastructure/api/sesion';
import { FormularioCrearCuenta } from '@/features/tienda/formulario-crear-cuenta';
import { PaginaAuth } from '@/features/tienda/pagina-auth';

export const metadata: Metadata = { title: 'Crear cuenta', robots: { index: false } };
type Props = { searchParams: Promise<{ volver?: string | string[] }> };

export default async function CrearCuentaPage({ searchParams }: Props) {
  const sp = await searchParams;
  const volver = rutaInternaSegura(Array.isArray(sp.volver) ? sp.volver[0] : sp.volver, '/');
  if (await leerSesion()) redirect(volver);
  const paraComprar = volver.startsWith('/checkout');
  return (
    <PaginaAuth
      titulo="Crea tu cuenta"
      subtitulo="Un minuto y listo: guardamos tus datos de entrega y tu historial de pedidos."
      aviso={paraComprar ? <Alerta tono="info">Tu carrito está guardado. Crea tu cuenta y continúa con el pago.</Alerta> : undefined}
    >
      <FormularioCrearCuenta volver={volver} />
    </PaginaAuth>
  );
}
