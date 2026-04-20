import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Info } from 'lucide-react';
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
  const [name, setName]             = useState(card.name);
  const [brand, setBrand]           = useState<CardBrand>(card.brand);
  const [lastDigits, setLastDigits] = useState(card.lastDigits === '••••' ? '' : card.lastDigits);
  const [limit, setLimit]           = useState(String(card.limit));
  const [closingDay, setClosingDay] = useState(String(card.closingDay));
  const [dueDay, setDueDay]         = useState(String(card.dueDay ?? ''));
  const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving]         = useState(false);

  const suggestions = useMemo(() => searchBanks(name).slice(0, 6), [name]);

  const selectBank = (bank: BankInfo) => {
    setName(bank.name); setSelectedBank(bank); setShowSuggestions(false);
  };

  const handleSave = async () => {
    if (!name || !limit) { toast.error('Preencha o nome e o limite'); return; }
    const parsedLimit = parseFloat(limit);
    if (isNaN(parsedLimit) || parsedLimit <= 0) { toast.error('Limite inválido'); return; }
    const closing = parseInt(closingDay);
    const due     = parseInt(dueDay);
    if (!closing || closing < 1 || closing > 31) { toast.error('Dia de fechamento inválido (1–31)'); return; }
    if (!due || due < 1 || due > 31) { toast.error('Dia de vencimento inválido (1–31)'); return; }

    const updated: CreditCard = {
      ...card, name, brand,
      lastDigits: lastDigits.slice(-4) || '••••',
      limit: parsedLimit, closingDay: closing, dueDay: due,
      customGradient: selectedBank?.gradient ?? card.customGradient,
    };

    setSaving(true);
    try {
      await updateCard(updated);
      toast.success('Cartão atualizado!');
      onSaved(); onClose();
    } catch {
      toast.error('Erro ao atualizar cartão');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Editar Cartão</DialogTitle>
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
                    className="bg-secondary border-border w-20" />
                  <span className="text-xs text-muted-foreground">do mês</span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dia de vencimento</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input type="number" min={1} max={31} value={dueDay}
                    onChange={e => setDueDay(e.target.value)}
                    className="bg-secondary border-border w-20" />
                  <span className="text-xs text-muted-foreground">do mês</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Fecha dia <span className="text-foreground font-semibold">{closingDay || '–'}</span>
              {' · '}Vence dia <span className="text-foreground font-semibold">{dueDay || '–'}</span>
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-border" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 gradient-primary">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}