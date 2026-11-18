import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Ilustraciones botanicas originales generadas con SVG. Sirven como imagen de
 * respaldo cuando el producto aun no tiene fotografia. Deterministas: la misma
 * `semilla` produce siempre el mismo dibujo (sin saltos entre SSR e hidratacion).
 */
export type FormaArte = 'ramo' | 'planta' | 'sobre';
export type VarianteHoja = 'anchas' | 'roseta' | 'espigas';

interface Props {
  forma: FormaArte;
  semilla: string;
  /** Colores hex de las flores / del sobre. */
  colores?: readonly string[];
  etiqueta?: string;
  /** Solo para forma='planta'. Si se omite, se deduce del hash de la semilla. */
  variante?: VarianteHoja;
  className?: string;
}

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function prng(semilla: number): () => number {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VERDES = ['#2f5d3a', '#3f7440', '#5b8c52', '#9dc093'] as const;
const ARCILLA = '#b4694a';
const ARCILLA_OSCURA = '#8f4f36';

function Flor({ cx, cy, r, color, rot }: { cx: number; cy: number; r: number; color: string; rot: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx={0} cy={-r * 0.5} rx={r * 0.38} ry={r * 0.55} fill={color} transform={`rotate(${a})`} opacity={0.96} />
      ))}
      <circle r={r * 0.28} fill="#f3c969" />
    </g>
  );
}

function Hoja({ x, y, largo, ancho, rot, color }: { x: number; y: number; largo: number; ancho: number; rot: number; color: string }) {
  return (
    <ellipse cx={x} cy={y - largo / 2} rx={ancho} ry={largo / 2} fill={color} transform={`rotate(${rot} ${x} ${y})`} />
  );
}

function Ramo({ rnd, colores }: { rnd: () => number; colores: readonly string[] }) {
  const paleta = colores.length > 0 ? colores : ['#e8938f'];
  const flores = Array.from({ length: 7 }, (_, i) => {
    const ang = -90 + (i - 3) * 22 + (rnd() - 0.5) * 8;
    const dist = 28 + rnd() * 26;
    const rad = (ang * Math.PI) / 180;
    return {
      cx: 100 + Math.cos(rad) * dist * 0.9,
      cy: 78 + Math.sin(rad) * dist * 0.75,
      r: 15 + rnd() * 6,
      color: paleta[i % paleta.length] ?? '#e8938f',
      rot: rnd() * 60,
    };
  });
  return (
    <>
      {flores.map((f, i) => (
        <line key={`t${i}`} x1={100} y1={150} x2={f.cx} y2={f.cy} stroke="#3f7440" strokeWidth={2.2} strokeLinecap="round" />
      ))}
      {[-48, -30, 30, 48].map((rot, i) => (
        <Hoja key={`h${i}`} x={100} y={118} largo={44} ancho={9} rot={rot} color={VERDES[i % VERDES.length] ?? '#3f7440'} />
      ))}
      {flores.map((f, i) => (
        <Flor key={`f${i}`} {...f} />
      ))}
      <path d="M62 112 L138 112 L112 192 L88 192 Z" fill="#d9b88a" />
      <path d="M62 112 L138 112 L130 130 L70 130 Z" fill="#c9a572" />
      <path d="M92 150 Q100 158 108 150 Q100 142 92 150Z" fill="#a63f45" />
    </>
  );
}

