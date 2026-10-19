"use client";

import { useSyncExternalStore } from "react";
import { getBase, getPronto, getServerBase, subscribeDados, type BaseDados } from "@/services/dados";

export function useDados(): BaseDados {
  return useSyncExternalStore(subscribeDados, getBase, getServerBase);
}

export function usePronto(): boolean {
  return useSyncExternalStore(subscribeDados, getPronto, () => false);
}
