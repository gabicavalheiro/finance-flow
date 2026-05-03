// src/components/MobileDashboardSheet.tsx
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ChartNoAxesCombined } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardSidebar from '@/components/DashboardSidebar';
import { CreditCard, FixedIncome, Expense, FixedExpense, VariableTransaction } from '@/lib/types';

interface Props {
  cards: CreditCard[];
  incomes: FixedIncome[];
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
  varTxs?: VariableTransaction[];
  month: string;
}

export default function MobileDashboardSheet({ 
  cards, incomes, expenses, fixedExpenses, varTxs = [], month 
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    // ✅ Aparece em TODAS telas < xl (mobile E tablet E laptop médio)
    <div className="xl:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={[
              // Posição: mobile fica acima da bottom nav, tablet/laptop fica mais baixo
              'fixed right-4 z-40',
              'bottom-20 md:bottom-6',   // mobile: acima do nav (h-16 + margem), tablet: no canto
              'h-14 w-14 rounded-full shadow-lg',
              'border-2 border-primary/30',
              'bg-gradient-to-br from-primary/20 to-primary/5',
              'hover:from-primary/30 hover:to-primary/10',
              'backdrop-blur-sm',
            ].join(' ')}
          >
            <ChartNoAxesCombined size={22} className="text-primary" />
          </Button>
        </SheetTrigger>
        
        <SheetContent 
          side="right" 
          className="w-[90vw] sm:w-[420px] p-0 overflow-y-auto"
        >
          <div className="p-6 pt-12">
            <DashboardSidebar
              cards={cards}
              incomes={incomes}
              expenses={expenses}
              fixedExpenses={fixedExpenses}
              varTxs={varTxs}
              month={month}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}