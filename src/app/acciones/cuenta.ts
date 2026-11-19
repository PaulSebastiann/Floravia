'use server';

import { redirect } from 'next/navigation';
import { rutaInternaSegura } from '@/domain/redireccion';
import {
  hayErrores, normalizarCorreo, validarCedula, validarCorreo, validarPassword, validarTelefono, validarTexto,
} from '@/domain/validaciones-cuenta';
import { ApiError, ApiNoDisponible, mensajeUsuario } from '@/infrastructure/api/errores';
import { cerrarSesion } from '@/infrastructure/api/sesion';
import { CuentaNoPermitida } from '@/infrastructure/api/tienda-api';
import { tienda } from '@/infrastructure/tienda';
import { texto, type EstadoForm } from './estado';

function falloAmable(e: unknown): EstadoForm {
  if (e instanceof CuentaNoPermitida) return { error: e.message };
  if (!(e instanceof ApiError) && !(e instanceof ApiNoDisponible)) console.error('[floravia] error inesperado en cuenta', e);
  return { error: mensajeUsuario(e) };
}

export async function ingresarAccion(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const correo = normalizarCorreo(texto(fd, 'correo', 200));
  const password = texto(fd, 'password', 200);
  const volver = rutaInternaSegura(texto(fd, 'volver'), '/');

  const errores: Record<string, string> = {};
  const eCorreo = validarCorreo(correo);
  if (eCorreo) errores['correo'] = eCorreo;
  if (!password) errores['password'] = 'Ingresa tu contraseña.';
  if (hayErrores(errores)) return { errores, valores: { correo } };

  try {
    await tienda().iniciarSesion(correo, password);
  } catch (e) {
    return { ...falloAmable(e), valores: { correo } };
  }
  redirect(volver); // fuera del try: redirect() lanza una excepcion de control
}

export async function crearCuentaAccion(_prev: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const v = {
    nombres: texto(fd, 'nombres', 100).trim(),
    apellidos: texto(fd, 'apellidos', 100).trim(),
    cedula: texto(fd, 'cedula', 20).trim(),
    telefono: texto(fd, 'telefono', 30).trim(),
    correo: normalizarCorreo(texto(fd, 'correo', 200)),
  };
  const password = texto(fd, 'password', 200);
  const confirmar = texto(fd, 'confirmar', 200);
  const volver = rutaInternaSegura(texto(fd, 'volver'), '/');

  const errores: Record<string, string> = {};
  const set = (k: string, e: string | undefined) => { if (e) errores[k] = e; };
  set('nombres', validarTexto(v.nombres, 'Tu nombre', 100));
  set('apellidos', validarTexto(v.apellidos, 'Tu apellido', 100));
  set('cedula', validarCedula(v.cedula));
  set('telefono', validarTelefono(v.telefono));
  set('correo', validarCorreo(v.correo));
  set('password', validarPassword(password));
  if (!errores['password'] && password !== confirmar) errores['confirmar'] = 'Las contraseñas no coinciden.';
  if (hayErrores(errores)) return { errores, valores: v };

  try {
    await tienda().registrarCliente({ ...v, password });
  } catch (e) {
    return { ...falloAmable(e), valores: v };
  }
  redirect(volver);
}

export async function salirAccion(): Promise<void> {
  await cerrarSesion();
  redirect('/');
}
