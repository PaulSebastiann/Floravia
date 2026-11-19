'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { EstadoForm } from '@/app/acciones/estado';
import { finalizarCompraAccion } from '@/app/acciones/checkout';
import { Button } from '@/components/ui/button';
import { Alerta, Campo, clasesInput } from '@/components/ui/campo';
import type { Carrito } from '@/domain/carrito';
import { validarComprobante } from '@/domain/comprobante';
import type { Direccion, MetodosPago, ZonaEntrega } from '@/domain/cuenta';
import { formatearUSD, sumar } from '@/domain/dinero';
import { Miniatura } from './lista-carrito';
import { PanelPago } from './panel-pago';
import { ResumenTotales } from './resumen-totales';

interface Props {
  readonly carrito: Carrito;
  readonly direcciones: readonly Direccion[];
  readonly zonas: readonly ZonaEntrega[];
  readonly metodos: MetodosPago;
}

const NUEVA = 'nueva';

export function CheckoutForm({ carrito, direcciones, zonas, metodos }: Props) {
  const router = useRouter();
  const [estado, accion, pendienteAccion] = useActionState<EstadoForm, FormData>(finalizarCompraAccion, {});
  const [, iniciar] = useTransition();
  const [enviando, setEnviando] = useState(false);
  const resumenError = useRef<HTMLDivElement>(null);
  const errores = estado.errores ?? {};

  const principal = direcciones.find((d) => d.esPrincipal) ?? direcciones[0];
  const [seleccion, setSeleccion] = useState<string>(principal ? String(principal.idDireccion) : NUEVA);
  const [idZona, setIdZona] = useState<string>('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Una direccion nueva se guarda ANTES de crear el pedido: si el pedido falla, se conserva y se preselecciona.
  useEffect(() => {
    if (estado.idDireccion) { setSeleccion(String(estado.idDireccion)); router.refresh(); }
  }, [estado.idDireccion, router]);

  useEffect(() => {
    if (estado.error || Object.keys(errores).length > 0) resumenError.current?.focus();
  }, [estado, errores]);

  const envio = useMemo(() => {
    if (seleccion === NUEVA) return zonas.find((z) => String(z.idZona) === idZona)?.costoEnvio;
    return direcciones.find((d) => String(d.idDireccion) === seleccion)?.costoEnvio;
  }, [seleccion, idZona, zonas, direcciones]);
  const total = sumar(carrito.totalSinEnvio, envio ?? (0 as typeof carrito.totalSinEnvio));

  const enviar = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setErrorLocal(null);
    const form = ev.currentTarget;
    const fd = new FormData(form);
    const archivo = fd.get('comprobante');
    if (archivo instanceof File && archivo.size > 0) {
      const e = validarComprobante(archivo);
      if (e) { setErrorLocal(e); return; } // evita subir 5+ MB para recibir un error
    } else {
      fd.delete('comprobante'); // input vacio: no mandar un File de 0 bytes
    }
    setEnviando(true);
    iniciar(() => accion(fd));
  };
  // Si la accion termino con error, se vuelve a habilitar el formulario.
  useEffect(() => { if (!pendienteAccion) setEnviando(false); }, [pendienteAccion, estado]);
  const ocupado = enviando || pendienteAccion;

  return (
    <form onSubmit={enviar} noValidate className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-14">
      <div className="space-y-10">
        <div ref={resumenError} tabIndex={-1} className="outline-none">
          {(estado.error || errorLocal) && <Alerta>{errorLocal ?? estado.error}</Alerta>}
          {!estado.error && !errorLocal && Object.keys(errores).length > 0 && <Alerta>Revisa los campos marcados para continuar.</Alerta>}
        </div>

        <section aria-labelledby="t-direccion">
          <h2 id="t-direccion" className="font-display text-2xl font-semibold text-moss-900">1. Dirección de entrega</h2>
          <fieldset className="mt-4 space-y-3" disabled={ocupado}>
            <legend className="sr-only">Elige dónde entregamos tu pedido</legend>
            {direcciones.map((d) => (
              <label key={d.idDireccion} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-4 has-[:checked]:border-moss-700 has-[:checked]:bg-moss-50 has-[:checked]:ring-1 has-[:checked]:ring-moss-700">
                <input type="radio" name="direccion" value={d.idDireccion} checked={seleccion === String(d.idDireccion)} onChange={() => setSeleccion(String(d.idDireccion))} className="mt-1 size-4 accent-moss-700" />
                <span className="text-sm">
                  <span className="block font-semibold text-moss-900">{d.callePrincipal}{d.calleSecundaria ? ` y ${d.calleSecundaria}` : ''}</span>
                  <span className="block text-muted">{d.ciudad}{d.sector ? ` · ${d.sector}` : ''} · Envío {formatearUSD(d.costoEnvio)}{d.esPrincipal ? ' · Principal' : ''}</span>
                  {d.referencia && <span className="block text-muted">Ref.: {d.referencia}</span>}
                </span>
              </label>
            ))}
            {direcciones.length > 0 && (
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line bg-white p-4 has-[:checked]:border-moss-700 has-[:checked]:bg-moss-50">
                <input type="radio" name="direccion" value={NUEVA} checked={seleccion === NUEVA} onChange={() => setSeleccion(NUEVA)} className="size-4 accent-moss-700" />
                <span className="text-sm font-semibold text-moss-900">Usar otra dirección</span>
              </label>
            )}
            {direcciones.length === 0 && <input type="hidden" name="direccion" value={NUEVA} />}
            {errores['direccion'] && <p className="text-sm text-petal-700">{errores['direccion']}</p>}
          </fieldset>

          {seleccion === NUEVA && (
            <fieldset className="mt-5 grid gap-5 sm:grid-cols-2" disabled={ocupado}>
              <legend className="sr-only">Nueva dirección en Quito</legend>
              <div className="sm:col-span-2">
                <label htmlFor="idZona" className="mb-1.5 block text-sm font-semibold text-moss-900">Sector de Quito</label>
                <select id="idZona" name="idZona" value={idZona} onChange={(e) => setIdZona(e.target.value)} aria-invalid={errores['idZona'] ? true : undefined} className={clasesInput}>
                  <option value="">Elige tu sector</option>
                  {zonas.map((z) => <option key={z.idZona} value={z.idZona}>{z.sector} · envío {formatearUSD(z.costoEnvio)}</option>)}
                </select>
                {errores['idZona'] && <p className="mt-1.5 text-sm text-petal-700">{errores['idZona']}</p>}
              </div>
              <Campo id="callePrincipal" name="callePrincipal" etiqueta="Calle principal y número" autoComplete="address-line1" maxLength={200} error={errores['callePrincipal']} />
              <Campo id="calleSecundaria" name="calleSecundaria" etiqueta="Calle secundaria" autoComplete="address-line2" maxLength={200} />
              <Campo id="referencia_dir" name="referencia_dir" etiqueta="Referencia (edificio, color de casa…)" maxLength={300} claseContenedor="sm:col-span-2" />
              <label className="inline-flex items-center gap-2 text-sm text-muted sm:col-span-2">
                <input type="checkbox" name="principal" className="size-4 accent-moss-700" /> Guardar como mi dirección principal
              </label>
            </fieldset>
          )}
        </section>

        <section aria-labelledby="t-pago">
          <h2 id="t-pago" className="font-display text-2xl font-semibold text-moss-900">2. Pago</h2>
          <div className="mt-4"><PanelPago metodos={metodos} errores={errores} total={total} deshabilitado={ocupado} /></div>
        </section>
      </div>

      <aside aria-labelledby="t-resumen" className="h-fit rounded-[1.5rem] border border-line bg-white p-6 shadow-soft lg:sticky lg:top-28">
        <h2 id="t-resumen" className="font-display text-2xl font-semibold text-moss-900">Tu pedido</h2>
        <ul className="mt-4 divide-y divide-line">
          {carrito.lineas.map((l) => (
            <li key={l.idProducto} className="flex items-center gap-3 py-3">
              <Miniatura linea={l} className="size-14" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium text-moss-900">{l.nombre}</p>
                <p className="text-muted">{l.cantidad} × {formatearUSD(l.precioUnitario)}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatearUSD(l.subtotal)}</p>
            </li>
          ))}
        </ul>
        <ResumenTotales className="mt-4" subtotal={carrito.subtotal} iva={carrito.iva} porcentajeIva={carrito.porcentajeIva} envio={envio} total={total} />
        <Button type="submit" tamano="lg" className="mt-6 w-full" cargando={ocupado}>
          <Lock className="size-5" aria-hidden="true" />Confirmar y pagar
        </Button>
        <p className="mt-3 text-center text-xs text-muted">
          El valor final lo confirma la tienda al crear el pedido. <Link href="/carrito" className="underline">Volver al carrito</Link>
        </p>
      </aside>
    </form>
  );
}
