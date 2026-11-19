'use client';

import { usePathname } from 'next/navigation';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { CARRITO_VACIO, type Carrito } from '@/domain/carrito';
import type { SesionCliente } from '@/domain/cuenta';

interface EstadoTienda {
  readonly cargando: boolean;
  readonly carrito: Carrito;
  readonly sesion: SesionCliente | null;
  /** La API habilita las operaciones de compra. */
  readonly compra: boolean;
  /** Aplica el carrito que devolvio una Server Action (el servidor es la fuente de verdad). */
  readonly aplicarCarrito: (c: Carrito) => void;
  readonly recargar: () => Promise<void>;
  readonly olvidarSesion: () => void;
}

const Contexto = createContext<EstadoTienda | null>(null);

/** Rutas cuyo cambio puede alterar sesion o carrito (login, registro, pago): ahi se vuelve a pedir el estado. */
const RUTAS_SENSIBLES = /^\/(cuenta|checkout|pedido|carrito)(\/|$)/;

export function TiendaProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [carrito, setCarrito] = useState<Carrito>(CARRITO_VACIO);
  const [sesion, setSesion] = useState<SesionCliente | null>(null);
  const [compra, setCompra] = useState(false);
  const version = useRef(0);

  const recargar = useCallback(async () => {
    const mia = ++version.current;
    try {
      const r = await fetch('/api/tienda/estado', { cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { sesion: SesionCliente | null; carrito: Carrito; compra: boolean };
      if (mia !== version.current) return; // llego una respuesta mas nueva (o una accion): esta ya es vieja
      setSesion(d.sesion);
      setCarrito(d.carrito);
      setCompra(d.compra);
    } catch {
      /* se conserva lo que haya: el header no debe romperse porque el estado no cargue */
    } finally {
      if (mia === version.current) setCargando(false);
    }
  }, []);

  useEffect(() => { void recargar(); }, [recargar]);

  const pathname = usePathname();
  const anterior = useRef(pathname);
  useEffect(() => {
    const previa = anterior.current;
    anterior.current = pathname;
    if (previa !== pathname && (RUTAS_SENSIBLES.test(previa) || RUTAS_SENSIBLES.test(pathname))) void recargar();
  }, [pathname, recargar]);

  const aplicarCarrito = useCallback((c: Carrito) => {
    version.current++; // invalida cualquier recarga en vuelo
    setCarrito(c);
  }, []);

  const olvidarSesion = useCallback(() => {
    version.current++;
    setSesion(null);
    setCarrito(CARRITO_VACIO);
  }, []);

  const valor = useMemo<EstadoTienda>(
    () => ({ cargando, carrito, sesion, compra, aplicarCarrito, recargar, olvidarSesion }),
    [cargando, carrito, sesion, compra, aplicarCarrito, recargar, olvidarSesion],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTienda(): EstadoTienda {
  const c = useContext(Contexto);
  if (!c) throw new Error('useTienda debe usarse dentro de <TiendaProvider>');
  return c;
}
