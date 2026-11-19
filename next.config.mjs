import createMDX from '@next/mdx';

const withMDX = createMDX({});

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // El comprobante de transferencia admite hasta 5 MB (limite de la API); el valor por defecto de Next es 1 MB.
    serverActions: { bodySizeLimit: '6mb' },
  },
  // Las fotos de producto las sirve la API bajo /media. Con este rewrite el navegador las pide al mismo origen
  // (sin CORS, sin exponer la URL interna de la API). NOTA: next.config se evalua al ARRANCAR/CONSTRUIR.
  async rewrites() {
    const api = process.env.FLORAVIA_API_URL?.trim().replace(/\/+$/, '');
    return api ? [{ source: '/media/:path*', destination: `${api}/media/:path*` }] : [];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withMDX(nextConfig);
