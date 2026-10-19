import {
  LayoutDashboard,
  MessageCircle,
  PieChart,
  Plane,
  Receipt,
  Route,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  title: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/painel", title: "Painel", icon: LayoutDashboard },
  { href: "/frota", title: "Frota", icon: Plane },
  { href: "/itinerarios", title: "Itinerários", icon: Route },
  { href: "/despesas", title: "Despesas", icon: Receipt },
  { href: "/hangar", title: "Hangar", icon: Warehouse },
  { href: "/pessoal", title: "Pessoal", icon: Users },
  { href: "/manutencao", title: "Manutenção", icon: Wrench },
  { href: "/rateio", title: "Rateio", icon: PieChart },
  { href: "/agente", title: "Agente", icon: MessageCircle },
];

export function titleForPath(pathname: string): string {
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.title ?? "Dynamics Aero";
}