function Planta({ rnd, semilla, variante }: { rnd: () => number; semilla: string; variante?: VarianteHoja }) {
  const orden: readonly VarianteHoja[] = ['anchas', 'roseta', 'espigas'];
  const elegida = variante ?? orden[hash(semilla) % 3] ?? 'anchas';
  const tipo = orden.indexOf(elegida);
  const hojas =
    tipo === 0
      ? // hojas anchas
        Array.from({ length: 8 }, (_, i) => (
          <Hoja key={i} x={100} y={138} largo={52 + rnd() * 26} ancho={14 + rnd() * 5} rot={-70 + i * 20 + (rnd() - 0.5) * 8} color={VERDES[i % VERDES.length] ?? '#3f7440'} />
        ))
      : tipo === 1
        ? // roseta de suculenta
          Array.from({ length: 12 }, (_, i) => (
            <Hoja key={i} x={100} y={136} largo={30 + (i % 2) * 8} ancho={9} rot={-78 + i * 14} color={i % 2 ? '#9dc093' : '#5b8c52'} />
          ))
        : // espigas tipo sansevieria
          Array.from({ length: 6 }, (_, i) => (
            <Hoja key={i} x={100} y={140} largo={70 + rnd() * 30} ancho={7} rot={-30 + i * 12} color={VERDES[(i + 1) % VERDES.length] ?? '#3f7440'} />
          ));
  return (
    <>
      {hojas}
      <path d="M66 138 L134 138 L124 188 L76 188 Z" fill={ARCILLA} />
      <rect x={62} y={132} width={76} height={12} rx={4} fill={ARCILLA_OSCURA} />
      <ellipse cx={100} cy={190} rx={30} ry={4} fill="#000" opacity={0.08} />
    </>
  );
}

function Sobre({ rnd, colores }: { rnd: () => number; colores: readonly string[] }) {
  const color = colores[0] ?? '#e0a93b';
  const semillas = Array.from({ length: 6 }, () => ({ x: 40 + rnd() * 120, y: 170 + rnd() * 18, rot: rnd() * 180 }));
  return (
    <>
      <g transform="rotate(-4 100 100)">
        <rect x={54} y={34} width={92} height={128} rx={6} fill="#fdfbf6" stroke="#e3dccb" strokeWidth={2} />
        <path d="M54 34 H146 V52 H54 Z" fill={color} />
        <path d="M54 52 q 46 14 92 0" fill="none" stroke="#e3dccb" strokeWidth={2} strokeDasharray="3 4" />
        <circle cx={100} cy={100} r={26} fill={color} opacity={0.18} />
        <path d="M100 126 V96" stroke="#3f7440" strokeWidth={3} strokeLinecap="round" />
        <ellipse cx={90} cy={96} rx={11} ry={6} fill="#5b8c52" transform="rotate(-30 90 96)" />
        <ellipse cx={111} cy={90} rx={11} ry={6} fill="#3f7440" transform="rotate(30 111 90)" />
        <rect x={68} y={138} width={64} height={5} rx={2.5} fill="#e3dccb" />
        <rect x={78} y={148} width={44} height={5} rx={2.5} fill="#efe6d2" />
      </g>
      {semillas.map((s, i) => (
        <ellipse key={i} cx={s.x} cy={s.y} rx={3.4} ry={2} fill="#7a5410" transform={`rotate(${s.rot} ${s.x} ${s.y})`} />
      ))}
    </>
  );
}

export function BotanicalArt({ forma, semilla, colores = [], etiqueta, variante, className }: Props) {
  const rnd = prng(hash(`${forma}:${semilla}`));
  const idFondo = useId();
  const decorativo = !etiqueta;
  return (
    <svg
      viewBox="0 0 200 200"
      className={cn('h-full w-full', className)}
      role={decorativo ? undefined : 'img'}
      aria-label={etiqueta}
      aria-hidden={decorativo ? true : undefined}
      focusable="false"
    >
      <defs>
        <radialGradient id={idFondo} cx="50%" cy="42%" r="70%">
          <stop offset="0%" stopColor="#fdfbf6" />
          <stop offset="100%" stopColor="#efe6d2" />
        </radialGradient>
      </defs>
      <rect width={200} height={200} fill={`url(#${idFondo})`} />
      <circle cx={100} cy={104} r={74} fill="#e0ebdb" opacity={0.55} />
      {forma === 'ramo' && <Ramo rnd={rnd} colores={colores} />}
      {forma === 'planta' && <Planta rnd={rnd} semilla={semilla} variante={variante} />}
      {forma === 'sobre' && <Sobre rnd={rnd} colores={colores} />}
    </svg>
  );
}
