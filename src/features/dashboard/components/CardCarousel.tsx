import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CreditCard as CreditCardIcon, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { CreditCard } from '@/lib/types';
import { cardSurface, CARD_BORDER } from '@/lib/cardStyle';

// Símbolo da bandeira
export function BrandSymbol({ brand }: { brand: string }) {
  if (brand === 'visa') return (
    <span className="font-bold italic text-white text-lg tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>VISA</span>
  );
  if (brand === 'mastercard') return (
    <div className="flex items-center">
      <div className="w-6 h-6 rounded-full bg-red-500/90" />
      <div className="w-6 h-6 rounded-full bg-yellow-400/90 -ml-3" />
    </div>
  );
  if (brand === 'amex') return (
    <span className="font-bold text-white text-xs tracking-widest">AMEX</span>
  );
  if (brand === 'elo') return (
    <span className="font-bold text-white text-lg" style={{ fontFamily: 'Georgia, serif' }}>elo</span>
  );
  return <CreditCardIcon size={20} className="text-white/80" />;
}

export function CardCarousel({
  cards,
  installmentsByCard,
}: {
  cards: CreditCard[];
  installmentsByCard: Map<string, number>;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling  = useRef(false);
  const total = cards.length;

  if (total === 0) return null;

  // Scroll programático ao mudar activeIdx pelas setas
  const scrollToIdx = (idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    isScrolling.current = true;
    const cardWidth = ((el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.offsetWidth * 0.88) + 12; // largura do card + gap
    el.scrollTo({ left: idx * cardWidth, behavior: 'smooth' });
    setTimeout(() => { isScrolling.current = false; }, 400);
  };

  const prev = () => {
    const newIdx = (activeIdx - 1 + total) % total;
    setActiveIdx(newIdx);
    scrollToIdx(newIdx);
  };

  const next = () => {
    const newIdx = (activeIdx + 1) % total;
    setActiveIdx(newIdx);
    scrollToIdx(newIdx);
  };

  const goTo = (idx: number) => {
    setActiveIdx(idx);
    scrollToIdx(idx);
  };

  // Atualizar índice ativo ao rolar manualmente
  const handleScroll = () => {
    if (isScrolling.current) return;
    const el = containerRef.current;
    if (!el) return;
    const cardWidth = ((el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.offsetWidth * 0.88) + 12;
    const newIdx = Math.round(el.scrollLeft / cardWidth);
    if (newIdx !== activeIdx && newIdx >= 0 && newIdx < total) {
      setActiveIdx(newIdx);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28, duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-primary/15 flex items-center justify-center">
            <CreditCardIcon size={13} className="text-primary" />
          </div>
          <p className="text-sm font-semibold">Meus cartões</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">{total}</span>
        </div>
        {total > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={prev}
              className="w-8 h-8 rounded-xl bg-secondary/80 hover:bg-secondary flex items-center justify-center transition-colors border border-border/50"
            >
              <ChevronLeft size={15} className="text-muted-foreground" />
            </button>
            <button
              onClick={next}
              className="w-8 h-8 rounded-xl bg-secondary/80 hover:bg-secondary flex items-center justify-center transition-colors border border-border/50"
            >
              <ChevronRight size={15} className="text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Track com peek dos cartões adjacentes */}
      <div className="relative rounded-2xl overflow-hidden">


        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-3"
          style={{
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollPaddingLeft: 12,
            ...(total > 1 ? { maskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent)' } : undefined),
          }}
        >
          {cards.map((card, i) => {
            const spent     = installmentsByCard.get(card.id) ?? 0;
            const available = Math.max(0, card.limit - spent);
            const usedPct   = card.limit > 0 ? Math.min(100, (spent / card.limit) * 100) : 0;
            const gradient  = cardSurface(card.brand, card.customGradient);
            const isActive  = i === activeIdx;

            return (
              <div
                key={card.id}
                onClick={() => goTo(i)}
                className="relative rounded-3xl overflow-hidden text-white cursor-pointer select-none"
                style={{
                  background: gradient,
                  flex: '0 0 min(88%, 400px)',
                  height: 190,
                  scrollSnapAlign: 'start',
                  flexShrink: 0,
                  opacity: isActive ? 1 : 0.65,
                  transform: isActive ? 'scale(1)' : 'scale(0.94)',
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                  filter: card.active === false ? 'grayscale(0.85)' : undefined,
                }}
              >
                {/* Borda glass */}
                <div className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{ border: CARD_BORDER }} />

                {/* Badge vencimento */}
                <div className="absolute top-4 right-4 z-20 px-2.5 py-1 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)' }}>
                  <p className="text-white/75 text-[10px] font-medium whitespace-nowrap">Vence dia {card.dueDay}</p>
                </div>

                {/* Badge bloqueado */}
                {card.active === false && (
                  <div className="absolute top-4 left-4 z-20 px-2.5 py-1 rounded-xl flex items-center gap-1"
                    style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}>
                    <Lock size={9} className="text-white/85" />
                    <p className="text-white/85 text-[10px] font-medium whitespace-nowrap">Bloqueado</p>
                  </div>
                )}

                <div className="relative z-10 p-5 h-full flex flex-col justify-between">
                  {/* Topo */}
                  <div className="flex items-start justify-between">
                    <div>
                      <BrandSymbol brand={card.brand} />
                      <p className="text-white/70 text-xs mt-1.5 font-medium">{card.name}</p>
                    </div>
                    {/* NFC */}
                    <div className="flex flex-col gap-0.5 mt-1 opacity-40">
                      {[14, 11, 8].map(w => (
                        <div key={w} className="h-0.5 rounded-full bg-white" style={{ width: w }} />
                      ))}
                    </div>
                  </div>

                  {/* Número */}
                  <p className="text-white/50 font-mono text-sm tracking-[0.22em]">
                    •••• •••• •••• {card.lastDigits}
                  </p>

                  {/* Base */}
                  <div>
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <p className="text-white/50 text-[11px] mb-0.5">Fatura</p>
                        <p className="text-white font-display font-semibold text-xl tabular-nums leading-none">{formatCurrency(spent)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/50 text-[11px] mb-0.5">Disponível</p>
                        <p className="text-white/85 font-semibold text-sm tabular-nums leading-none">{formatCurrency(available)}</p>
                      </div>
                    </div>
                    <div className="h-1 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${usedPct}%`, background: usedPct >= 90 ? 'hsl(0 75% 64%)' : 'rgba(255,255,255,0.8)' }} />
                    </div>
                    <p className="text-white/45 text-[10px] mt-1">{Math.round(usedPct)}% do limite</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dots */}
      {total > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === activeIdx ? 20 : 6,
                height: 6,
                background: i === activeIdx ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
