/**
 * Validacion de formularios en el servidor (y reutilizable en cliente para feedback inmediato).
 * Reglas ESPEJO de application/Validaciones.cs: si el backend cambia, cambiar aqui tambien.
 * El backend sigue siendo la autoridad: esto solo evita viajes inutiles y da mensajes por campo.
 */
export type Errores<K extends string> = Partial<Record<K, string>>;

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CEDULA = /^[0-9]{10}$/;

export const normalizarCorreo = (v: string): string => v.trim().toLowerCase();

export function validarCorreo(v: string): string | undefined {
  const c = normalizarCorreo(v);
  if (c.length === 0) return 'Ingresa tu correo.';
  if (c.length > 150 || !CORREO.test(c)) return 'El correo no es válido.';
  return undefined;
}

export function validarPassword(v: string): string | undefined {
  if (v.length < 8 || !/\p{L}/u.test(v) || !/\d/.test(v))
    return 'Mínimo 8 caracteres, con letras y números.';
  return undefined;
}

export function validarTelefono(v: string): string | undefined {
  const t = v.trim();
  if (t.length === 0) return 'Ingresa un teléfono de contacto.';
  if (t.length > 20 || !/^[0-9+\s()-]{7,20}$/.test(t)) return 'El teléfono no es válido.';
  return undefined;
}

/** Cedula ecuatoriana: 10 digitos + provincia (01-24 o 30) + tercer digito < 6 + modulo 10. */
export function cedulaEcuatorianaValida(c: string): boolean {
  if (!CEDULA.test(c)) return false;
  const provincia = Number(c.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  if (Number(c[2]) >= 6) return false;
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(c[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    suma += d;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === Number(c[9]);
}

export function validarCedula(v: string): string | undefined {
  // Paridad con el backend (solo 10 digitos). El digito verificador NO se exige: los datos de prueba
  // de la API (p. ej. 1712345678) no lo cumplen. Ver `cedulaEcuatorianaValida` si se decide endurecer.
  return CEDULA.test(v.trim()) ? undefined : 'La cédula debe tener 10 dígitos.';
}

export function validarTexto(v: string, campo: string, max: number): string | undefined {
  const t = v.trim();
  if (t.length === 0) return `${campo} es obligatorio.`;
  if (t.length > max) return `${campo} no puede superar ${max} caracteres.`;
  return undefined;
}

export const hayErrores = (e: object): boolean => Object.keys(e).length > 0;
