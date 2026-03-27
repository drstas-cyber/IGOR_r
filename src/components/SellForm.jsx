import React from 'react';
import { useToast } from '@/components/ui/use-toast';
import { trackFormSubmission } from '@/lib/tracking';

export default function SellForm() {
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    formData.append('_subject', 'New Seller Lead: ' + (formData.get('name') || 'Unknown'));
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
        trackFormSubmission('seller_lead', { form_name: 'sell_form' });
        toast({
          title: "Request Sent!",
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

  const inputClasses = "w-full bg-white text-secondary px-4 py-3 min-h-[44px] border border-gray-200 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[15px] font-light";

  return (
    <form onSubmit={handleSubmit} action="https://formsubmit.co/askgeorgek@gmail.com" method="POST" className="space-y-4 mt-6">
      <input type="hidden" name="_replyto" value="george@temeculavalleyhomes.us" />
      
      <div>
        <input required type="text" name="property_address" placeholder="123 Main St, Temecula, CA" className={inputClasses} />
      </div>
      <div>
        <input required type="text" name="name" placeholder="Your Name" className={inputClasses} />
      </div>
      <div>
        <input type="tel" name="phone" placeholder="(619) 277-2766" className={inputClasses} />
      </div>
      <div>
        <input required type="email" name="email" placeholder="your@email.com" className={inputClasses} />
      </div>
      <div>
        <select name="timeline" className={inputClasses} defaultValue="">
          <option value="" disabled>Timeline</option>
          <option value="immediate">Immediate</option>
          <option value="1-3">1 - 3 months</option>
          <option value="3-6">3 - 6 months</option>
          <option value="6+">6+ months</option>
        </select>
      </div>
      
      <button 
        type="submit" 
        className="w-full bg-[#8B3018] hover:bg-[#702613] text-white py-3.5 min-h-[48px] rounded font-medium text-[16px] transition-colors mt-2 shadow-md"
      >
        Get My Free Valuation →
      </button>
      
      <p className="text-center text-[13px] text-gray-500 mt-3 font-light">
        ✓ Licensed Realtor® &nbsp; ✓ 24-hour response &nbsp; ✓ No obligation
      </p>
    </form>
  );
}