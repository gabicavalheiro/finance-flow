import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { CustomCategory, getCustomCategories, isCustomCategory } from '@/lib/customCategories';

interface CustomCategoryContextValue {
  customCategories: CustomCategory[];
  reload: () => Promise<void>;
  findCustomCategory: (id: string) => CustomCategory | undefined;
}

const CustomCategoryContext = createContext<CustomCategoryContextValue>({
  customCategories: [],
  reload: async () => {},
  findCustomCategory: () => undefined,
});

export function CustomCategoryProvider({ children }: { children: ReactNode }) {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  const reload = useCallback(async () => {
    const cats = await getCustomCategories();
    setCustomCategories(cats);
  }, []);

  // Este provider fica acima do <App/> (main.tsx), então monta antes do Firebase Auth
  // terminar de restaurar a sessão. getCustomCategories() precisa de auth.currentUser
  // (firestorePaths.ts) — chamar reload() direto no mount buscava sem usuário ainda,
  // a busca falhava e o cache em memória guardava lista vazia PRA SEMPRE (só se corrigia
  // ao criar uma categoria nova, que invalida o cache). Por isso espera o auth avisar que
  // já tem usuário antes de buscar, e também recarrega ao trocar de conta no mesmo device.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) reload(); else setCustomCategories([]);
    });
    return unsubscribe;
  }, [reload]);

  const findCustomCategory = useCallback(
    (id: string) => customCategories.find(c => c.id === id),
    [customCategories]
  );

  return (
    <CustomCategoryContext.Provider value={{ customCategories, reload, findCustomCategory }}>
      {children}
    </CustomCategoryContext.Provider>
  );
}

export function useCustomCategories() {
  return useContext(CustomCategoryContext);
}

export { isCustomCategory };
