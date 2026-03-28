import React from 'react';
import { motion } from 'framer-motion';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

export default function RussianFAQAccordion() {
  const faqs = [
    {
      question: "Сколько стоят ваши услуги для покупателя?",
      answer: "Для покупателей мои услуги абсолютно бесплатны. Комиссию риэлтору традиционно оплачивает продавец недвижимости."
    },
    {
      question: "Как долго длится процесс покупки дома?",
      answer: "В среднем, с момента нахождения идеального дома до закрытия сделки (Escrow) проходит от 30 до 45 дней, в зависимости от условий финансирования."
    },
    {
      question: "Вы работаете только в Темекуле?",
      answer: "Нет, я также активно работаю в Мурриете, Винной Стране (Wine Country), Фолбруке, Менифи и других прилегающих городах Южной Калифорнии."
    },
    {
      question: "Нужно ли мне предварительное одобрение ипотеки?",
      answer: "Да, предварительное одобрение (Pre-approval) критически важно. Это показывает продавцам серьезность ваших намерений и помогает нам понимать ваш точный бюджет."
    },
    {
      question: "Могу ли я купить дом дистанционно?",
      answer: "Абсолютно. Я регулярно провожу подробные видео-туры для своих клиентов, проверяю каждую деталь дома и помогаю с электронным оформлением всех документов."
    }
  ];

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