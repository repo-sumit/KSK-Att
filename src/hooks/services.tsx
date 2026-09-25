'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { AppContainer } from '@/services/container';

const ServicesContext = createContext<AppContainer | null>(null);

export function ServicesProvider({ container, children }: { readonly container: AppContainer; readonly children: ReactNode }) {
  return <ServicesContext.Provider value={container}>{children}</ServicesContext.Provider>;
}

/** The composition root's container. Stable for the app's lifetime. */
export function useContainer(): AppContainer {
  const container = useContext(ServicesContext);
  if (!container) throw new Error('useContainer outside ServicesProvider');
  return container;
}

export const useServices = () => useContainer().services;
