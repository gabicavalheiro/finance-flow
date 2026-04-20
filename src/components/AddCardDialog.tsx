import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { CardBrand, CreditCard } from '@/lib/types';
import { addCard } from '@/lib/store';
import { BankInfo, searchBanks } from '@/lib/banks';
import { generateId } from '@/lib/helpers';
import CurrencyInput from '@/components/CurrencyInput';

interface Props { onAdded: () => void; }

export default function AddCardDialog({ onAdded }: Props) {
  const [open, setOpen]               = useState(false);
  const [name, setName]               = useState('');
  const [brand, setBrand]             = useState<CardBrand>('visa');
  const [lastDigits, setLastDigits]   = useState('');
  const [limit, setLimit]             = useState('');
  const [closingDay, setClosingDay]   = useState('10');
  const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading]         = useState(false);

  const suggestions = useMemo(() => searchBanks(name).slice(0, 6), [name]);

  const selectBank = (bank: BankInfo) => {
    setName(bank.name);
    setSelectedBank(bank);
    setShowSuggestions(false);
  };

  const handleSubmit = async () => {
    if (!name || !limit) { toast.error('Preencha o nome e o limite'); return; }
    const parsedLimit = parseFloat(limit);
    if (isNaN(parsedLimit) || parsedLimit <= 0) { toast.error('Limite inválido'); return; }
    const day = parseInt(closingDay);
    if (!day || day < 1 || day > 31) { toast.error('Dia de fechamento inválido (1–31)'); return; }

    const card: CreditCard = {
      id: generateId(),
      name,
      brand,
      lastDigits: lastDigits.slice(-4) || '••••',
      limit: parsedLimit,
      closingDay: day,
      customGradient: selectedBank?.gradient,
    };

    setLoading(true);
    try {
      await addCard(card);
      toast.success(`Cartão ${name} adicionado!`);
      setName(''); setLastDigits(''); setLimit(''); setBrand('visa');
      setSelectedBank(null); setClosingDay('10');
      setOpen(false);
      onAdded();
    } catch {
      toast.error('Erro ao adicionar cartão');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-dashed border-muted-foreground/30 h-28 w-full rounded-2xl">
          <Plus size={20} className="mr-2" /> Novo Cartão
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Adicionar Cartão</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Bank autocomplete */}
          <div className="relative">
            <Label>Banco / Apelido</Label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={name}
                onChange={e => { setName(e.target.value); setSelectedBank(null); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Digite o nome do banco..."
                className="bg-secondary border-border pl-9"
              />
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                {suggestions.map(bank => (
                  <button key={bank.name} onClick={() => selectBank(bank)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left">
                    <div className="w-6 h-6 rounded-md flex-shrink-0"
                      style={{ background: bank.gradient ?? 'hsl(263 70% 58%)' }} />
                    <span className="text-sm">{bank.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Bandeira</Label>
            <Select value={brand} onValueChange={v => setBrand(v as CardBrand)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['visa', 'mastercard', 'elo', 'amex', 'other'] as CardBrand[]).map(b => (
                  <SelectItem key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Últimos 4 dígitos</Label>
              <Input value={lastDigits} onChange={e => setLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234" maxLength={4} className="bg-secondary border-border" />
            </div>
            <div>
              <Label>Fechamento (dia)</Label>
              <Input type="number" min={1} max={31} value={closingDay}
                onChange={e => setClosingDay(e.target.value)} placeholder="10"
                className="bg-secondary border-border" />
            </div>
          </div>

          <div>
            <Label>Limite (R$)</Label>
            <CurrencyInput value={limit} onChange={setLimit} className="bg-secondary border-border" />
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full gradient-primary">
            {loading ? 'Adicionando...' : 'Adicionar cartão'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}