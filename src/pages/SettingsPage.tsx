// Configurações: perfil, organização da tela inicial e avisos.

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Bell, KeyRound, LayoutDashboard, LogOut, RotateCcw, UserRound } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getUser, logoutUser, sendPasswordReset, updateUserName } from '@/lib/auth';
import {
  HOME_SECTIONS, moveSection, resetPreferences, updatePreferences, usePreferences,
  type AlertPrefs, type HomeSectionId,
} from '@/lib/preferences';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'profile', label: 'Perfil', icon: UserRound },
  { id: 'home',    label: 'Tela inicial', icon: LayoutDashboard },
  { id: 'alerts',  label: 'Avisos', icon: Bell },
] as const;
type TabId = (typeof TABS)[number]['id'];

function Row({ title, description, checked, onChange, disabled }: {
  title: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 py-3', disabled && 'opacity-50')}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={title} />
    </div>
  );
}

function ProfileTab() {
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getUser().then(u => { setName(u?.name ?? ''); setEmail(u?.email ?? ''); });
  }, []);

  const save = async () => {
    if (!name.trim()) { toast.error('Informe seu nome'); return; }
    setSaving(true);
    const r = await updateUserName(name);
    setSaving(false);
    if (r.ok) { toast.success('Nome atualizado!'); window.dispatchEvent(new Event('ff-profile-updated')); }
    else toast.error(r.error ?? 'Erro ao salvar');
  };

  const resetPassword = async () => {
    if (!email) return;
    const r = await sendPasswordReset(email);
    if (r.ok) toast.success(`Enviamos um link para ${email}`);
    else toast.error(r.error ?? 'Erro ao enviar o e-mail');
  };

  const isDark = theme !== 'light';

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Seus dados</p>
        <div className="space-y-1.5">
          <Label htmlFor="cfg-name" className="text-xs text-muted-foreground">Nome</Label>
          <Input id="cfg-name" value={name} onChange={e => setName(e.target.value)} className="bg-secondary border-border" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfg-email" className="text-xs text-muted-foreground">E-mail</Label>
          <Input id="cfg-email" value={email} readOnly disabled className="bg-secondary border-border" />
        </div>
        <Button onClick={save} disabled={saving} size="sm">{saving ? 'Salvando...' : 'Salvar nome'}</Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 divide-y divide-border/60">
        <Row title="Tema escuro" description="Alterna entre o visual escuro e o claro." checked={isDark}
          onChange={v => setTheme(v ? 'dark' : 'light')} />
        <div className="flex flex-wrap gap-2 pt-3">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={resetPassword}>
            <KeyRound size={13} /> Redefinir senha por e-mail
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => logoutUser()}>
            <LogOut size={13} /> Sair da conta
          </Button>
        </div>
      </section>
    </div>
  );
}

function HomeTab() {
  const prefs = usePreferences();
  const toggle = (id: HomeSectionId, visible: boolean) =>
    updatePreferences(p => ({ homeHidden: visible ? p.homeHidden.filter(x => x !== id) : [...p.homeHidden, id] }));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Seções da tela inicial</p>
        <p className="text-xs text-muted-foreground mb-2">Use as setas para mudar a ordem e o botão para mostrar ou esconder cada seção.</p>
        <ul className="divide-y divide-border/60">
          {prefs.homeOrder.map((id, i) => {
            const sec = HOME_SECTIONS.find(s => s.id === id)!;
            const visible = !prefs.homeHidden.includes(id);
            return (
              <li key={id} className="flex items-center gap-2 py-2.5">
                <div className="flex flex-col">
                  <button type="button" aria-label={`Subir ${sec.label}`} disabled={i === 0}
                    onClick={() => updatePreferences(p => ({ homeOrder: moveSection(p.homeOrder, id, -1) }))}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25"><ArrowUp size={14} /></button>
                  <button type="button" aria-label={`Descer ${sec.label}`} disabled={i === prefs.homeOrder.length - 1}
                    onClick={() => updatePreferences(p => ({ homeOrder: moveSection(p.homeOrder, id, 1) }))}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25"><ArrowDown size={14} /></button>
                </div>
                <div className={cn('min-w-0 flex-1', !visible && 'opacity-50')}>
                  <p className="text-sm font-medium">{sec.label}</p>
                  <p className="text-xs text-muted-foreground">{sec.description}</p>
                </div>
                <Switch checked={visible} onCheckedChange={v => toggle(id, v)} aria-label={`Mostrar ${sec.label}`} />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <Row title="Painel lateral (resumo e orçamentos)"
          description="Aparece ao lado da tela inicial em telas grandes, e no botão de resumo nas pequenas."
          checked={prefs.showSidebar} onChange={v => updatePreferences({ showSidebar: v })} />
      </section>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { resetPreferences(); toast.success('Tela inicial restaurada'); }}>
        <RotateCcw size={13} /> Restaurar padrão
      </Button>
    </div>
  );
}

const ALERT_ROWS: { key: Exclude<keyof AlertPrefs, 'daily'>; title: string; description: string }[] = [
  { key: 'dueDates',  title: 'Faturas vencendo',        description: 'Quando uma fatura vence hoje ou nos próximos dias.' },
  { key: 'cashflow',  title: 'Saldo negativo previsto', description: 'Quando uma fatura vence antes do seu próximo recebimento e o dinheiro não cobre.' },
  { key: 'balance',   title: 'Balanço do mês',          description: 'Se os gastos passam da renda, ou se o mês está saudável.' },
  { key: 'incomes',   title: 'Recebimentos',            description: 'Ganhos que entram hoje ou nos próximos dias.' },
  { key: 'nextMonth', title: 'Prévia do próximo mês',   description: 'Aviso quando o mês seguinte terá déficit.' },
];

function AlertsTab() {
  const prefs = usePreferences();
  const a = prefs.alerts;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-4 divide-y divide-border/60">
        <Row title='Janela "Avisos do dia"'
          description="A janela que abre ao entrar em Faturas e ao trocar de mês. Desligada, ela não abre mais."
          checked={a.daily} onChange={v => updatePreferences({ alerts: { ...a, daily: v } })} />
        {ALERT_ROWS.map(r => (
          <Row key={r.key} title={r.title} description={r.description} checked={a[r.key]} disabled={!a.daily}
            onChange={v => updatePreferences({ alerts: { ...a, [r.key]: v } })} />
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <Row title="Dicas explicativas nas telas"
          description="Textos curtos que explicam como cada tela funciona (por exemplo, a explicação dos campos em Faturas)."
          checked={prefs.hints} onChange={v => updatePreferences({ hints: v })} />
      </section>

      <Button variant="outline" size="sm" className="gap-1.5"
        onClick={() => { updatePreferences({ alerts: { daily: true, dueDates: true, cashflow: true, balance: true, incomes: true, nextMonth: true }, hints: true }); toast.success('Avisos restaurados'); }}>
        <RotateCcw size={13} /> Restaurar padrão
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('profile');
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 space-y-5 pb-28">
      <header>
        <h1 className="text-xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Seu perfil, a organização da tela inicial e os avisos.</p>
      </header>

      <div role="tablist" aria-label="Configurações" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-secondary p-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                tab === t.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}>
              <Icon size={13} aria-hidden /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === 'home' && <HomeTab />}
      {tab === 'alerts' && <AlertsTab />}
    </div>
  );
}
