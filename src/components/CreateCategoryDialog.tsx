import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap,
  ShoppingBag, Home, Plane, Repeat, MoreHorizontal,
  Landmark, Zap, Wallet, Coffee, Dog, Dumbbell, Music,
  Shirt, Scissors, Baby, Pill, Gift, Briefcase,
} from 'lucide-react';
import { generateId } from '@/lib/helpers';
import { saveCustomCategory, CustomCategory } from '@/lib/customCategories';
import { cn } from '@/lib/utils';

const ICON_OPTIONS = [
  { name: 'UtensilsCrossed', Icon: UtensilsCrossed },
  { name: 'Car',             Icon: Car },
  { name: 'Gamepad2',        Icon: Gamepad2 },
  { name: 'Heart',           Icon: Heart },
  { name: 'GraduationCap',   Icon: GraduationCap },
  { name: 'ShoppingBag',     Icon: ShoppingBag },
  { name: 'Home',            Icon: Home },
  { name: 'Plane',           Icon: Plane },
  { name: 'Repeat',          Icon: Repeat },
  { name: 'Landmark',        Icon: Landmark },
  { name: 'Zap',             Icon: Zap },
  { name: 'Wallet',          Icon: Wallet },
  { name: 'Coffee',          Icon: Coffee },
  { name: 'Dog',             Icon: Dog },
  { name: 'Dumbbell',        Icon: Dumbbell },
  { name: 'Music',           Icon: Music },
  { name: 'Shirt',           Icon: Shirt },
  { name: 'Scissors',        Icon: Scissors },
  { name: 'Baby',            Icon: Baby },
  { name: 'Pill',            Icon: Pill },
  { name: 'Gift',            Icon: Gift },
  { name: 'Briefcase',       Icon: Briefcase },
  { name: 'MoreHorizontal',  Icon: MoreHorizontal },
];

const COLOR_OPTIONS = [
  '263 70% 58%', '220 70% 55%', '30 90% 55%',  '152 69% 45%',
  '0 72% 51%',   '280 70% 58%', '320 70% 55%', '45 90% 50%',
  '200 80% 50%', '210 70% 55%', '38 92% 50%',  '155 70% 42%',
  '340 80% 50%', '145 75% 40%', '25 95% 50%',  '0 0% 55%',
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultType: 'expense' | 'income';
  onCreated: (cat: CustomCategory) => void;
}

export default function CreateCategoryDialog({ open, onClose, defaultType, onCreated }: Props) {
  const [label, setLabel]           = useState('');
  const [icon, setIcon]             = useState('MoreHorizontal');
  const [color, setColor]           = useState('263 70% 58%');
  const [categoryType, setCatType]  = useState<'expense' | 'income' | 'both'>(defaultType);

  const reset = () => {
    setLabel(''); setIcon('MoreHorizontal'); setColor('263 70% 58%');
    setCatType(defaultType);
  };

  const handleSave = () => {
    if (!label.trim()) { toast.error('Informe o nome da categoria'); return; }

    const cat: CustomCategory = {
      id: `custom_${generateId()}`,
      label: label.trim(),
      icon,
      color,
      categoryType,
    };

    saveCustomCategory(cat);
    toast.success(`Categoria "${cat.label}" criada!`);
    onCreated(cat);
    reset();
    onClose();
  };

  const SelectedIcon = ICON_OPTIONS.find(o => o.name === icon)?.Icon ?? MoreHorizontal;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-32px)] max-w-sm mx-auto p-0 overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Nova categoria</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Prévia */}
          <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `hsl(${color} / 0.2)`, color: `hsl(${color})` }}
            >
              <SelectedIcon size={18} />
            </div>
            <span className="text-sm font-medium">{label || 'Nome da categoria'}</span>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Pet, Farmácia, Academia…"
              className="bg-secondary border-border"
              maxLength={30}
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Usar em</Label>
            <div className="grid grid-cols-3 gap-1.5 bg-secondary rounded-xl p-1">
              {([['expense', 'Gastos'], ['income', 'Ganhos'], ['both', 'Ambos']] as const).map(([v, lbl]) => (
                <button
                  key={v}
                  onClick={() => setCatType(v)}
                  className="py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: categoryType === v ? `hsl(${color})` : 'transparent',
                    color: categoryType === v ? '#fff' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cor</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn('w-7 h-7 rounded-lg transition-all', color === c && 'ring-2 ring-offset-2 ring-offset-card ring-white/60 scale-110')}
                  style={{ background: `hsl(${c})` }}
                />
              ))}
            </div>
          </div>

          {/* Ícone */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ícone</Label>
            <div className="grid grid-cols-6 gap-1.5">
              {ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  onClick={() => setIcon(name)}
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                    icon === name ? 'ring-2 ring-offset-1 ring-offset-card scale-105' : 'bg-secondary hover:bg-secondary/80'
                  )}
                  style={icon === name
                    ? { background: `hsl(${color} / 0.2)`, color: `hsl(${color})` }
                    : { color: 'hsl(var(--muted-foreground))' }
                  }
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1 border-border" onClick={() => { reset(); onClose(); }}>
            Cancelar
          </Button>
          <Button
            className="flex-1 text-white"
            style={{ background: `hsl(${color})` }}
            onClick={handleSave}
          >
            Criar categoria
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}