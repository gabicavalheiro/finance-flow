import { LucideProps } from 'lucide-react';
import {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap,
  ShoppingBag, Home, Plane, Repeat, MoreHorizontal,
  Landmark, Zap,
} from 'lucide-react';
import { ExpenseCategory, CATEGORY_CONFIG } from '@/lib/types';
import React from 'react';

const iconMap: Record<string, React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>> = {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap,
  ShoppingBag, Home, Plane, Repeat, MoreHorizontal,
  Landmark, Zap,
};

interface Props {
  category: ExpenseCategory;
  size?: number;
}

export default function CategoryIcon({ category, size = 18 }: Props) {
  const config = CATEGORY_CONFIG[category];
  const Icon = iconMap[config?.icon] || MoreHorizontal;

  return (
    <div
      className="flex items-center justify-center rounded-xl shrink-0"
      style={{
        width: size + 14,
        height: size + 14,
        background: `hsl(${config?.color ?? '240 5% 55%'} / 0.15)`,
        color: `hsl(${config?.color ?? '240 5% 55%'})`,
      }}
    >
      <Icon size={size} />
    </div>
  );
}