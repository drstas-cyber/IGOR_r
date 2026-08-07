import React from 'react';
import { motion } from 'framer-motion';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { RUSSIAN_FAQ } from '@/data/russian-faq';

export default function RussianFAQAccordion() {
  // Single source of truth (2026-08-07, Batch A) -- src/data/russian-faq.js
  // also drives this page's FAQPage JSON-LD (tools/seo-prerender.js), so
  // the visible questions here and the schema can never drift apart.
  const faqs = RUSSIAN_FAQ;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-3xl mx-auto"
    >
      <Accordion type="single" collapsible className="w-full space-y-4">
        {faqs.map((faq, index) => (
          <AccordionItem key={index} value={`item-${index}`} className="border-none bg-[#FAF6EF] rounded-lg px-6 data-[state=open]:ring-2 data-[state=open]:ring-[#C8920A] transition-all">
            <AccordionTrigger className="font-sans text-[16px] text-[#12202A] font-bold hover:no-underline hover:text-[#C8920A] text-left transition-colors">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="font-sans text-[15px] text-[#12202A] pb-4 leading-relaxed">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </motion.div>
  );
}