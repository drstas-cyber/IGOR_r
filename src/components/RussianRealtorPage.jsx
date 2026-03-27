import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import RussianHeader from './RussianHeader';
import RussianFeatureCard from './RussianFeatureCard';
import RussianServiceCard from './RussianServiceCard';
import RussianReviewCard from './RussianReviewCard';
import RussianFAQAccordion from './RussianFAQAccordion';
import RussianHomeValueForm from './RussianHomeValueForm';
import Footer from './Footer';

export default function RussianRealtorPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleCall = () => {
    window.location.href = "tel:6192772766";
  };

  const handleEmail = () => {
    window.location.href = "mailto:george@temeculavalleyhomes.us";
  };

  const handleAction = (feature) => {
    const targets = {
      'search': 'home-value',
      'neighborhoods': 'home-value',
      'home-value': 'home-value',
      'about': 'about',
    };
    const el = document.getElementById(targets[feature] || 'home-value');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const whyGeorgeFeatures = [
    { icon: "🥇", title: "Только один", description: "Единственный русскоязычный риэлтор в долине Темекула с глубоким знанием местного рынка." },
    { icon: "⭐", title: "5.0★ отзывов", description: "Исключительно положительные отзывы от десятков довольных семей в Южной Калифорнии." },
    { icon: "📅", title: "14+ лет", description: "Более десятилетия опыта в недвижимости, инвестициях и сложных переговорах." },
    { icon: "🗣️", title: "Двуязычный", description: "Свободно владею русским, украинским и английским. Никаких языковых барьеров." },
    { icon: "📝", title: "Сделки на русском", description: "Полное объяснение всех контрактов, инспекций и эскроу на вашем родном языке." },
    { icon: "⚡", title: "24/7 доступен", description: "Всегда на связи для ответов на ваши вопросы и показа горячих объектов." }
  ];

  const services = [
    { icon: "🏠", title: "Покупка дома", description: "Помощь в поиске идеального дома для вашей семьи, организация просмотров и ведение переговоров о лучшей цене." },
    { icon: "💰", title: "Продажа дома", description: "Профессиональный маркетинг, качественные фото и стратегическое ценообразование для продажи по максимальной цене." },
    { icon: "📊", title: "Оценка стоимости", description: "Точный сравнительный анализ рынка (CMA), чтобы вы знали реальную стоимость вашей недвижимости сегодня." },
    { icon: "🌐", title: "Инвестиции", description: "Поиск высокодоходной недвижимости, анализ арендных ставок и помощь в создании портфеля в Винной Стране." }
  ];

  const reviews = [
    { text: "George was always available to answer any questions we had. He made the process of buying our first home so smooth and stress-free. Highly recommend his services to anyone looking in Temecula!", name: "V.V. — Viacheslav", details: "Купили дом в Темекуле, Калифорния" },
    { text: "As first-time homebuyers, we were nervous about the process. George guided us every step of the way, explaining everything clearly in both English and Russian. We couldn't be happier with our new home!", name: "Viktor Smirnov", details: "Купили дом в Мурриете, Калифорния" },
    { text: "The market was very competitive, but George's negotiation skills helped us get our dream home below asking price. His knowledge of the local wine country area is unmatched.", name: "Alina Kompaniyets", details: "Купили дом в Temecula Wine Country" }
  ];

  return (
    <div className="min-h-screen font-sans bg-background text-foreground selection:bg-primary selection:text-white">
      <Helmet>
        <html lang="ru" />
        <title>Русскоязычный риэлтор в Темекуле | Джордж Хазановский | DRE #02034120</title>
        <link rel="canonical" href="https://temeculavalleyhomes.us/russian-speaking-realtor-temecula" />
        <meta name="description" content="Единственный русскоязычный риэлтор в долине Темекула. Джордж Хазановский помогает русскоязычным семьям покупать и продавать дома. Бесплатная оценка дома. DRE #02034120." />
        <meta property="og:locale" content="ru_RU" />
        <meta property="og:title" content="Русскоязычный риэлтор в Темекуле | Джордж Хазановский" />
        <meta property="og:description" content="Единственный русскоязычный риэлтор в долине Темекула. Бесплатная оценка дома. DRE #02034120." />
        <meta property="og:image" content="https://temeculavalleyhomes.us/images/og-image.jpg" />
        <meta property="og:url" content="https://temeculavalleyhomes.us/russian-speaking-realtor-temecula" />
      </Helmet>

      <RussianHeader />

      {/* SECTION 1 (HERO) */}
      <section className="bg-[#FAF6EF] py-20 px-6 lg:px-8 flex items-center justify-center min-h-[70vh]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-3xl mb-6 space-x-4">🇷🇺 🇺🇦 🇺🇸</div>
            <h1 className="font-serif text-5xl md:text-[56px] text-[#12202A] leading-tight mb-6 font-bold">
              Ваш надёжный риэлтор в Темекуле, Калифорния
            </h1>
            <p className="font-sans text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Единственный русскоязычный риэлтор в долине Темекула. Я помогу вам купить дом мечты или выгодно продать вашу недвижимость без языковых барьеров.
            </p>
            <Button 
              onClick={handleCall}
              className="bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] text-lg font-bold px-8 py-6 rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              📞 Позвонить Джорджу — 619-277-2766
            </Button>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2 (UNIQUE POSITIONING) */}
      <section className="bg-[#0D2E3A] py-[60px] px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="font-serif text-[40px] text-white leading-tight"
          >
            В Темекуле только один русскоязычный риэлтор.
          </motion.h2>
        </div>
      </section>

      {/* SECTION 3 (WHY GEORGE) */}
      <section className="bg-[#FAF6EF] py-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-[48px] text-[#12202A] font-bold mb-4">Ваш успех — это наш приоритет</h2>
            <p className="font-sans text-[16px] text-gray-600">Почему семьи выбирают Джорджа</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyGeorgeFeatures.map((feature, i) => (
              <RussianFeatureCard key={i} index={i} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 (SERVICES) */}
      <section className="bg-[#0D2E3A] py-20 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-[48px] text-white font-bold mb-4">Покупка и продажа недвижимости по-русски</h2>
            <p className="font-sans text-[16px] text-gray-300">Полный спектр услуг для русскоязычных семей</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {services.map((service, i) => (
              <RussianServiceCard key={i} index={i} {...service} />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 (HOME VALUE FORM) */}
      <section className="bg-[#FAF6EF] py-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="w-full lg:w-1/2"
          >
            <h2 className="font-serif text-[48px] text-[#12202A] leading-tight font-bold mb-6">
              Ваш дом в Темекуле может стоить больше, чем вы думаете
            </h2>
            <p className="font-sans text-[16px] text-[#12202A] leading-relaxed mb-8">
              Рынок недвижимости в Южной Калифорнии постоянно меняется. Средние цены в Темекуле продолжают оставаться высокими. Получите точную, персонализированную оценку вашего дома абсолютно бесплатно и без обязательств.
            </p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="w-full lg:w-[450px]"
          >
            <div className="bg-white rounded-xl p-8 shadow-xl border border-gray-100">
              <RussianHomeValueForm />
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 6 (REVIEWS) */}
      <section className="bg-[#0D2E3A] py-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-[48px] text-white font-bold mb-4">Что говорят наши клиенты</h2>
            <p className="font-sans text-[16px] text-gray-300">Реальные отзывы от реальных клиентов</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {reviews.map((review, i) => (
              <RussianReviewCard key={i} index={i} {...review} />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7 (AGENT BIO) */}
      <section className="bg-[#FAF6EF] py-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-[48px] text-[#12202A] font-bold">Местный эксперт. Ваш язык. Ваш успех.</h2>
          </div>
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="w-full lg:w-1/3 flex flex-col items-center lg:items-start text-center lg:text-left"
            >
              <div className="w-[280px] h-[280px] rounded-full overflow-hidden mb-8 shadow-xl border-4 border-white">
                <img
                  src="/images/george-photo.jpg"
                  alt="Джордж Хазановский"
                  loading="lazy"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: '50% 15%' }}
                />
              </div>
              <h3 className="font-serif text-3xl text-[#12202A] font-bold mb-2">Джордж Хазановский</h3>
              <p className="font-sans text-[16px] text-gray-600 mb-6">Realtor® &middot; DRE #02034120</p>
              
              <div className="grid grid-cols-2 gap-3 mb-8 w-full">
                {['5.0★ Google Rating', '14+ Лет Опыта', 'Русский/Английский', '24/7 Поддержка'].map((stat, i) => (
                  <div key={i} className="bg-[#F5E6D3] text-[#12202A] text-[12px] py-2 px-3 rounded-full text-center font-medium">
                    {stat}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="w-full lg:w-2/3"
            >
              <p className="font-sans text-[16px] text-[#12202A] leading-relaxed mb-10">
                Покупка или продажа дома в США — это серьезный шаг, который требует не только финансовой подготовки, но и глубокого понимания местных законов, контрактов и нюансов. Моя цель — сделать этот процесс максимально прозрачным, безопасным и понятным для вас. Я говорю на вашем языке, понимаю ваши культурные ожидания и защищаю ваши интересы на каждом этапе сделки.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">📊</span>
                  <div>
                    <h4 className="font-sans text-[16px] font-bold text-[#12202A]">Данные MLS</h4>
                    <p className="font-sans text-[14px] text-gray-600">Доступ к закрытой базе объектов.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-3xl">🤝</span>
                  <div>
                    <h4 className="font-sans text-[16px] font-bold text-[#12202A]">Эксперт в переговорах</h4>
                    <p className="font-sans text-[14px] text-gray-600">Защита ваших финансовых интересов.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-3xl">🌐</span>
                  <div>
                    <h4 className="font-sans text-[16px] font-bold text-[#12202A]">Двуязычное обслуживание</h4>
                    <p className="font-sans text-[14px] text-gray-600">Все документы переведены и объяснены.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-3xl">⚡</span>
                  <div>
                    <h4 className="font-sans text-[16px] font-bold text-[#12202A]">Доступен 7 дней в неделю</h4>
                    <p className="font-sans text-[14px] text-gray-600">Работаю без выходных для вас.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION 8 (FAQ) */}
      <section className="bg-[#0D2E3A] py-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-[48px] text-white font-bold">Ответы на ваши вопросы</h2>
          </div>
          <RussianFAQAccordion />
        </div>
      </section>

      {/* SECTION 9 (CONTACT/CTA) */}
      <section className="bg-[#FAF6EF] py-24 px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="font-serif text-[48px] text-[#12202A] font-bold mb-4">Начните прямо сейчас</h2>
          <p className="font-sans text-[16px] text-gray-600 mb-10">Позвоните Джорджу для бесплатной консультации</p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <Button 
              onClick={handleCall}
              className="bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] font-bold text-lg px-8 py-6 rounded-lg shadow-md"
            >
              📞 Позвонить — 619-277-2766
            </Button>
            <Button 
              onClick={handleEmail}
              className="bg-[#8B3018] hover:bg-[#702613] text-white font-bold text-lg px-8 py-6 rounded-lg shadow-md"
            >
              💬 Написать письмо
            </Button>
          </div>
          <p className="font-sans text-[14px] text-gray-500">
            Доступен 7 дней в неделю &middot; Без обязательств &middot; Первая консультация бесплатна
          </p>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}