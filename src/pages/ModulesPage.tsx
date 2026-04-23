import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Landmark, TrendingUp, CheckCircle2, PlusCircle,
  XCircle, Sparkles, LucideIcon, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  AVAILABLE_MODULES, AppModule,
  getActiveModuleIds, activateModule, deactivateModule,
} from '@/lib/modules';

// ─── Mapa de ícones ───────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = { Landmark, TrendingUp };

// ─── Card de módulo ───────────────────────────────────────────────────────────
function ModuleCard({
  module, active, loading,
  onActivate, onDeactivate,
}: {
  module: AppModule;
  active: boolean;
  loading: boolean;
  onActivate: (m: AppModule) => void;
  onDeactivate: (m: AppModule) => void;
}) {
  const Icon    = ICON_MAP[module.icon] ?? Sparkles;
  const color   = `hsl(${module.accentColor})`;
  const colorBg = `hsl(${module.accentColor} / 0.12)`;

  return (
    <div className={`
      relative bg-card rounded-2xl border p-5 flex flex-col gap-4 transition-all
      ${active ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'}
    `}>
      {active && (
        <span className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          <CheckCircle2 size={10} /> Ativo
        </span>
      )}

      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: colorBg, color }}
        >
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{module.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {module.description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border">
        {module.priceLabel && (
          <span className="text-xs text-muted-foreground">{module.priceLabel}</span>
        )}
        {active ? (
          <Button
            variant="ghost" size="sm" disabled={loading}
            className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
            onClick={() => onDeactivate(module)}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            Desativar
          </Button>
        ) : (
          <Button size="sm" disabled={loading} className="ml-auto gap-1.5"
            onClick={() => onActivate(module)}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
            Ativar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function ModulesPage() {
  const [activeIds, setActiveIds]       = useState<string[]>([]);
  const [pageLoading, setPageLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // module id em ação
  const [toActivate, setToActivate]     = useState<AppModule | null>(null);
  const [toDeactivate, setToDeactivate] = useState<AppModule | null>(null);

  const load = useCallback(async () => {
    setPageLoading(true);
    try { setActiveIds(await getActiveModuleIds()); }
    finally { setPageLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Ativar ───────────────────────────────────────────────────────────────
  const confirmActivate = async () => {
    if (!toActivate) return;
    setActionLoading(toActivate.id);
    setToActivate(null);
    try {
      await activateModule(toActivate.id);
      await load();
      toast.success(`Módulo "${toActivate.label}" ativado! A aba já aparece no menu.`);
    } catch {
      toast.error('Erro ao ativar módulo. Tente novamente.');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Desativar ────────────────────────────────────────────────────────────
  const confirmDeactivate = async () => {
    if (!toDeactivate) return;
    setActionLoading(toDeactivate.id);
    setToDeactivate(null);
    try {
      await deactivateModule(toDeactivate.id);
      await load();
      toast.success(`Módulo "${toDeactivate.label}" desativado. Seus dados permanecem salvos.`);
    } catch {
      toast.error('Erro ao desativar módulo. Tente novamente.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="pb-24 md:pb-10 max-w-2xl mx-auto">
      {/* Cabeçalho */}
      <header className="px-4 md:px-8 pt-5 md:pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles size={16} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold">Módulos</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Ative módulos adicionais para expandir as funcionalidades do app.
          As abas aparecem no menu assim que ativadas.
        </p>
      </header>

      <div className="px-4 md:px-8 space-y-4">
        {pageLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          AVAILABLE_MODULES.map((mod, i) => (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <ModuleCard
                module={mod}
                active={activeIds.includes(mod.id)}
                loading={actionLoading === mod.id}
                onActivate={setToActivate}
                onDeactivate={setToDeactivate}
              />
            </motion.div>
          ))
        )}
      </div>

      {/* Dialog — Ativar */}
      <AlertDialog open={!!toActivate} onOpenChange={open => !open && setToActivate(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar módulo</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja ativar o módulo <strong>{toActivate?.label}</strong>?
              A aba aparecerá imediatamente no menu de navegação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmActivate}>Ativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog — Desativar */}
      <AlertDialog open={!!toDeactivate} onOpenChange={open => !open && setToDeactivate(null)}>
        <AlertDialogContent className="bg-card border-border max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar módulo</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja desativar <strong>{toDeactivate?.label}</strong>?
              A aba será removida do menu. Seus dados permanecem salvos no banco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={confirmDeactivate}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
