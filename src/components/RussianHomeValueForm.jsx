import { validateSubmission, resetFormTimer } from '@/lib/antispam';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { trackFormSubmission } from '@/lib/tracking';

export default function RussianHomeValueForm() {
  const { toast } = useToast();
  React.useEffect(() => { resetFormTimer(); }, []);
  const [formData, setFormData] = useState({
    address: '',
    name: '',
    phone: '',
    timeline: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const _fd = new FormData(e.target); const _check = validateSubmission({ email: _fd.get("email"), name: _fd.get("name"), website_url: _fd.get("website_url") }); if (_check.blocked) { alert("Please use a valid email address."); return; }
    if (!formData.address || !formData.name || !formData.phone) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, заполните все обязательные поля.",
        variant: "destructive"
      });
      return;
    }

    const submission = new FormData();
    submission.append('property_address', formData.address);
    submission.append('name', formData.name);
    submission.append('phone', formData.phone);
    submission.append('timeline', formData.timeline);
    submission.append('_subject', 'Russian Home Value Request: ' + formData.name);
    submission.append('_replyto', 'george@temeculavalleyhomes.us');
    submission.append('_captcha', 'false');

    try {
      const response = await fetch("https://formsubmit.co/askgeorgek@gmail.com", {
        method: "POST",
        body: submission,
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        trackFormSubmission('home_value_russian', { form_name: 'russian_home_valuation' });
        toast({
          title: "Запрос отправлен!",
          description: "Джордж подготовит оценку вашего дома и свяжется с вами в течение 24 часов.",
        });
        setFormData({ address: '', name: '', phone: '', timeline: '' });
      } else {
        toast({
          title: "Ошибка",
          description: "Произошла ошибка при отправке. Попробуйте ещё раз.",
          variant: "destructive"
        });
      }
    } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось подключиться к серверу. Попробуйте позже.",
        variant: "destructive"
      });
    }
  };

  const inputClasses = "w-full bg-[#FAF6EF] text-[#12202A] h-12 border border-gray-200 focus:border-[#C8920A] focus:ring-1 focus:ring-[#C8920A] focus-visible:ring-[#C8920A] transition-all text-[15px] rounded-md px-3";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <input type="text" name="website_url" tabIndex="-1" autoComplete="off" />
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
