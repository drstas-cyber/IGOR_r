import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { submitLead } from '@/lib/submitLead';
import { resetFormTimer } from '@/lib/antispam';

export default function ContactForm() {
  const { toast } = useToast();
  React.useEffect(() => { resetFormTimer(); }, []);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    website_url: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await submitLead({
      form_name: 'contact',
      raw: formData,
      extra: { inquiry_type: formData.subject || 'general' },
    });

    if (result.ok) {
      toast({
        title: "Success!",
        description: "Thank you! George will contact you within 24 hours. (619) 277-2766",
      });
      setFormData({ name: '', email: '', phone: '', subject: '', message: '', website_url: '' });
    } else if (result.reason === 'blocked') {
      toast({
        title: "Unable to submit",
        description: "Please use a valid email address.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Could not deliver — please call George",
        description: result.recoveryMessage,
        variant: "destructive",
      });
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <motion.section 
      id="contact"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Get Your Free Strategy Session</h2>
        <div className="h-1 w-16 bg-gradient-to-r from-blue-900 to-yellow-500 rounded-full" />
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        Tell George what you need. He responds within 2 hours, 7 days a week.
      </p>
      
      <form id="contact-form" onSubmit={handleSubmit} className="space-y-4">
        <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
          <input type="text" name="website_url" tabIndex="-1" autoComplete="off"
            value={formData.website_url}
            onChange={(e) => setFormData({ ...formData, website_url: e.target.value })} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
            />
          </div>
        </div>
        
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-3 py-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
            />
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
              Interested In
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Buying in Temecula, Selling in Murrieta..."
              className="w-full px-3 py-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            How can I help?
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows="4"
            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base resize-none"
          />
        </div>
        
        <div className="flex justify-end">
          <Button type="submit" form="contact-form" className="w-full bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] font-bold py-6 text-[16px]">
            Get My Free Consultation
          </Button>
        </div>
      </form>
    </motion.section>
  );
}