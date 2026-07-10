import { LucideIcon } from 'lucide-react';

export interface FeatureModule {
  tag: string;
  title: string;
  desc: string;
  icon: LucideIcon;
}

export interface SupervisoryAuthority {
  code: string;
  name: string;
  country: string;
  focus: string;
  enforcement: string;
}

export interface CalculatorOption {
  text: string;
  value: string;
  score: number;
}

export interface CalculatorQuestion {
  id: string;
  text: string;
  options: CalculatorOption[];
}
