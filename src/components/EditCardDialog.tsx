import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { CardBrand, CreditCard } from '@/lib/types';
import { getCards, saveCards } from '@/lib/store';
import { BankInfo, searchBanks } from '@/lib/banks';
import CurrencyInput from '@/components/CurrencyInput';

interface Props {
  card: CreditCard;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditCardDialog({ card, open, onClose, onSaved }: Props) {
  const [name, setName]           = useState(card.name);
  const [brand, setBrand]         = useState<CardBrand>(card.brand);
  const [lastDigits, setLastDigits] = useState(card.lastDigits === '••••' ? '' : card.lastDigits);
  const [limit, setLimit]         = useState(String(card.limit));
  const [closingDay, setClosingDay] = useState(String(card.closingDay));
  const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => searchBanks(name).slice(0, 6), [name]);

  const selectBank = (bank: BankInfo) => {
    setName(bank.name);
    setSelectedBank(bank);
    setShowSuggestions(false);
  };

  // Current gradient preview
  const currentGradient = selectedBank?.gradient ?? card.customGradient;

  const handleSave = () => {
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

    saveCards(getCards().map(c => c.id === card.id ? updated : c));
    toast.success('Cartão atualizado!');
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm rounded-3xl p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Editar Cartão</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Card preview */}
          {currentGradient && (
            <div className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: currentGradient }}>
              <div>
                <p className="text-sm font-semibold text-white">{name || 'Banco'}</p>
                <p className="text-xs text-white/60 capitalize mt-0.5">{brand}</p>
              </div>
              <p className="text-sm font-mono text-white/80">
                •••• {lastDigits || '••••'}
              </p>
            </div>
          )}

          {/* Bank search */}
          <div className="relative space-y-1.5">
            <Label className="text-xs text-muted-foreground">Banco / Apelido</Label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={name}
                onChange={e => { setName(e.target.value); setSelectedBank(null); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Digite o nome do banco..."
                className="bg-secondary border-border rounded-xl h-11 pl-9"
              />
            </div>
            {showSuggestions && suggestions.length > 0 && !selectedBank && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                {suggestions.map(bank => (
                  <button key={bank.name} onClick={() => selectBank(bank)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left">
                    <div className="w-8 h-5 rounded-md shrink-0" style={{ background: bank.gradient }} />
                    <span className="text-sm">{bank.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Brand */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Bandeira</Label>
            <Select value={brand} onValueChange={v => setBrand(v as CardBrand)}>
              <SelectTrigger className="bg-secondary border-border rounded-xl h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="visa">Visa</SelectItem>
                <SelectItem value="mastercard">Mastercard</SelectItem>
                <SelectItem value="elo">Elo</SelectItem>
                <SelectItem value="amex">American Express</SelectItem>
                <SelectItem value="other">Outra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Last digits + closing day */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Últimos 4 dígitos
                <span className="text-muted-foreground/60 ml-1">(opcional)</span>
              </Label>
              <Input maxLength={4} value={lastDigits}
                onChange={e => setLastDigits(e.target.value.replace(/\D/g, ''))}
                placeholder="1234" className="bg-secondary border-border rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dia fechamento</Label>
              <Input type="number" min={1} max={31} value={closingDay}
                onChange={e => setClosingDay(e.target.value)}
                className="bg-secondary border-border rounded-xl h-11" />
            </div>
          </div>

          {/* Limit */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Limite (R$)</Label>
            <CurrencyInput
              value={limit}
              onChange={setLimit}
              className="bg-secondary border-border rounded-xl h-11"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-border rounded-xl h-11" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="flex-1 gradient-primary rounded-xl h-11 font-semibold">
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
