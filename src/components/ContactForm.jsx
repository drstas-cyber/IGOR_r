import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { trackFormSubmission } from '@/lib/tracking';
import { validateSubmission, resetFormTimer } from '@/lib/antispam';

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

    const check = validateSubmission(formData);
    if (check.blocked) { toast({ title: "Unable to submit", description: "Please use a valid email address.", variant: "destructive" }); return; }

    const submissionData = new FormData();
    Object.keys(formData).forEach(key => {
      if (key !== 'website_url') submissionData.append(key, formData[key]);
    });
    submissionData.append('_replyto', 'george@temeculavalleyhomes.us');
    submissionData.append('_subject', 'New Contact: ' + (formData.name || 'Unknown'));
    submissionData.append('_captcha', 'false');

    try {
      const response = await fetch("https://formsubmit.co/askgeorgek@gmail.com", {
        method: "POST",
        headers: {
          'Accept': 'application/json'
        },
        body: submissionData
      });

      if (response.ok) {
        trackFormSubmission('contact', { form_name: formData.subject || 'general' });
        toast({
          title: "Success!",
          description: "Thank you! George will contact you within 24 hours. 619-277-2766",
        });

        // Reset form
        setFormData({
          name: '',
          email: '',
          phone: '',
          subject: '',
          message: ''
        });
      } else {
        toast({
          title: "Error",
          description: "There was a problem submitting your form. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "There was a problem submitting your form.",
        variant: "destructive"
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
      
      <form id="contact-form" onSubmit={handleSubmit} action="https://formsubmit.co/askgeorgek@gmail.com" method="POST" className="space-y-4">
        <input type="hidden" name="_replyto" value="george@temeculavalleyhomes.us" />
        
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