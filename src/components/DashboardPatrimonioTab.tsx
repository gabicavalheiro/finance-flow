import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Landmark, Scale,
  ChevronDown, ChevronUp, Loader2, ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getActiveModuleIds } from '@/lib/modules';
import { getLoans, getInvestments, Loan, Investment } from '@/lib/store_modules';
import { TYPE_LABELS } from '@/pages/InvestmentsPage';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pct = (inv: number, cur: number) =>
  inv === 0 ? 0 : ((cur - inv) / inv) * 100;

// ─── Seção expansível ─────────────────────────────────────────────────────────
function Section({
  title, icon, color, children,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
      >
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}20`, color }}>
          {icon}
        </span>
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  );
}

// ─── Row de empréstimo ────────────────────────────────────────────────────────
function LoanRow({ loan }: { loan: Loan }) {
  const progress = loan.installments > 0
    ? (loan.paidInstallments / loan.installments) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-2 border-t border-border first:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{loan.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: 'hsl(25 95% 53%)' }} />
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {loan.paidInstallments}/{loan.installments}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold" style={{ color: 'hsl(25 95% 53%)' }}>
          -{fmt(loan.remainingAmount)}
        </p>
        <p className="text-[10px] text-muted-foreground">{fmt(loan.monthlyPayment)}/mês</p>
      </div>
    </div>
  );
}

// ─── Row de investimento ──────────────────────────────────────────────────────
function InvestmentRow({ inv }: { inv: Investment }) {
  const gain     = inv.currentValue - inv.amountInvested;
  const gainPct  = pct(inv.amountInvested, inv.currentValue);
  const positive = gain >= 0;
  const gainColor = positive ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)';

  return (
    <div className="flex items-center gap-3 py-2 border-t border-border first:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{inv.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {TYPE_LABELS[inv.type]}{inv.institution ? ` · ${inv.institution}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold" style={{ color: 'hsl(152 69% 45%)' }}>
          {fmt(inv.currentValue)}
        </p>
        <p className="text-[10px]" style={{ color: gainColor }}>
          {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DashboardPatrimonioTab() {
  const navigate = useNavigate();

  const [loading, setLoading]               = useState(true);
  const [loansActive, setLoansActive]       = useState(false);
  const [investActive, setInvestActive]     = useState(false);
  const [loans, setLoans]                   = useState<Loan[]>([]);
  const [investments, setInvestments]       = useState<Investment[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ids = await getActiveModuleIds();
      const hasLoans  = ids.includes('loans');
      const hasInvest = ids.includes('investments');
      setLoansActive(hasLoans);
      setInvestActive(hasInvest);

      const [l, i] = await Promise.all([
        hasLoans  ? getLoans()       : Promise.resolve([]),
        hasInvest ? getInvestments() : Promise.resolve([]),
      ]);
      setLoans(l);
      setInvestments(i);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Totais ──────────────────────────────────────────────────────────────────
  const totalDebt      = loans.reduce((s, l) => s + l.remainingAmount, 0);
  const totalMonthly   = loans.reduce((s, l) => s + l.monthlyPayment, 0);
  const totalInvested  = investments.reduce((s, i) => s + i.amountInvested, 0);
  const totalCurrent   = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalGain      = totalCurrent - totalInvested;
  const netPatrimonio  = totalCurrent - totalDebt;
  const netPositive    = netPatrimonio >= 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const noModules = !loansActive && !investActive;
  if (noModules) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Scale size={32} strokeWidth={1.2} />
        <p className="text-sm text-center">Nenhum módulo de patrimônio ativo.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/modules')}>
          Gerenciar módulos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Saldo Patrimonial ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl border border-border p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <Scale size={15} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Patrimônio líquido</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {investActive && loansActive ? 'investimentos − dívidas' : investActive ? 'total investido' : 'total em dívidas'}
          </span>
        </div>
        <p className="text-2xl font-bold"
          style={{ color: netPositive ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)' }}>
          {netPositive ? '' : '-'}{fmt(Math.abs(netPatrimonio))}
        </p>

        {/* Mini resumo */}
        <div className="flex gap-4 mt-3 pt-3 border-t border-border">
          {investActive && (
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-0.5">Investido</p>
              <p className="text-sm font-semibold" style={{ color: 'hsl(152 69% 45%)' }}>
                {fmt(totalCurrent)}
              </p>
              {totalGain !== 0 && (
                <p className="text-[10px]"
                  style={{ color: totalGain >= 0 ? 'hsl(152 69% 45%)' : 'hsl(0 84% 60%)' }}>
                  {totalGain >= 0 ? '+' : ''}{fmt(totalGain)}
                </p>
              )}
            </div>
          )}
          {investActive && loansActive && (
            <div className="w-px bg-border self-stretch" />
          )}
          {loansActive && (
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-0.5">Em dívidas</p>
              <p className="text-sm font-semibold" style={{ color: 'hsl(25 95% 53%)' }}>
                -{fmt(totalDebt)}
              </p>
              {totalMonthly > 0 && (
                <p className="text-[10px] text-muted-foreground">{fmt(totalMonthly)}/mês</p>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Investimentos ─────────────────────────────────────────────────── */}
      {investActive && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Section
            title="Investimentos"
            icon={<TrendingUp size={16} />}
            color="hsl(152 69% 45%)"
          >
            {investments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                Nenhum investimento cadastrado
              </p>
            ) : (
              investments.map(inv => <InvestmentRow key={inv.id} inv={inv} />)
            )}
            <button
              onClick={() => navigate('/investments')}
              className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              Ver todos <ArrowRight size={12} />
            </button>
          </Section>
        </motion.div>
      )}

      {/* ── Empréstimos ───────────────────────────────────────────────────── */}
      {loansActive && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Section
            title="Empréstimos"
            icon={<Landmark size={16} />}
            color="hsl(25 95% 53%)"
          >
            {loans.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                Nenhum empréstimo cadastrado
              </p>
            ) : (
              loans.map(l => <LoanRow key={l.id} loan={l} />)
            )}
            <button
              onClick={() => navigate('/loans')}
              className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              Ver todos <ArrowRight size={12} />
            </button>
          </Section>
        </motion.div>
      )}
    </div>
  );
}
