import { resetFormTimer } from '@/lib/antispam';
import React from 'react';
import { useToast } from '@/components/ui/use-toast';
import { submitLead } from '@/lib/submitLead';

export default function SellForm() {
  const { toast } = useToast();
  React.useEffect(() => { resetFormTimer(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const result = await submitLead({
      form_name: 'seller_lead',
      raw: formData,
      extra: { inquiry_type: 'sell_form' },
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

  const inputClasses = "w-full bg-white text-secondary px-4 py-3 min-h-[44px] border border-gray-200 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[15px] font-light";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-6">
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
        <input type="tel" name="phone" placeholder="(619) 277-2766" className={inputClasses} />
      </div>
      <div>
        <input required type="email" name="email" placeholder="your@email.com" className={inputClasses} />
      </div>
      <div>
        <select name="timeline" aria-label="Selling timeline" className={inputClasses} defaultValue="">
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
      
      <p className="text-center text-[13px] text-gray-600 mt-3 font-light">
        ✓ Licensed Realtor® &nbsp; ✓ 24-hour response &nbsp; ✓ No obligation
      </p>
    </form>
  );
}