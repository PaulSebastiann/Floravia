import type { MDXComponents } from 'mdx/types';
import Link from 'next/link';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: (p) => <h2 className="mb-3 mt-10 font-display text-2xl font-semibold text-moss-900" {...p} />,
    h3: (p) => <h3 className="mb-2 mt-8 font-display text-xl font-semibold text-moss-900" {...p} />,
    p: (p) => <p className="my-4 text-lg leading-relaxed text-ink" {...p} />,
    ul: (p) => <ul className="my-4 list-disc space-y-2 pl-6 text-lg marker:text-moss-600" {...p} />,
    ol: (p) => <ol className="my-4 list-decimal space-y-2 pl-6 text-lg marker:text-moss-600" {...p} />,
    strong: (p) => <strong className="font-semibold text-moss-900" {...p} />,
    blockquote: (p) => <blockquote className="my-6 rounded-r-2xl border-l-4 border-petal-400 bg-petal-100/60 px-5 py-4 text-ink" {...p} />,
    a: ({ href = '', ...p }) => <Link href={href} className="font-medium text-moss-700 underline underline-offset-4" {...p} />,
    ...components,
  };
}
