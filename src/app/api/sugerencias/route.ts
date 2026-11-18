import { NextResponse } from 'next/server';
import { obtenerRepositorio } from '@/infrastructure/repositorio';

const LIMITE_Q = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  if (q.length > LIMITE_Q) {
    return NextResponse.json({ status: 400, title: 'Parametro q demasiado largo' }, { status: 400 });
  }
  try {
    const sugerencias = await obtenerRepositorio().sugerir(q.trim(), 6, req.signal);
    return NextResponse.json(sugerencias, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    // Sin detalles internos al cliente.
    return NextResponse.json({ status: 500, title: 'No se pudieron obtener sugerencias' }, { status: 500 });
  }
}
