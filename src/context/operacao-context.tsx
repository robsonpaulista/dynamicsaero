"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type OperacaoContextValue = {
  aircraftId: string;
  setAircraftId: (aircraftId: string) => void;
  month: string;
  setMonth: (month: string) => void;
};

const OperacaoContext = createContext<OperacaoContextValue | null>(null);

export function OperacaoProvider({ children }: { children: ReactNode }) {
  const [aircraftId, setAircraftId] = useState<string>("todas");
  const [month, setMonth] = useState<string>("2026-10");
  const value = useMemo(
    () => ({ aircraftId, setAircraftId, month, setMonth }),
    [aircraftId, month],
  );

  return (
    <OperacaoContext.Provider value={value}>{children}</OperacaoContext.Provider>
  );
}

export function useOperacao(): OperacaoContextValue {
  const value = useContext(OperacaoContext);
  if (!value) {
    throw new Error("useOperacao precisa estar dentro do OperacaoProvider");
  }
  return value;
}
