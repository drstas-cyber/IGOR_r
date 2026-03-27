import React from 'react';
import { useToast } from '@/components/ui/use-toast';
import { trackFormSubmission } from '@/lib/tracking';

export default function BuyForm() {
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    formData.append('_subject', 'New Buyer Lead: ' + (formData.get('name') || 'Unknown'));
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
        trackFormSubmission('buyer_lead', { form_name: 'buy_form' });
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

  const inputClasses = "w-full bg-white text-secondary px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm font-light";

  return (
    <form onSubmit={handleSubmit} action="https://formsubmit.co/askgeorgek@gmail.com" method="POST" className="space-y-4 mt-6">
      <input type="hidden" name="_replyto" value="george@temeculavalleyhomes.us" />
      
      <div>
        <input required type="text" name="name" placeholder="Your Name" className={inputClasses} />
      </div>
      <div>
        <input required type="tel" name="phone" placeholder="(619) 277-2766" className={inputClasses} />
      </div>
      <div>
        <input required type="email" name="email" placeholder="your@email.com" className={inputClasses} />
      </div>
      <div>
        <select name="neighborhood" className={inputClasses} defaultValue="">
          <option value="" disabled>Target Neighborhood / ZIP (optional)</option>
          <option value="wolf-creek">Wolf Creek</option>
          <option value="redhawk">Redhawk</option>
          <option value="wine-country">Wine Country Estates</option>
          <option value="paloma">Paloma del Sol</option>
          <option value="old-town">Old Town</option>
        </select>
      </div>
      <div>
        <select name="budget" className={inputClasses} defaultValue="">
          <option value="" disabled>Budget Range (optional)</option>
          <option value="300-500">$300K - $500K</option>
          <option value="500-750">$500K - $750K</option>
          <option value="750-1m">$750K - $1M</option>
          <option value="1m+">$1M+</option>
        </select>
      </div>
      
      <button 
        type="submit" 
        onClick={() => document.getElementById('listing-alerts')?.scrollIntoView({ behavior: 'smooth' })}
        className="w-full bg-[#8B3018] hover:bg-[#702613] text-white py-3.5 rounded font-medium text-[16px] transition-colors mt-2 shadow-md"
      >
        Find My Dream Home — Free
      </button>
      
      <p className="text-center text-[12px] text-gray-500 mt-3 font-light">
        ✓ No spam &nbsp; ✓ Instant alerts &nbsp; ✓ Unsubscribe anytime
      </p>
    </form>
  );
}