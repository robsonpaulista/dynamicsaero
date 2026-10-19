import type { Metadata } from "next";
import { RateioView } from "@/components/rateio/rateio-view";

export const metadata: Metadata = { title: "Rateio" };

export default function RateioPage() {
  return <RateioView />;
}
