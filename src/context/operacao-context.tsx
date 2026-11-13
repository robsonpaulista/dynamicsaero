"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { HOJE, mesDeReferencia, partnerIdDaSessao, type MonthFilter } from "@/services/operacao";
import type { SessaoUsuario } from "@/types/usuario";

type OperacaoContextValue = {
  aircraftId: string;
  setAircraftId: (aircraftId: string) => void;
  months: MonthFilter;
  setMonths: (months: MonthFilter) => void;
  /** Competência única para formulários (último mês do recorte). */
  month: string;
  sessao: SessaoUsuario;
  /** Cotista da sessão, se houver; null = visão operacional agregada. */
  partnerId: string | null;
};

const OperacaoContext = createContext<OperacaoContextValue | null>(null);

/** Mês corrente da operação (HOJE), no formato YYYY-MM. */
function mesAtualOperacao(): MonthFilter {
  return [HOJE.slice(0, 7)] as MonthFilter;
}

export function OperacaoProvider({
  children,
  sessao,
}: {
  children: ReactNode;
  sessao: SessaoUsuario;
}) {
  const [aircraftId, setAircraftId] = useState<string>("todas");
  const [months, setMonths] = useState<MonthFilter>(mesAtualOperacao);
  const partnerId = useMemo(
    () => partnerIdDaSessao(sessao.nome, sessao.papel),
    [sessao.nome, sessao.papel],
  );
  const value = useMemo(
    () => ({
      aircraftId,
      setAircraftId,
      months,
      setMonths,
      month: mesDeReferencia(months),
      sessao,
      partnerId,
    }),
    [aircraftId, months, partnerId, sessao],
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
