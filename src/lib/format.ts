export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatMil(value: number): string {
  const absoluto = Math.abs(value);
  if (absoluto < 1000) return formatBRL(value);
  const mil = Math.round(absoluto / 1000);
  const sinal = value < 0 ? "-" : "";
  return `${sinal}R$ ${new Intl.NumberFormat("pt-BR").format(mil)} mil`;
}

export function formatHours(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} h`;
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function formatDateShort(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split("-");
  if (!month || !day) return iso;
  return `${day}/${month}`;
}

const MES_CURTO_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/** Data curta em lista: 31 mai */
export function formatDateLista(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split("-");
  if (!month || !day) return iso;
  const indice = Number(month) - 1;
  const mes = MES_CURTO_PT[indice];
  if (!mes) return `${day}/${month}`;
  return `${Number(day)} ${mes}`;
}

export function formatPercent(share: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(share * 100)}%`;
}

export function daysUntil(iso: string, today: string): number {
  const start = new Date(`${today.slice(0, 10)}T12:00:00`).getTime();
  const end = new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
