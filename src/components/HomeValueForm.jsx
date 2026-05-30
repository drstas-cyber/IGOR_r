import { resetFormTimer } from '@/lib/antispam';
import React from 'react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { submitLead } from '@/lib/submitLead';

export default function HomeValueForm() {
  const { toast } = useToast();
  React.useEffect(() => { resetFormTimer(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const result = await submitLead({
      form_name: 'home_value',
      raw: formData,
      extra: { inquiry_type: 'home_valuation' },
    });

    if (result.ok) {
      toast({
        title: "Request Sent!",
        description: "Thank you! George will contact you within 24 hours. (619) 277-2766",
      });
      form.reset();
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

  const inputClasses = "w-full bg-white text-[#12202A] px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-[#C8920A] focus:ring-1 focus:ring-[#C8920A] transition-colors text-[15px] font-light placeholder:text-gray-400";

  return (
    <section id="home-value" className="bg-[#0D2E3A] py-[60px] px-6 lg:px-[80px]">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
        
        {/* Left Content */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="w-full lg:w-1/2"
        >
          <span className="font-sans text-[12px] text-[#C8920A] uppercase tracking-[0.2em] font-semibold block mb-4">
            For Homeowners
          </span>
          <h2 className="font-serif text-[32px] sm:text-[42px] md:text-[48px] text-white leading-[1.1] mb-6">
            Your Temecula Home May Be Worth More Than You Think
          </h2>
          <p className="font-sans text-[16px] text-gray-200 leading-[1.6] mb-8 font-light">
            Know your home's current value with a free, expert-backed valuation from a local agent who knows your street — prepared within 24 hours.
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex gap-4 items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#C8920A]/20 text-[#C8920A] flex items-center justify-center text-sm font-bold mt-0.5">1</span>
              <p className="font-sans text-[14px] text-white">Enter your address — takes 30 seconds</p>
            </div>
            <div className="flex gap-4 items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#C8920A]/20 text-[#C8920A] flex items-center justify-center text-sm font-bold mt-0.5">2</span>
              <p className="font-sans text-[14px] text-white">George analyzes recent comparable sales in your neighborhood</p>
            </div>
            <div className="flex gap-4 items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#C8920A]/20 text-[#C8920A] flex items-center justify-center text-sm font-bold mt-0.5">3</span>
              <p className="font-sans text-[14px] text-white">Receive your report — free, no obligation, within 24 hours</p>
            </div>
          </div>

          <p className="font-sans text-[13px] sm:text-[12px] text-gray-400 italic">
            "No pushy follow-ups. No obligation to list. Just honest local expertise."
          </p>
        </motion.div>

        {/* Right Form */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full lg:w-[500px]"
        >
          <div className="bg-[#FAF6EF] rounded-[8px] p-8 md:p-[40px] shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
                <input type="text" name="website_url" tabIndex="-1" autoComplete="off" />
              </div>

              <div>
                <input required type="text" name="property_address" placeholder="123 Main St, Temecula, CA" className={inputClasses} />
              </div>
              <div>
                <input required type="text" name="name" placeholder="Your Name" className={inputClasses} />
              </div>
              <div>
                <input required type="email" name="email" placeholder="your@email.com" className={inputClasses} />
              </div>
              <div>
                <select required name="selling_timeline" aria-label="When are you thinking of selling?" className={inputClasses} defaultValue="">
                  <option value="" disabled className="text-gray-400">When Are You Thinking of Selling?</option>
                  <option value="curious">Just curious</option>
                  <option value="1-3">1-3 months</option>
                  <option value="3-6">3-6 months</option>
                  <option value="6-12">6-12 months</option>
                  <option value="over-1">Over 1 year out</option>
                </select>
              </div>
              
              <p className="font-sans text-[14px] sm:text-[13px] text-[#C8920A] font-semibold text-center mt-2">
                12 homeowners requested valuations this week
              </p>
              <button
                type="submit"
                className="w-full bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] py-4 rounded font-bold text-[16px] transition-colors mt-2 shadow-md"
              >
                Get My Free Home Value
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="font-sans text-[13px] sm:text-[12px] text-gray-500 leading-relaxed">
                Or call George: 619-277-2766<br/>
                Available 7 days a week &middot; Free consultation
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}