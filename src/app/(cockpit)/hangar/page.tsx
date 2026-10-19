import type { Metadata } from "next";
import { HangarView } from "@/components/hangar/hangar-view";

export const metadata: Metadata = { title: "Hangar" };

export default function HangarPage() {
  return <HangarView />;
}
