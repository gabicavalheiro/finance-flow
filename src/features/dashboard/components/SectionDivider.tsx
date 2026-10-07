

export const SectionDivider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 py-1.5">
    <div className="flex-1 h-px bg-border" />
    <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">{label}</span>
    <div className="flex-1 h-px bg-border" />
  </div>
);
