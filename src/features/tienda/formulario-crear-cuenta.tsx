'use client';

import Link from 'next/link';
import { Fragment, useActionState, useRef, useState } from 'react';
import { crearCuentaAccion } from '@/app/acciones/cuenta';
import type { EstadoForm } from '@/app/acciones/estado';
import { Alerta, Campo } from '@/components/ui/campo';
import { Button } from '@/components/ui/button';
import { hrefIngresar } from '@/domain/redireccion';
import { useClaveFormulario } from './use-clave-formulario';

export function FormularioCrearCuenta({ volver }: { volver: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoForm, FormData>(crearCuentaAccion, {});
  const e = estado.errores ?? {};
  const v = estado.valores ?? {};
  const [ver, setVer] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const clave = useClaveFormulario(estado, formulario);
  const tipo = ver ? 'text' : 'password';
  return (
    <form ref={formulario} action={accion} noValidate className="space-y-5">
      <Fragment key={clave}>
      <input type="hidden" name="volver" value={volver} />
      {estado.error && <Alerta>{estado.error}</Alerta>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="nombres" name="nombres" etiqueta="Nombres" autoComplete="given-name" defaultValue={v['nombres']} error={e['nombres']} required />
        <Campo id="apellidos" name="apellidos" etiqueta="Apellidos" autoComplete="family-name" defaultValue={v['apellidos']} error={e['apellidos']} required />
        <Campo id="cedula" name="cedula" etiqueta="Cédula" inputMode="numeric" maxLength={10} autoComplete="off"
          defaultValue={v['cedula']} error={e['cedula']} ayuda="10 dígitos. La usamos para tus pedidos." required />
        <Campo id="telefono" name="telefono" type="tel" etiqueta="Teléfono" autoComplete="tel" inputMode="tel"
          defaultValue={v['telefono']} error={e['telefono']} ayuda="Para coordinar la entrega." required />
      </div>
      <Campo id="correo" name="correo" type="email" etiqueta="Correo electrónico" autoComplete="email" inputMode="email"
        defaultValue={v['correo']} error={e['correo']} ayuda="Con este correo iniciarás sesión." required />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="password" name="password" type={tipo} etiqueta="Contraseña" autoComplete="new-password"
          error={e['password']} ayuda="Mínimo 8 caracteres, con letras y números." required />
        <Campo id="confirmar" name="confirmar" type={tipo} etiqueta="Repite la contraseña" autoComplete="new-password" error={e['confirmar']} required />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={ver} onChange={(ev) => setVer(ev.target.checked)} className="size-4 accent-moss-700" />
        Mostrar contraseñas
      </label>
      <Button type="submit" tamano="lg" className="w-full" cargando={pendiente}>Crear cuenta</Button>
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{' '}
        <Link href={hrefIngresar(volver)} className="font-semibold text-moss-700 underline-offset-4 hover:underline">Ingresar</Link>
      </p>
      </Fragment>
    </form>
  );
}
