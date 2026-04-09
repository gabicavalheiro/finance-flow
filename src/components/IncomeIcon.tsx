import { LucideProps } from 'lucide-react';
import {
  Briefcase, Laptop, Building2, TrendingUp, Gift, CircleDollarSign,
} from 'lucide-react';
import { IncomeCategory, INCOME_CATEGORY_CONFIG } from '@/lib/types';
import React from 'react';

const iconMap: Record<string, React.ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>>> = {
  Briefcase, Laptop, Building2, TrendingUp, Gift, CircleDollarSign,
};

interface Props {
  category: IncomeCategory;
  size?: number;
}

export default function IncomeIcon({ category, size = 18 }: Props) {
  const config = INCOME_CATEGORY_CONFIG[category];
  const Icon = iconMap[config.icon] || CircleDollarSign;

  return (
    <div
      className="flex items-center justify-center rounded-xl"
      style={{
        width: size + 14,
        height: size + 14,
        background: `hsl(${config.color} / 0.15)`,
        color: `hsl(${config.color})`,
      }}
    >
      <Icon size={size} />
    </div>
  );
}
