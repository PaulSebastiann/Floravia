import 'server-only';
import { redirect } from 'next/navigation';
import { hrefIngresar } from '@/domain/redireccion';
import { leerSesion } from '@/infrastructure/api/sesion';

/** Para paginas que exigen cliente con sesion. La API vuelve a verificar el JWT en cada llamada. */
export async function exigirSesion(volver: string) {
  const s = await leerSesion();
  if (!s) redirect(hrefIngresar(volver));
  return s;
}
