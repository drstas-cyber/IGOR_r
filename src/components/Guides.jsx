import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function Guides() {
  const { toast } = useToast();

  const guides = [
    'First-Time Home Buyer Guide',
    'Preparing Your Home for Sale',
    'Understanding the Escrow Process'
  ];

  const handleGuideClick = (guide) => {
    toast({
      title: "📚 Resource Guide",
      description: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <motion.section 
      id="guides"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Guides & Resources</h2>
        <div className="h-1 w-16 bg-gradient-to-r from-blue-900 to-yellow-500 rounded-full" />
      </div>
      
      <ul className="space-y-3">
        {guides.map((guide, index) => (
          <motion.li 
            key={index}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
          >
            <button
              onClick={() => handleGuideClick(guide)}
              className="flex items-start gap-2 text-sm text-blue-900 hover:text-blue-700 hover:underline transition-colors w-full text-left group"
            >
              <BookOpen className="w-4 h-4 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span>{guide}</span>
            </button>
          </motion.li>
        ))}
      </ul>
    </motion.section>
  );
}