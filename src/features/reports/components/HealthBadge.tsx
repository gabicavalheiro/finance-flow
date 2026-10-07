import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export default function HealthBadge({ balance, income }: { balance: number; income: number }) {
  if (balance >= income * 0.3) return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
      <CheckCircle2 size={10} /> Mês tranquilo
    </span>
  );
  if (balance >= 0) return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
      <Clock size={10} /> Mês apertado
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
      <AlertTriangle size={10} /> Saldo negativo
    </span>
  );
}
