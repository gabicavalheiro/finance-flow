import { LucideProps } from 'lucide-react';
import {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap,
  ShoppingBag, Home, Plane, Repeat, MoreHorizontal,
  Landmark, Zap, Briefcase, Laptop, Building2, TrendingUp,
  Gift, Star, Music, Coffee, Dumbbell, Wrench, Camera,
  Baby, PawPrint, CircleDollarSign,
} from 'lucide-react';
import { ExpenseCategory, IncomeCategory, CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG } from '@/lib/types';
import { isCustomCategory } from '@/lib/customCategories';
import { useCustomCategories } from '@/contexts/CustomCategoryContext';
import React from 'react';

const iconMap: Record<string, React.ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>>> = {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap,
  ShoppingBag, Home, Plane, Repeat, MoreHorizontal,
  Landmark, Zap, Briefcase, Laptop, Building2, TrendingUp,
  Gift, Star, Music, Coffee, Dumbbell, Wrench, Camera,
  Baby, PawPrint, CircleDollarSign,
};

interface Props {
  category: string;
  size?: number;
}

export default function CategoryIcon({ category, size = 18 }: Props) {
  const { findCustomCategory } = useCustomCategories();

  // Custom category
  if (isCustomCategory(category)) {
    const custom = findCustomCategory(category);
    if (custom) {
      const Icon = iconMap[custom.icon] ?? Star;
      return (
        <div
          className="flex items-center justify-center rounded-xl shrink-0"
          style={{
            width: size + 14, height: size + 14,
            background: `hsl(${custom.color} / 0.15)`,
            color: `hsl(${custom.color})`,
          }}
        >
          <Icon size={size} />
        </div>
      );
    }
  }

  // Expense config
  const expenseConfig = CATEGORY_CONFIG[category as ExpenseCategory];
  if (expenseConfig) {
    const Icon = iconMap[expenseConfig.icon] ?? MoreHorizontal;
    return (
      <div
        className="flex items-center justify-center rounded-xl shrink-0"
        style={{
          width: size + 14, height: size + 14,
          background: `hsl(${expenseConfig.color} / 0.15)`,
          color: `hsl(${expenseConfig.color})`,
        }}
      >
        <Icon size={size} />
      </div>
    );
  }

  // Income config
  const incomeConfig = INCOME_CATEGORY_CONFIG[category as IncomeCategory];
  if (incomeConfig) {
    const Icon = iconMap[incomeConfig.icon] ?? CircleDollarSign;
    return (
      <div
        className="flex items-center justify-center rounded-xl shrink-0"
        style={{
          width: size + 14, height: size + 14,
          background: `hsl(${incomeConfig.color} / 0.15)`,
          color: `hsl(${incomeConfig.color})`,
        }}
      >
        <Icon size={size} />
      </div>
    );
  }

  // Fallback
  return (
    <div
      className="flex items-center justify-center rounded-xl shrink-0"
      style={{
        width: size + 14, height: size + 14,
        background: 'hsl(240 5% 55% / 0.15)',
        color: 'hsl(240 5% 55%)',
      }}
    >
      <MoreHorizontal size={size} />
    </div>
  );
}
