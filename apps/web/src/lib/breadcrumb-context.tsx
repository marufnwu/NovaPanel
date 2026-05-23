import { createContext, useContext } from 'react';

interface BreadcrumbOverride {
  path: string;
  label: string;
}

const BreadcrumbOverridesContext = createContext<{
  overrides: BreadcrumbOverride[];
  setOverride: (path: string, label: string) => void;
  clearOverride: (path: string) => void;
}>({
  overrides: [],
  setOverride: () => {},
  clearOverride: () => {},
});

export function BreadcrumbProvider({ children, overrides, setOverride, clearOverride }: React.PropsWithChildren<{
  overrides: BreadcrumbOverride[];
  setOverride: (path: string, label: string) => void;
  clearOverride: (path: string) => void;
}>) {
  return (
    <BreadcrumbOverridesContext.Provider value={{ overrides, setOverride, clearOverride }}>
      {children}
    </BreadcrumbOverridesContext.Provider>
  );
}

export function useBreadcrumbOverride(path: string, label: string) {
  const ctx = useContext(BreadcrumbOverridesContext);
  ctx.setOverride(path, label);
}