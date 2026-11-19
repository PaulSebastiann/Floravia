'use client';

import { Banknote, CreditCard, FlaskConical, Landmark } from 'lucide-react';
import { useId, useState } from 'react';
import { Alerta, Campo, clasesInput } from '@/components/ui/campo';
import { COMPROBANTE_ACCEPT } from '@/domain/comprobante';
import { bancariosCompletos, type MetodosPago } from '@/domain/cuenta';
import { formatearUSD, type Centavos } from '@/domain/dinero';
import { detectarMarca, formatearNumero } from '@/domain/tarjeta';
import { cn } from '@/lib/cn';

export type MetodoElegido = 'TRANSFERENCIA' | 'TARJETA';

interface Props {
  readonly metodos: MetodosPago;
  readonly errores: Readonly<Record<string, string>>;
  readonly total?: Centavos;
  readonly inicial?: MetodoElegido;
  /** En /pedido el comprobante es obligatorio (el pedido ya existe); en checkout se puede subir despues. */
  readonly comprobanteObligatorio?: boolean;
  readonly deshabilitado?: boolean;
}

const ETIQUETAS_BANCO: ReadonlyArray<readonly [keyof MetodosPago['transferencia'], string]> = [
  ['banco', 'Banco'], ['tipoCuenta', 'Tipo de cuenta'], ['numeroCuenta', 'Número de cuenta'],
  ['titular', 'Titular'], ['identificacion', 'Identificación'],
];

/**
 * Selector de metodo + campos. NO es un <form>: lo monta el formulario que lo contiene.
 * Los datos de tarjeta viven solo en este estado local y en el FormData del envio.
 */
