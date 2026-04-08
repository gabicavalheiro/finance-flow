import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { CardBrand, CreditCard } from '@/lib/types';
import { getCards, saveCards } from '@/lib/store';
import { generateId } from '@/lib/helpers';
import { BankInfo, searchBanks } from '@/lib/banks';

interface Props {
  onAdded: () => void;
}

export default function AddCardDialog({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState<CardBrand>('visa');
  const [lastDigits, setLastDigits] = useState('');
  const [limit, setLimit] = useState('');
  const [closingDay, setClosingDay] = useState('10');
  const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => searchBanks(name).slice(0, 6), [name]);

  const selectBank = (bank: BankInfo) => {
    setName(bank.name);
    setSelectedBank(bank);
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    if (!name || !lastDigits || !limit) {
      toast.error('Preencha todos os campos');
      return;
    }
    const card: CreditCard = {
      id: generateId(),
      name,
      brand,
      lastDigits: lastDigits.slice(-4),
      limit: parseFloat(limit),
      closingDay: parseInt(closingDay),
      customGradient: selectedBank?.gradient,
    };
    const all = getCards();
    all.push(card);
    saveCards(all);
    toast.success(`Cartão ${name} adicionado!`);
    setName(''); setLastDigits(''); setLimit(''); setBrand('visa'); setSelectedBank(null);
    setOpen(false);
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-dashed border-muted-foreground/30 h-28 w-full rounded-2xl">
          <Plus size={20} className="mr-2" /> Novo Cartão
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar Cartão</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Bank name with autocomplete */}
          <div className="relative">
            <Label>Banco / Apelido</Label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSelectedBank(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Digite o nome do banco..."
                className="bg-secondary border-border pl-9"
              />
            </div>
            {showSuggestions && suggestions.length > 0 && !selectedBank && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl overflow-hidden shadow-xl max-h-52 overflow-y-auto">
                {suggestions.map((bank) => (
                  <button
                    key={bank.name}
                    onClick={() => selectBank(bank)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left"
                  >
                    <div
                      className="w-8 h-5 rounded-md flex-shrink-0"
                      style={{ background: bank.gradient }}
                    />
                    <span className="text-sm">{bank.name}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Preview */}
            {selectedBank && (
              <div className="mt-2 rounded-xl p-3 flex items-center gap-3" style={{ background: selectedBank.gradient }}>
                <div className="w-6 h-4 rounded bg-white/20" />
                <span className="text-xs font-medium text-white/90">{selectedBank.name}</span>
              </div>
            )}
          </div>

          <div>
            <Label>Bandeira</Label>
            <Select value={brand} onValueChange={(v) => setBrand(v as CardBrand)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="visa">Visa</SelectItem>
                <SelectItem value="mastercard">Mastercard</SelectItem>
                <SelectItem value="elo">Elo</SelectItem>
                <SelectItem value="amex">American Express</SelectItem>
                <SelectItem value="other">Outra</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Últimos 4 dígitos</Label>
              <Input maxLength={4} value={lastDigits} onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, ''))} placeholder="1234" className="bg-secondary border-border" />
            </div>
            <div>
              <Label>Dia fechamento</Label>
              <Input type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
          <div>
            <Label>Limite (R$)</Label>
            <Input type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="5000" className="bg-secondary border-border" />
          </div>
          <Button onClick={handleSubmit} className="w-full gradient-primary">Adicionar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
