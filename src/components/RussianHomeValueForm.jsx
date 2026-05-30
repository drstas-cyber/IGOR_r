import { resetFormTimer } from '@/lib/antispam';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { submitLead } from '@/lib/submitLead';

export default function RussianHomeValueForm() {
  const { toast } = useToast();
  React.useEffect(() => { resetFormTimer(); }, []);
  const [formData, setFormData] = useState({
    address: '',
    name: '',
    phone: '',
    timeline: '',
    website_url: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.address || !formData.name || !formData.phone) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, заполните все обязательные поля.",
        variant: "destructive",
      });
      return;
    }

    const result = await submitLead({
      form_name: 'home_value_russian',
      raw: {
        name:             formData.name,
        phone:            formData.phone,
        property_address: formData.address,
        timeline:         formData.timeline,
        website_url:      formData.website_url,
      },
      extra: { inquiry_type: 'russian_home_valuation' },
    });

    if (result.ok) {
      toast({
        title: "Запрос отправлен!",
        description: "Джордж подготовит оценку вашего дома и свяжется с вами в течение 24 часов.",
      });
      setFormData({ address: '', name: '', phone: '', timeline: '', website_url: '' });
    } else if (result.reason === 'blocked') {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, используйте действительный email.",
        variant: "destructive",
      });
    } else {
      // Russian-localized send-failure recovery copy. George's number stays in English
      // numerals — easier to dial than Cyrillic transcription.
      toast({
        title: "Не удалось отправить — позвоните Джорджу",
        description: `Не удалось доставить запрос. Пожалуйста, позвоните напрямую: (619) 277-2766.`,
        variant: "destructive",
      });
    }
  };

  const inputClasses = "w-full bg-[#FAF6EF] text-[#12202A] h-12 border border-gray-200 focus:border-[#C8920A] focus:ring-1 focus:ring-[#C8920A] focus-visible:ring-[#C8920A] transition-all text-[15px] rounded-md px-3";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <input
          type="text"
          name="website_url"
          tabIndex="-1"
          autoComplete="off"
          value={formData.website_url}
          onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
        />
      </div>
      <div>
        <Input
          placeholder="Адрес дома (например: 123 Main St, Temecula)"
          className={inputClasses}
          value={formData.address}
          onChange={(e) => setFormData({...formData, address: e.target.value})}
          required
        />
      </div>
      <div>
        <Input
          placeholder="Ваше имя"
          className={inputClasses}
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
      </div>
      <div>
        <Input
          type="tel"
          placeholder="Номер телефона"
          className={inputClasses}
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          required
        />
      </div>
      <div>
        <select
          aria-label="Когда вы планируете продавать?"
          className={`w-full bg-[#FAF6EF] text-[#12202A] h-12 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:border-[#C8920A] focus:ring-1 focus:ring-[#C8920A] transition-all text-[15px] ${formData.timeline === '' ? 'text-gray-500' : ''}`}
          value={formData.timeline}
          onChange={(e) => setFormData({...formData, timeline: e.target.value})}
          required
        >
          <option value="" disabled>Когда вы планируете продавать?</option>
          <option value="curious">Просто интересуюсь</option>
          <option value="1-3">1-3 месяца</option>
          <option value="3-6">3-6 месяцев</option>
          <option value="6-12">6-12 месяцев</option>
          <option value="over-1">Более года</option>
        </select>
      </div>

      <Button
        type="submit"
        className="w-full bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] h-12 rounded font-bold text-[16px] transition-colors mt-2 shadow-md"
      >
        Получить оценку дома
      </Button>
    </form>
  );
}
