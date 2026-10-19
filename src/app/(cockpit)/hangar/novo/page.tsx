import type { Metadata } from "next";
import { HangarForm } from "@/components/formularios/hangar-form";

export const metadata: Metadata = { title: "Novo hangar" };

export default function NovoHangarPage() {
  return <HangarForm />;
}
