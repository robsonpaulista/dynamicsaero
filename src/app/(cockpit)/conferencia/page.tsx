import type { Metadata } from "next";
import { ConferenciaShell } from "@/components/conferencia/conferencia-shell";

export const metadata: Metadata = { title: "Conferência" };

export default function ConferenciaPage() {
  return <ConferenciaShell />;
}
