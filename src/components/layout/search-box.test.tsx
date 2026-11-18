import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sugerencia } from '@/domain/puertos/producto-repositorio';
import { SearchBox, type BuscarSugerencias } from './search-box';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const DATOS: Sugerencia[] = [
  { slug: 'ramo-aurora', nombre: 'Ramo Aurora', linea: 'ramos' },
  { slug: 'ramo-girasol', nombre: 'Ramo Girasol', linea: 'ramos' },
];

const montar = (buscar: BuscarSugerencias) => {
  render(<SearchBox buscar={buscar} debounceMs={0} />);
  return screen.getByRole('combobox');
};

beforeEach(() => push.mockReset());

describe('SearchBox', () => {
  it('no consulta con menos de 2 caracteres', async () => {
    const buscar = vi.fn<BuscarSugerencias>().mockResolvedValue(DATOS);
    const input = montar(buscar);
    await userEvent.type(input, 'r');
    await new Promise((r) => setTimeout(r, 30));
    expect(buscar).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('muestra sugerencias, expone ARIA de combobox y navega con flechas + Enter', async () => {
    const buscar = vi.fn<BuscarSugerencias>().mockResolvedValue(DATOS);
    const input = montar(buscar);
    await userEvent.type(input, 'ram');
    const lista = await screen.findByRole('listbox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', lista.id);
    expect(await screen.findAllByRole('option')).toHaveLength(3); // 2 + "Ver todos"

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const activa = screen.getAllByRole('option')[1]!;
    expect(activa).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', activa.id);

    await userEvent.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/producto/ramo-girasol');
  });

  it('Enter sin opcion activa lleva al catalogo con la busqueda codificada', async () => {
    const input = montar(vi.fn<BuscarSugerencias>().mockResolvedValue([]));
    await userEvent.type(input, 'rosa & lirio');
    await userEvent.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/catalogo?q=rosa+%26+lirio');
  });

  it('Escape cierra el panel sin borrar el texto', async () => {
    const input = montar(vi.fn<BuscarSugerencias>().mockResolvedValue(DATOS));
    await userEvent.type(input, 'ram');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input).toHaveValue('ram');
  });

  it('cancela la peticion anterior al seguir escribiendo (sin resultados desordenados)', async () => {
    const senales: AbortSignal[] = [];
    const buscar: BuscarSugerencias = (_q, signal) => {
      senales.push(signal);
      return new Promise(() => {}); // nunca resuelve
    };
    const input = montar(buscar);
    await userEvent.type(input, 'ra');
    await waitFor(() => expect(senales.length).toBe(1));
    await userEvent.type(input, 'm');
    await waitFor(() => expect(senales.length).toBe(2));
    expect(senales[0]!.aborted).toBe(true);
    expect(senales[1]!.aborted).toBe(false);
  });

  it('un fallo de red muestra mensaje y no rompe la busqueda por Enter', async () => {
    const input = montar(vi.fn<BuscarSugerencias>().mockRejectedValue(new Error('HTTP 500')));
    await userEvent.type(input, 'ram');
    expect(await screen.findByText(/No pudimos cargar sugerencias/)).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/catalogo?q=ram');
  });

  it('una respuesta tardia NO borra la opcion que el usuario ya eligio con el teclado', async () => {
    const buscar = vi.fn<BuscarSugerencias>().mockResolvedValue(DATOS);
    const input = montar(buscar);
    await userEvent.type(input, 'ram');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{ArrowDown}');
    const antes = screen.getAllByRole('option')[0]!;
    expect(antes).toHaveAttribute('aria-selected', 'true');

    // El usuario sigue escribiendo: llega una nueva respuesta con los mismos resultados.
    await userEvent.type(input, 'a');
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(3)); // 'ra', 'ram', 'rama'
    await new Promise((r) => setTimeout(r, 30));

    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/producto/ramo-aurora');
  });
});
