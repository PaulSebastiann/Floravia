'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * React 19 hace form.reset() al terminar una Server Action, y el usuario pierde lo que escribio si hubo un error.
 * Cada vez que llega un estado nuevo del servidor se devuelve una `key` distinta: los campos se vuelven a montar
 * con `defaultValue` (valores NO sensibles que devolvio la accion) y se enfoca el primer campo con error.
 */
export function useClaveFormulario(estado: unknown, formulario: RefObject<HTMLFormElement | null>): number {
  const [clave, setClave] = useState(0);
  const previo = useRef(estado);
  useEffect(() => {
    if (previo.current === estado) return;
    previo.current = estado;
    setClave((c) => c + 1);
  }, [estado]);
  useEffect(() => {
    if (clave === 0) return;
    const invalido = formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    invalido?.focus();
  }, [clave, formulario]);
  return clave;
}
