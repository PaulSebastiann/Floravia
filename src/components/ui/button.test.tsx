import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('con cargando no dispara onClick y expone aria-busy (evita doble envio)', async () => {
    const onClick = vi.fn();
    render(<Button cargando onClick={onClick}>Guardar</Button>);
    const btn = screen.getByRole('button', { name: 'Guardar' });
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('por defecto es type=button (no envia formularios por accidente)', () => {
    render(<Button>Ok</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('asChild conserva el enlace y no anida un button', () => {
    render(<Button asChild><a href="/plantas">Ver plantas</a></Button>);
    expect(screen.getByRole('link', { name: 'Ver plantas' })).toHaveAttribute('href', '/plantas');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
