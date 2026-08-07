// Single source of truth for the Russian-speaking-realtor page's FAQ —
// both the visible accordion (RussianFAQAccordion.jsx) and the FAQPage
// JSON-LD (injected into the static prerendered build by
// tools/seo-prerender.js, for the /russian-speaking-realtor-temecula/
// route only) read from this same array. Mirrors src/data/homepage-faq.js's
// exact pattern -- text cannot drift between what a visitor sees and what
// the schema claims, because there is only one place it's written.
//
// Extracted 2026-08-07 (Batch A, AI SEO audit item 3) from
// RussianFAQAccordion.jsx's previously inline `const faqs = [...]` array --
// moved verbatim, no wording changes. 5 questions, all in Russian, matching
// the page's own language.
export const RUSSIAN_FAQ = [
  {
    question: 'Сколько стоят ваши услуги для покупателя?',
    answer: 'Для покупателей мои услуги абсолютно бесплатны. Комиссию риэлтору традиционно оплачивает продавец недвижимости.',
  },
  {
    question: 'Как долго длится процесс покупки дома?',
    answer: 'В среднем, с момента нахождения идеального дома до закрытия сделки (Escrow) проходит от 30 до 45 дней, в зависимости от условий финансирования.',
  },
  {
    question: 'Вы работаете только в Темекуле?',
    answer: 'Нет, я также активно работаю в Мурриете, Винной Стране (Wine Country), Фолбруке, Менифи и других прилегающих городах Южной Калифорнии.',
  },
  {
    question: 'Нужно ли мне предварительное одобрение ипотеки?',
    answer: 'Да, предварительное одобрение (Pre-approval) критически важно. Это показывает продавцам серьезность ваших намерений и помогает нам понимать ваш точный бюджет.',
  },
  {
    question: 'Могу ли я купить дом дистанционно?',
    answer: 'Абсолютно. Я регулярно провожу подробные видео-туры для своих клиентов, проверяю каждую деталь дома и помогаю с электронным оформлением всех документов.',
  },
];

// Pure transform, no I/O -- mirrors buildHomepageFaqJsonLd()'s exact shape
// and the @id-suffix convention already used by every other page-scoped
// entity in the shared schema graph (#person, #agent, #website, #webpage,
// #faq for the homepage's own FAQ).
export function buildRussianFaqJsonLd(faq = RUSSIAN_FAQ) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': 'https://temeculavalleyhomes.us/russian-speaking-realtor-temecula/#faq',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
