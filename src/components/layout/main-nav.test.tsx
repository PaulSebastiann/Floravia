import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MainNav, RETARDO_CIERRE_MS } from './main-nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const boton = () => screen.getByRole('button', { name: /^Plantas/ });
const abierto = () => boton().getAttribute('aria-expanded') === 'true';
const avanzar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/** Sale del elemento hacia "ninguna parte" (p. ej. el hueco entre boton y panel). */
const salir = (el: Element) => fireEvent.mouseOut(el, { relatedTarget: document.body });
/** Entra al elemento viniendo de fuera del menu. */
const entrar = (el: Element) => fireEvent.mouseOver(el, { relatedTarget: document.body });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('MainNav: mega menu con hover', () => {
  it('se abre al pasar el mouse por el boton', () => {
    render(<MainNav />);
    entrar(boton());
    expect(abierto()).toBe(true);
  });

  it('REGRESION: no se cierra si el mouse cruza el hueco y llega al panel antes del retardo', () => {
    render(<MainNav />);
    entrar(boton());
    salir(boton());                              // el mouse esta en el hueco entre boton y panel
    avanzar(RETARDO_CIERRE_MS - 50);
    expect(abierto()).toBe(true);                // sigue abierto durante el cruce

    entrar(screen.getByRole('link', { name: 'Fácil' }));  // llega al panel
    avanzar(1000);
    expect(abierto()).toBe(true);                // y el cierre pendiente quedo cancelado
  });

  it('se cierra cuando el mouse realmente se va', () => {
    render(<MainNav />);
    entrar(boton());
    salir(boton());
    avanzar(RETARDO_CIERRE_MS + 10);
    expect(abierto()).toBe(false);
  });

  it('el puente invisible existe solo mientras el menu esta abierto y no es accesible', () => {
    const { container } = render(<MainNav />);
    expect(container.querySelector('[data-puente]')).toBeNull();
    entrar(boton());
    const puente = container.querySelector('[data-puente]');
    expect(puente).not.toBeNull();
    expect(puente).toHaveAttribute('aria-hidden', 'true');
  });

  it('cambiar de un menu a otro es inmediato y no deja el anterior abierto', () => {
    render(<MainNav />);
    entrar(boton());
    const otro = screen.getByRole('button', { name: /^Semillas/ });
    salir(boton());
    entrar(otro);
    expect(otro).toHaveAttribute('aria-expanded', 'true');
    expect(abierto()).toBe(false);
  });

  it('Escape cierra de inmediato, sin esperar el retardo', () => {
    render(<MainNav />);
    entrar(boton());
    fireEvent.keyDown(boton(), { key: 'Escape' });
    expect(abierto()).toBe(false);
  });
});
