import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { CardBrand, CreditCard } from '@/lib/types';
import { updateCard } from '@/lib/store';
import { BankInfo, searchBanks } from '@/lib/banks';
import CurrencyInput from '@/components/CurrencyInput';

interface Props {
  card: CreditCard;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditCardDialog({ card, open, onClose, onSaved }: Props) {
  const [name, setName]               = useState(card.name);
  const [brand, setBrand]             = useState<CardBrand>(card.brand);
  const [lastDigits, setLastDigits]   = useState(card.lastDigits === '••••' ? '' : card.lastDigits);
  const [limit, setLimit]             = useState(String(card.limit));
  const [closingDay, setClosingDay]   = useState(String(card.closingDay));
  const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving]           = useState(false);

  const suggestions = useMemo(() => searchBanks(name).slice(0, 6), [name]);

  const selectBank = (bank: BankInfo) => {
    setName(bank.name);
    setSelectedBank(bank);
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    if (!name || !limit) { toast.error('Preencha o nome e o limite'); return; }
    const parsedLimit = parseFloat(limit);
    if (isNaN(parsedLimit) || parsedLimit <= 0) { toast.error('Limite inválido'); return; }

    const updated: CreditCard = {
      ...card,
      name,
      brand,
      lastDigits: lastDigits.slice(-4) || '••••',
      limit: parsedLimit,
      closingDay: parseInt(closingDay) || card.closingDay,
      customGradient: selectedBank?.gradient ?? card.customGradient,
    };

    setSaving(true);
    try {
      await updateCard(updated);
      toast.success('Cartão atualizado!');
      onSaved();
      onClose();
    } catch {
      toast.error('Erro ao atualizar cartão');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Editar Cartão</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="relative">
            <Label>Banco / Apelido</Label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={name}
                onChange={e => { setName(e.target.value); setSelectedBank(null); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Nome do banco..."
                className="bg-secondary border-border pl-9" />
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
                onChange={e => setClosingDay(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>

          <div>
            <Label>Limite (R$)</Label>
            <CurrencyInput value={limit} onChange={setLimit} className="bg-secondary border-border" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-border" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 gradient-primary">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}