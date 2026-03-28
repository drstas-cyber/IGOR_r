import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, CheckCircle2 } from 'lucide-react';

export default function AboutSection() {
  const agentPhoto = "/images/george-cutout.png";

  return (
    <motion.section 
      id="about"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="bg-background relative py-16"
    >
      <div className="max-w-6xl mx-auto bg-card shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-accent/10">
        <div className="h-2 w-full bg-accent" />
        
        <div className="grid lg:grid-cols-12 gap-0">
          <div className="lg:col-span-5 p-12 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-border/50 bg-secondary/5">
            <div className="relative mb-8">
              <div className="w-56 h-56 md:w-64 md:h-64 rounded-full overflow-hidden border-[8px] border-background shadow-2xl relative z-10">
                <img
                  src={agentPhoto}
                  alt="George Khazanovskiy - Professional Headshot"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 rounded-full border border-accent scale-[1.1] opacity-50" />
            </div>

            <div className="text-center space-y-3">
              <h3 className="text-3xl font-serif text-secondary">George Khazanovskiy</h3>
              <p className="text-accent tracking-widest uppercase text-sm font-semibold">Luxury Specialist</p>
              <div className="flex flex-col gap-2 items-center pt-4">
                <a href="tel:6192772766" className="font-serif text-xl text-secondary hover:text-accent transition-colors">
                  (619) 277-2766
                </a>
                <span className="text-muted-foreground text-sm uppercase tracking-wider">DRE #02034120</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 p-12 sm:p-16 flex flex-col justify-center">
            <h2 className="text-4xl sm:text-5xl font-serif text-secondary mb-8 leading-tight">
              Refined Living in <br/>
              <span className="text-accent italic">Temecula Valley</span>
            </h2>

            <div className="space-y-6 text-foreground/80 leading-loose font-light text-lg">
              <p>
                Specializing in exclusive properties and estates across the Temecula Valley wine country. George brings a sophisticated approach to real estate, combining deep local knowledge with global reach.
              </p>
              
              <p>
                Whether acquiring a vineyard estate or selling a bespoke residence, expect a seamless, discreet, and highly tailored experience designed to exceed the expectations of discerning clients.
              </p>

              <div className="grid sm:grid-cols-2 gap-y-4 gap-x-8 pt-8 border-t border-accent/20">
                {[
                  "Estate Portfolio Management",
                  "Global Marketing Reach",
                  "Bespoke Client Advisory",
                  "Discreet Negotiations"
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-secondary text-sm uppercase tracking-wide">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}