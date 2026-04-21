import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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

  useEffect(() => {
    reload();
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
