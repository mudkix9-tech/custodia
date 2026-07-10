"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { FeatureModule } from '@/types/marketing';

interface BentoFeatureCardProps {
  module: FeatureModule;
  index: number;
}

export function BentoFeatureCard({ module, index }: BentoFeatureCardProps) {
  const Icon = module.icon;
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.35, delay: index * 0.03 }}
      className="bg-[#1F241D]/45 border border-[#2F362D]/90 rounded-xl p-5.5 flex flex-col justify-between group hover:bg-[#1F241D]/80 hover:border-[#596E51]/40 transition-all duration-300 h-full relative overflow-hidden"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(89,110,81,0.08)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div>
        <div className="flex items-center justify-between mb-5">
          <span className="text-[9px] font-sans font-bold tracking-wider text-[#8BA381] bg-[#141712]/80 border border-[#2F362D] px-2 py-0.5 rounded">
            {module.tag}
          </span>
          <Icon aria-hidden="true" className="w-4 h-4 text-[#5F655A] group-hover:text-[#8BA381] transition-colors" />
        </div>
        <h3 className="text-base font-bold text-[#F5F3ED] mb-2">{module.title}</h3>
        <p className="text-[#9CA297] text-xs leading-relaxed">{module.desc}</p>
      </div>
      <div className="mt-6 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8BA381]/80 group-hover:text-[#8BA381] transition-colors cursor-pointer">
        Manage Module <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </motion.div>
  );
}
