import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export interface FaqData { pregunta: string; respuesta: string }

export function Faq({ items }: { items: readonly FaqData[] }) {
  return (
    <Accordion type="single" collapsible className="mx-auto max-w-3xl border-t border-line">
      {items.map((it) => (
        <AccordionItem key={it.pregunta} value={it.pregunta}>
          <AccordionTrigger>{it.pregunta}</AccordionTrigger>
          <AccordionContent>{it.respuesta}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
