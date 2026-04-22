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
  const [label, setLabel]          = useState('');
  const [icon, setIcon]            = useState('MoreHorizontal');
  const [color, setColor]          = useState('263 70% 58%');
  const [categoryType, setCatType] = useState<'expense' | 'income' | 'both'>(defaultType);
  const [saving, setSaving]        = useState(false);

  const reset = () => {
    setLabel(''); setIcon('MoreHorizontal'); setColor('263 70% 58%');
    setCatType(defaultType);
  };

  const handleSave = async () => {
    if (!label.trim()) { toast.error('Informe o nome da categoria'); return; }

    const cat: CustomCategory = {
      id: `custom_${generateId()}`,
      label: label.trim(),
      icon,
      color,
      categoryType,
    };

    setSaving(true);
    try {
      await saveCustomCategory(cat);
      toast.success(`Categoria "${cat.label}" criada!`);
      onCreated(cat);
      reset();
      onClose();
    } catch {
      toast.error('Erro ao salvar categoria');
    } finally {
      setSaving(false);
    }
  };

  const SelectedIcon = ICON_OPTIONS.find(o => o.name === icon)?.Icon ?? MoreHorizontal;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Pet, Academia..."
              className="bg-secondary border-border"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-xs">Usar em</Label>
            <div className="flex gap-2">
              {(['expense', 'income', 'both'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCatType(t)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    categoryType === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'expense' ? 'Gasto' : t === 'income' ? 'Ganho' : 'Ambos'}
                </button>
              ))}
            </div>
          </div>

          {/* Preview + cor */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `hsl(${color} / 0.15)`, color: `hsl(${color})` }}
            >
              <SelectedIcon size={18} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-5 h-5 rounded-full transition-all',
                    color === c ? 'ring-2 ring-offset-1 ring-offset-card ring-white/60 scale-110' : '',
                  )}
                  style={{ background: `hsl(${c})` }}
                />
              ))}
            </div>
          </div>

          {/* Ícone */}
          <div className="space-y-1.5">
            <Label className="text-xs">Ícone</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcon(name)}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                    icon === name ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
            style={{ background: 'linear-gradient(135deg, hsl(263 70% 58%), hsl(220 70% 55%))' }}
          >
            {saving ? 'Salvando...' : 'Criar categoria'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}