export function PanelPago({ metodos, errores, total, inicial = 'TRANSFERENCIA', comprobanteObligatorio = false, deshabilitado }: Props) {
  const id = useId();
  const demo = metodos.ficticio === true;
  const [metodo, setMetodo] = useState<MetodoElegido>(inicial);
  const [numero, setNumero] = useState('');

  const opciones = [
    { valor: 'TRANSFERENCIA' as const, titulo: 'Transferencia bancaria', detalle: 'Un administrador verifica tu comprobante', icono: Landmark },
    { valor: 'TARJETA' as const, titulo: 'Tarjeta de crédito o débito', detalle: 'Compra simulada · no se cobra nada', icono: CreditCard },
  ];

  return (
    <div>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-moss-900">Método de pago</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {opciones.map((o) => (
            <label key={o.valor} className={cn(
              'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-moss-600',
              metodo === o.valor ? 'border-moss-700 bg-moss-50 ring-1 ring-moss-700' : 'border-line bg-white hover:bg-moss-50',
            )}>
              <input type="radio" name="metodo" value={o.valor} checked={metodo === o.valor} disabled={deshabilitado}
                onChange={() => setMetodo(o.valor)} className="mt-1 size-4 accent-moss-700" />
              <span>
                <span className="flex items-center gap-2 font-semibold text-moss-900"><o.icono className="size-5" aria-hidden="true" />{o.titulo}</span>
                <span className="mt-0.5 block text-sm text-muted">{o.detalle}</span>
              </span>
            </label>
          ))}
        </div>
        {errores['metodo'] && <p className="mt-2 text-sm text-petal-700">{errores['metodo']}</p>}
      </fieldset>

      {metodo === 'TRANSFERENCIA' && (
        <div className="mt-5 space-y-5">
          {bancariosCompletos(metodos.transferencia) ? (
            <div className="rounded-2xl border border-line bg-cream-100/60 p-5">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-moss-900">
                <Banknote className="size-5" aria-hidden="true" />Datos para transferir
                {demo && <span className="rounded-full bg-sun-100 px-2.5 py-0.5 text-xs font-semibold text-sun-800">Datos ficticios de demostración</span>}
              </p>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {ETIQUETAS_BANCO.map(([k, et]) => (
                  <div key={k}><dt className="text-muted">{et}</dt><dd className="font-semibold text-moss-900 [overflow-wrap:anywhere]">{metodos.transferencia[k]}</dd></div>
                ))}
                {total !== undefined && <div><dt className="text-muted">Monto exacto</dt><dd className="font-semibold text-moss-900 tabular-nums">{formatearUSD(total)}</dd></div>}
              </dl>
            </div>
          ) : (
            <Alerta tono="aviso">
              Los datos bancarios de la tienda todavía no están configurados, así que no podemos mostrarlos aquí.
              Elige pago con tarjeta o escríbenos para recibirlos.
            </Alerta>
          )}
          {demo ? (
            <Alerta tono="info">
              Demostración: no transfieras dinero real y no necesitas subir comprobante. Al confirmar, tu pedido queda
              «pendiente de verificación», como en la tienda real.
            </Alerta>
          ) : (
            <Alerta tono="info">
              Tu pedido se reserva por tiempo limitado (normalmente 30 minutos). Transfiere y sube el comprobante dentro de ese plazo;
              después un administrador lo verificará y confirmará tu pedido.
            </Alerta>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-comp`} className="mb-1.5 block text-sm font-semibold text-moss-900">
                Comprobante {comprobanteObligatorio && !demo ? '' : demo ? '(opcional en la demostración)' : '(opcional ahora)'}
              </label>
              <input id={`${id}-comp`} name="comprobante" type="file" accept={COMPROBANTE_ACCEPT} disabled={deshabilitado}
                aria-invalid={errores['comprobante'] ? true : undefined} aria-describedby={`${id}-comp-ayuda`}
                className={cn(clasesInput, 'h-auto py-2.5 file:mr-3 file:rounded-full file:border-0 file:bg-moss-100 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-moss-900')} />
              <p id={`${id}-comp-ayuda`} className={cn('mt-1.5 text-xs', errores['comprobante'] ? 'text-petal-700' : 'text-muted')}>
                {errores['comprobante'] ?? (demo ? 'Puedes adjuntar cualquier imagen o PDF (máx. 5 MB) o continuar sin archivo.' : 'JPG, PNG, WEBP o PDF · máx. 5 MB. Si aún no transfieres, podrás subirlo en el siguiente paso.')}
              </p>
            </div>
            <Campo id={`${id}-ref`} name="referencia" etiqueta="Referencia de la transferencia (opcional)" maxLength={100} autoComplete="off" disabled={deshabilitado} />
          </div>
        </div>
      )}

      {metodo === 'TARJETA' && (
        <div className="mt-5 space-y-5">
          <Alerta tono="aviso">
            <p className="flex items-center gap-2 font-semibold"><FlaskConical className="size-4" aria-hidden="true" />Compra simulada</p>
            <p className="mt-1">{metodos.avisoTarjeta ?? 'Pasarela de práctica: no se realiza ningún cobro y los datos de la tarjeta no se guardan.'}{' '}
              <strong>No ingreses los datos de una tarjeta real.</strong></p>
          </Alerta>
          <div className="grid gap-5 sm:grid-cols-2">
            <Campo id={`${id}-num`} name="numero" etiqueta="Número de tarjeta" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242"
              value={numero} onChange={(e) => setNumero(formatearNumero(e.target.value))} error={errores['numero']} disabled={deshabilitado}
              claseContenedor="sm:col-span-2" ayuda={numero ? `Detectada: ${detectarMarca(numero)}` : demo ? 'Escribe cualquier número: es una simulación.' : undefined} />
            <Campo id={`${id}-tit`} name="titular" etiqueta="Nombre del titular" autoComplete="off" maxLength={80} error={errores['titular']} disabled={deshabilitado} claseContenedor="sm:col-span-2" />
            <div className="grid grid-cols-2 gap-3">
              <Campo id={`${id}-mes`} name="mes" etiqueta="Mes (MM)" inputMode="numeric" maxLength={2} placeholder="12" autoComplete="off" error={errores['mes']} disabled={deshabilitado} />
              <Campo id={`${id}-anio`} name="anio" etiqueta="Año (AAAA)" inputMode="numeric" maxLength={4} placeholder="2030" autoComplete="off" error={errores['anio']} disabled={deshabilitado} />
            </div>
            <Campo id={`${id}-cvv`} name="cvv" etiqueta="CVV" inputMode="numeric" maxLength={4} type="password" autoComplete="off" error={errores['cvv']} disabled={deshabilitado} />
          </div>
          {metodos.tarjetasDePrueba.length > 0 && (
            <details className="rounded-2xl border border-line bg-white p-4 text-sm">
              <summary className="cursor-pointer font-semibold text-moss-900">Tarjetas de prueba</summary>
              <ul className="mt-3 space-y-2">
                {metodos.tarjetasDePrueba.map((t) => (
                  <li key={t.numero} className="flex items-center justify-between gap-3">
                    <span><span className="tabular-nums font-medium">{t.numero}</span> <span className="text-muted">· {t.resultado}</span></span>
                    <button type="button" onClick={() => setNumero(formatearNumero(t.numero))}
                      className="rounded-full bg-moss-100 px-3 py-1 text-xs font-medium text-moss-900 hover:bg-moss-200">Usar</button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                {demo ? 'En la demostración cualquier número, fecha, nombre y CVV se aprueba, salvo estos números de prueba.' : 'Usa cualquier titular, un vencimiento futuro y un CVV de 3 dígitos (4 en Amex).'}
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
