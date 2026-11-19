'use client';

import Link from 'next/link';
import { Fragment, useActionState, useRef, useState } from 'react';
import { ingresarAccion } from '@/app/acciones/cuenta';
import type { EstadoForm } from '@/app/acciones/estado';
import { Alerta, Campo } from '@/components/ui/campo';
import { Button } from '@/components/ui/button';
import { hrefCrearCuenta } from '@/domain/redireccion';
import { useClaveFormulario } from './use-clave-formulario';

export function FormularioIngresar({ volver }: { volver: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoForm, FormData>(ingresarAccion, {});
  const e = estado.errores ?? {};
  const [ver, setVer] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const clave = useClaveFormulario(estado, formulario);
  return (
    <form ref={formulario} action={accion} noValidate className="space-y-5">
      <Fragment key={clave}>
      <input type="hidden" name="volver" value={volver} />
      {estado.error && <Alerta>{estado.error}</Alerta>}
      <Campo id="correo" name="correo" type="email" etiqueta="Correo electrónico" autoComplete="email" inputMode="email"
        defaultValue={estado.valores?.['correo']} error={e['correo']} required />
      <div>
        <Campo id="password" name="password" type={ver ? 'text' : 'password'} etiqueta="Contraseña" autoComplete="current-password"
          error={e['password']} required />
        <label className="mt-2 inline-flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={ver} onChange={(ev) => setVer(ev.target.checked)} className="size-4 accent-moss-700" />
          Mostrar contraseña
        </label>
      </div>
      <Button type="submit" tamano="lg" className="w-full" cargando={pendiente}>Ingresar</Button>
      <p className="text-center text-sm text-muted">
        ¿Aún no tienes cuenta?{' '}
        <Link href={hrefCrearCuenta(volver)} className="font-semibold text-moss-700 underline-offset-4 hover:underline">Crear cuenta</Link>
      </p>
      </Fragment>
    </form>
  );
}
