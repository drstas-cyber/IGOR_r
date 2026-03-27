import React from 'react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

export default function ListingAlertsSection() {
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    formData.append('_subject', 'New Alert Signup: ' + (formData.get('name') || 'Unknown'));
    formData.append('_replyto', 'george@temeculavalleyhomes.us');
    formData.append('_captcha', 'false');

    try {
      const response = await fetch("https://formsubmit.co/askgeorgek@gmail.com", {
        method: "POST",
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Thank you! George will contact you within 24 hours. 619-277-2766",
        });
        form.reset();
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

  const inputClasses = "w-full bg-[#FAF6EF] text-[#12202A] placeholder:text-[#A0A0A0] border border-gray-300 focus:border-[#C8920A] focus:ring-1 focus:ring-[#C8920A] outline-none rounded-md px-[16px] py-[14px] font-sans text-[14px] transition-colors";

  return (
    <section id="listing-alerts" className="bg-[#0D2E3A] py-[60px] px-[24px] lg:px-[80px] w-full">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <span className="font-sans text-[12px] text-[#C8920A] uppercase tracking-[2px] font-semibold block mb-3">
            Never Miss A Home
          </span>
          <h2 className="font-serif text-[40px] md:text-[48px] text-white font-semibold leading-tight mb-4">
            Get New Listings Before Anyone Else
          </h2>
          <p className="font-sans text-[16px] text-[#E0E0E0] leading-[1.6] max-w-2xl mx-auto">
            Instant alerts the moment a home hits the market in your target area — hours before Zillow or Redfin. Free. No obligation. Cancel anytime.
          </p>
        </motion.div>

        <motion.form 
          id="listing-alerts-form"
          onSubmit={handleSubmit}
          action="https://formsubmit.co/askgeorgek@gmail.com"
          method="POST"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-5xl mx-auto"
        >
          <input type="hidden" name="_replyto" value="george@temeculavalleyhomes.us" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <input 
              required 
              type="text" 
              name="name"
              placeholder="Your Name" 
              className={inputClasses}
            />
            <input 
              required 
              type="email" 
              name="email"
              placeholder="your@email.com" 
              className={inputClasses}
            />
            <input 
              required 
              type="tel" 
              name="phone"
              placeholder="(619) 277-2766" 
              className={inputClasses}
            />
            <input 
              required 
              type="text" 
              name="property_address"
              placeholder="e.g., Wolf Creek, 92591" 
              className={inputClasses}
            />
          </div>

          <div className="text-center">
            <button 
              type="submit"
              form="listing-alerts-form"
              className="w-full lg:w-auto bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] font-sans text-[16px] font-bold py-[16px] px-[32px] rounded-md transition-all shadow-lg hover:shadow-xl"
            >
              🔔 Send Me New Listings Instantly
            </button>
            <p className="font-sans text-[12px] text-[#A0A0A0] mt-4">
              🔒 No spam. Your info is private. Unsubscribe anytime. — George Khazanovskiy, DRE #02034120
            </p>
          </div>
        </motion.form>
      </div>
    </section>
  );
}