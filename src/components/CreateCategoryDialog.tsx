import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { saveCustomCategory, CustomCategory } from '@/lib/customCategories';
import { generateId } from '@/lib/helpers';
import {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap,
  ShoppingBag, Home, Plane, Repeat, Landmark, Zap,
  Briefcase, Laptop, Building2, TrendingUp, Gift,
  Star, Music, Coffee, Dumbbell, Wrench, Camera,
  Baby, PawPrint, MoreHorizontal,
} from 'lucide-react';

const ICON_OPTIONS = [
  { name: 'UtensilsCrossed', Icon: UtensilsCrossed },
  { name: 'ShoppingBag',     Icon: ShoppingBag     },
  { name: 'Car',             Icon: Car             },
  { name: 'Home',            Icon: Home            },
  { name: 'Heart',           Icon: Heart           },
  { name: 'Gamepad2',        Icon: Gamepad2        },
  { name: 'GraduationCap',   Icon: GraduationCap   },
  { name: 'Plane',           Icon: Plane           },
  { name: 'Repeat',          Icon: Repeat          },
  { name: 'Landmark',        Icon: Landmark        },
  { name: 'Zap',             Icon: Zap             },
  { name: 'Briefcase',       Icon: Briefcase       },
  { name: 'Laptop',          Icon: Laptop          },
  { name: 'Building2',       Icon: Building2       },
  { name: 'TrendingUp',      Icon: TrendingUp      },
  { name: 'Gift',            Icon: Gift            },
  { name: 'Star',            Icon: Star            },
  { name: 'Music',           Icon: Music           },
  { name: 'Coffee',          Icon: Coffee          },
  { name: 'Dumbbell',        Icon: Dumbbell        },
  { name: 'Wrench',          Icon: Wrench          },
  { name: 'Camera',          Icon: Camera          },
  { name: 'Baby',            Icon: Baby            },
  { name: 'PawPrint',        Icon: PawPrint        },
  { name: 'MoreHorizontal',  Icon: MoreHorizontal  },
];

const COLOR_OPTIONS = [
  '30 90% 55%',
  '0 72% 51%',
  '320 70% 55%',
  '280 70% 58%',
  '263 70% 58%',
  '210 70% 55%',
  '200 80% 50%',
  '152 69% 45%',
  '155 70% 42%',
  '45 90% 50%',
  '38 92% 50%',
  '240 5% 55%',
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultType?: 'expense' | 'income';
  onCreated: (category: CustomCategory) => void;
}

export default function CreateCategoryDialog({ open, onClose, defaultType = 'expense', onCreated }: Props) {
  const [label, setLabel]                 = useState('');
  const [selectedIcon, setSelectedIcon]   = useState('Star');
  const [selectedColor, setSelectedColor] = useState('263 70% 58%');
  const [categoryType, setCategoryType]   = useState<'expense' | 'income' | 'both'>(defaultType);
  const [saving, setSaving]               = useState(false);

  const reset = () => {
    setLabel('');
    setSelectedIcon('Star');
    setSelectedColor('263 70% 58%');
    setCategoryType(defaultType);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    if (!label.trim()) { toast.error('Digite um nome para a categoria'); return; }
    setSaving(true);
    const newCat: CustomCategory = {
      id: `custom_${generateId()}`,
      label: label.trim(),
      icon: selectedIcon,
      color: selectedColor,
      categoryType,
    };
    try {
      await saveCustomCategory(newCat);
      toast.success(`Categoria "${newCat.label}" criada!`);
      onCreated(newCat);
      reset();
      onClose();
    } catch {
      toast.error('Erro ao salvar categoria');
    }
    setSaving(false);
  };

  const IconComponent = ICON_OPTIONS.find(i => i.name === selectedIcon)?.Icon ?? Star;

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent
        className="bg-card border-border w-[calc(100vw-32px)] max-w-sm rounded-3xl p-0 overflow-hidden mx-auto"
      >
        {/* Header fixo */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Nova Categoria</DialogTitle>
          </DialogHeader>
        </div>

        {/* Conteúdo com scroll */}
        <div className="overflow-y-auto max-h-[70vh] px-5 py-4 space-y-4">

          {/* Preview */}
          <div className="flex items-center gap-3 bg-secondary/50 rounded-2xl px-4 py-3">
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{
                width: 40, height: 40,
                background: `hsl(${selectedColor} / 0.15)`,
                color: `hsl(${selectedColor})`,
              }}
            >
              <IconComponent size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{label || 'Nome da categoria'}</p>
              <p className="text-xs text-muted-foreground">
                {categoryType === 'expense' ? 'Gastos' : categoryType === 'income' ? 'Ganhos' : 'Gastos & Ganhos'}
              </p>
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Pet, Academia, Streaming…"
              className="bg-secondary border-border"
              maxLength={30}
              autoFocus
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Usar em</Label>
            <div className="grid grid-cols-3 gap-1.5 bg-secondary rounded-xl p-1">
              {(['expense', 'income', 'both'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setCategoryType(t)}
                  className="py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: categoryType === t ? `hsl(${selectedColor})` : 'transparent',
                    color: categoryType === t ? '#fff' : 'hsl(240 5% 55%)',
                  }}
                >
                  {t === 'expense' ? 'Gastos' : t === 'income' ? 'Ganhos' : 'Ambos'}
                </button>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cor</Label>
            <div className="flex flex-wrap gap-2.5">
              {COLOR_OPTIONS.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: `hsl(${color})`,
                    outline: selectedColor === color ? `2.5px solid hsl(${color})` : 'none',
                    outlineOffset: 2,
                    opacity: selectedColor === color ? 1 : 0.55,
                    transform: selectedColor === color ? 'scale(1.18)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Ícone */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ícone</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  onClick={() => setSelectedIcon(name)}
                  className="flex items-center justify-center rounded-xl h-9 w-full transition-all"
                  style={{
                    background: selectedIcon === name ? `hsl(${selectedColor} / 0.2)` : 'hsl(240 5% 12%)',
                    color: selectedIcon === name ? `hsl(${selectedColor})` : 'hsl(240 5% 55%)',
                    border: selectedIcon === name
                      ? `1.5px solid hsl(${selectedColor} / 0.5)`
                      : '1.5px solid transparent',
                  }}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Botões fixos no rodapé */}
        <div className="px-5 pb-5 pt-3 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1 border-border" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1 text-white"
            style={{ background: `hsl(${selectedColor})` }}
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Criar categoria'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}