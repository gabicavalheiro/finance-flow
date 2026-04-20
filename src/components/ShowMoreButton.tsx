import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  expanded: boolean;
  hidden: number;
  onToggle: () => void;
}

export default function ShowMoreButton({ expanded, hidden, onToggle }: Props) {
  if (hidden <= 0) return null;
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-secondary/50"
    >
      {expanded ? (
        <><ChevronUp size={13} /> Recolher</>
      ) : (
        <><ChevronDown size={13} /> Ver mais {hidden} {hidden === 1 ? 'item' : 'itens'}</>
      )}
    </button>
  );
}
