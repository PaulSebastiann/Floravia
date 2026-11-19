import { Flower2 } from 'lucide-react';
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { SITIO } from '@/content/sitio';
import { CartDrawer } from './cart-drawer';
import { MainNav } from './main-nav';
import { MenuCuenta } from './menu-cuenta';
import { MobileNav } from './mobile-nav';
import { SearchBox } from './search-box';

export function AnnouncementBar() {
  return (
    <div className="bg-moss-800 text-cream-50">
      <Container className="flex items-center justify-center gap-2 py-2 text-center text-sm">
        <span>Entrega a domicilio en Quito</span>
        <span aria-hidden="true">·</span>
        <span className="hidden sm:inline">Atención personalizada por WhatsApp</span>
      </Container>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream-50/90 backdrop-blur supports-[backdrop-filter]:bg-cream-50/80">
      <Container className="relative flex flex-wrap items-center gap-x-4 gap-y-3 py-3 lg:flex-nowrap">
        <MobileNav />
        <Link href="/" className="mr-auto flex items-center gap-2 lg:mr-4" aria-label={`${SITIO.nombre}, ir al inicio`}>
          <Flower2 className="size-7 text-petal-700" aria-hidden="true" />
          <span className="font-display text-2xl font-semibold text-moss-900">{SITIO.nombre}</span>
        </Link>
        <MainNav />
        <SearchBox className="order-last w-full lg:order-none lg:ml-auto lg:w-44 xl:w-72" />
        <MenuCuenta />
        <CartDrawer />
      </Container>
    </header>
  );
}
