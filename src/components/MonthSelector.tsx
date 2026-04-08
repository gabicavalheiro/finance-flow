import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonthLabel, addMonths } from '@/lib/helpers';
import { Button } from '@/components/ui/button';

interface Props {
  month: string;
  onChange: (m: string) => void;
}

export default function MonthSelector({ month, onChange }: Props) {
  return (
    <div className="flex items-center justify-between px-1">
      <Button variant="ghost" size="icon" onClick={() => onChange(addMonths(month, -1))}>
        <ChevronLeft size={20} />
      </Button>
      <span className="text-sm font-semibold capitalize">{getMonthLabel(month)}</span>
      <Button variant="ghost" size="icon" onClick={() => onChange(addMonths(month, 1))}>
        <ChevronRight size={20} />
      </Button>
    </div>
  );
}
