import { useState } from 'react';

/**
 * Hook para listas colapsáveis.
 * @param total   Número total de itens
 * @param initial Itens visíveis por padrão (default 3)
 */
export function useCollapse(total: number, initial = 3) {
  const [expanded, setExpanded] = useState(false);
  const visible  = expanded ? total : Math.min(initial, total);
  const hidden   = total - initial;
  const toggle   = () => setExpanded(e => !e);
  return { expanded, toggle, visible, hidden };
}
