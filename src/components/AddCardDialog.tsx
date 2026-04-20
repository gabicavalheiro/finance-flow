import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Info } from 'lucide-react';
import { toast } from 'sonner';
import { CardBrand, CreditCard } from '@/lib/types';
import { addCard } from '@/lib/store';
import { BankInfo, searchBanks } from '@/lib/banks';
import { generateId } from '@/lib/helpers';
import CurrencyInput from '@/components/CurrencyInput';

interface Props { onAdded: () => void; }

export default function AddCardDialog({ onAdded }: Props) {
  const [open, setOpen]             = useState(false);
  const [name, setName]             = useState('');
  const [brand, setBrand]           = useState<CardBrand>('visa');
  const [lastDigits, setLastDigits] = useState('');
  const [limit, setLimit]           = useState('');
  const [closingDay, setClosingDay] = useState('10');
  const [dueDay, setDueDay]         = useState('17');
  const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading]       = useState(false);

  const suggestions = useMemo(() => searchBanks(name).slice(0, 6), [name]);

  const selectBank = (bank: BankInfo) => {
    setName(bank.name); setSelectedBank(bank); setShowSuggestions(false);
  };

  const reset = () => {
    setName(''); setLastDigits(''); setLimit(''); setBrand('visa');
    setSelectedBank(null); setClosingDay('10'); setDueDay('17');
  };

  const handleSubmit = async () => {
    if (!name || !limit) { toast.error('Preencha o nome e o limite'); return; }
    const parsedLimit = parseFloat(limit);
    if (isNaN(parsedLimit) || parsedLimit <= 0) { toast.error('Limite inválido'); return; }
    const closing = parseInt(closingDay);
    const due     = parseInt(dueDay);
    if (!closing || closing < 1 || closing > 31) { toast.error('Dia de fechamento inválido (1–31)'); return; }
    if (!due || due < 1 || due > 31) { toast.error('Dia de vencimento inválido (1–31)'); return; }

    const card: CreditCard = {
      id: generateId(), name, brand,
      lastDigits: lastDigits.slice(-4) || '••••',
      limit: parsedLimit, closingDay: closing, dueDay: due,
      customGradient: selectedBank?.gradient,
    };

    setLoading(true);
    try {
      await addCard(card);
      toast.success(`Cartão ${name} adicionado!`);
      reset(); setOpen(false); onAdded();
    } catch {
      toast.error('Erro ao adicionar cartão');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-dashed border-muted-foreground/30 h-28 w-full rounded-2xl">
          <Plus size={20} className="mr-2" /> Novo Cartão
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-card border-border max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Novo Cartão</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Nome */}
          <div className="relative">
            <Label className="text-xs text-muted-foreground">Nome do banco / cartão</Label>
            <div className="relative mt-1.5">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={name}
                onChange={e => { setName(e.target.value); setShowSuggestions(true); setSelectedBank(null); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Ex: Nubank, Itaú..." className="bg-secondary border-border pl-9" />
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                {suggestions.map(bank => (
                  <button key={bank.name} onMouseDown={() => selectBank(bank)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-secondary transition-colors text-sm">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: bank.gradient ?? 'hsl(263 70% 58%)' }} />
                    {bank.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bandeira */}
          <div>
            <Label className="text-xs text-muted-foreground">Bandeira</Label>
            <Select value={brand} onValueChange={v => setBrand(v as CardBrand)}>
              <SelectTrigger className="bg-secondary border-border mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['visa', 'mastercard', 'elo', 'amex', 'other'] as CardBrand[]).map(b => (
                  <SelectItem key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Últimos dígitos + Limite */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Últimos 4 dígitos</Label>
              <Input value={lastDigits}
                onChange={e => setLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234" maxLength={4} className="bg-secondary border-border mt-1.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Limite (R$)</Label>
              <CurrencyInput value={limit} onChange={setLimit} className="bg-secondary border-border mt-1.5" />
            </div>
          </div>

          {/* Fechamento + Vencimento */}
          <div className="bg-secondary/50 rounded-xl p-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium">Datas da fatura</p>
              <div className="group relative">
                <Info size={12} className="text-muted-foreground cursor-help" />
                <div className="absolute left-0 bottom-full mb-1.5 w-64 bg-popover border border-border rounded-xl p-3 text-xs text-muted-foreground shadow-xl hidden group-hover:block z-50 leading-relaxed">
                  <strong>Fechamento:</strong> compras após este dia vão para a próxima fatura.<br />
                  <strong>Vencimento:</strong> dia em que a fatura precisa ser paga.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Dia de fechamento</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input type="number" min={1} max={31} value={closingDay}
                    onChange={e => setClosingDay(e.target.value)}
                    placeholder="10" className="bg-secondary border-border w-20" />
                  <span className="text-xs text-muted-foreground">do mês</span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dia de vencimento</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input type="number" min={1} max={31} value={dueDay}
                    onChange={e => setDueDay(e.target.value)}
                    placeholder="17" className="bg-secondary border-border w-20" />
                  <span className="text-xs text-muted-foreground">do mês</span>
                </div>
              </div>
            </div>
            {/* Preview */}
            <p className="text-[11px] text-muted-foreground">
              Fecha dia <span className="text-foreground font-semibold">{closingDay || '–'}</span>
              {' · '}Vence dia <span className="text-foreground font-semibold">{dueDay || '–'}</span>
            </p>
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full gradient-primary">
            {loading ? 'Adicionando...' : 'Adicionar cartão'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}