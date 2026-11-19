import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alerta } from '@/components/ui/campo';
import { rutaInternaSegura } from '@/domain/redireccion';
import { leerSesion } from '@/infrastructure/api/sesion';
import { FormularioIngresar } from '@/features/tienda/formulario-ingresar';
import { PaginaAuth } from '@/features/tienda/pagina-auth';

export const metadata: Metadata = { title: 'Ingresar', robots: { index: false } };
type Props = { searchParams: Promise<{ volver?: string | string[] }> };

export default async function IngresarPage({ searchParams }: Props) {
  const sp = await searchParams;
  const volver = rutaInternaSegura(Array.isArray(sp.volver) ? sp.volver[0] : sp.volver, '/');
  if (await leerSesion()) redirect(volver);
  const paraComprar = volver.startsWith('/checkout');
  return (
    <PaginaAuth
      titulo="Ingresar"
      subtitulo="Accede a tu cuenta para comprar y seguir tus pedidos."
      aviso={paraComprar ? <Alerta tono="info">Tu carrito está guardado. Inicia sesión para continuar con el pago.</Alerta> : undefined}
    >
      <FormularioIngresar volver={volver} />
    </PaginaAuth>
  );
}
