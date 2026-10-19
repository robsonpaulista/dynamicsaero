import type { Metadata } from "next";
import { HangarForm } from "@/components/formularios/hangar-form";

export const metadata: Metadata = { title: "Editar hangar" };

export default async function EditarHangarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HangarForm id={id} />;
}
