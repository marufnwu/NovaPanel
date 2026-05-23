import { useState, useEffect } from 'react';

type SetOverride = (path: string, label: string) => void;
type ClearOverride = (path: string) => void;

let globalOverrides: Map<string, string> = new Map();
let listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach(fn => fn());
}

export function setBreadcrumbOverride(path: string, label: string) {
  globalOverrides = new Map(globalOverrides);
  globalOverrides.set(path, label);
  notify();
}

export function clearBreadcrumbOverride(path: string) {
  globalOverrides = new Map(globalOverrides);
  globalOverrides.delete(path);
  notify();
}

export function getBreadcrumbOverrides(): Map<string, string> {
  return globalOverrides;
}

export function useBreadcrumbOverride(path: string, label: string) {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender(n => n + 1);
    listeners.add(listener);
    setBreadcrumbOverride(path, label);
    return () => {
      listeners.delete(listener);
      clearBreadcrumbOverride(path);
    };
  }, [path, label]);
}