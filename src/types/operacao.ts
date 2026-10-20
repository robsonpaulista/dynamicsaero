export type Purpose = "negocios" | "pessoal";

export type ItineraryStatus =
  | "concluido"
  | "em_voo"
  | "confirmado"
  | "previsto"
  | "cancelado";

export type AircraftStatus = "disponivel" | "em_voo" | "manutencao";

export type AircraftCategory = "jato" | "helicoptero";

export type Posting = "realizado" | "previsto" | "provisionado";

export type Allocation = "participacao" | "solicitante";

export type ExpenseCategory =
  | "combustivel"
  | "taxas"
  | "handling"
  | "catering"
  | "hangar"
  | "seguro"
  | "tripulacao"
  | "administrativo"
  | "manutencao";

export type CrewRole = "comandante" | "copiloto" | "mecanico" | "gestor";

export type CrewStatus = "ativo" | "ferias" | "treinamento";

export type MxKind = "preventiva" | "corretiva";

export type MxStatus = "em_dia" | "proxima" | "em_execucao" | "concluida";

export type HangarStatus = "regular" | "renovacao";

export type AlertTone = "critico" | "atencao" | "info";

export type Ownership = {
  partnerId: string;
  share: number;
};

export type Aircraft = {
  id: string;
  registration: string;
  manufacturer: string;
  model: string;
  category: AircraftCategory;
  year: number;
  seats: number;
  serial: string;
  propulsion: string;
  range: string;
  baseIcao: string;
  baseName: string;
  hangarId: string;
  totalHours: number;
  cycles: number;
  status: AircraftStatus;
  ownership: Ownership[];
};

export type Partner = {
  id: string;
  name: string;
  shortName: string;
  company: string;
  role: string;
  phone: string;
};

export type CrewMember = {
  id: string;
  name: string;
  role: CrewRole;
  base: string;
  aircraftIds: string[];
  documentLabel: string;
  documentExpiry: string;
  medicalLabel: string | null;
  medicalExpiry: string | null;
  monthlyCost: number;
  status: CrewStatus;
  nextDuty: string;
};

export type Hangar = {
  id: string;
  name: string;
  airport: string;
  icao: string;
  slot: string;
  aircraftId: string;
  contract: string;
  contractUntil: string;
  monthlyFee: number;
  vendor: string;
  services: string[];
  manager: string;
  status: HangarStatus;
  note: string;
};

export type Insurance = {
  aircraftId: string;
  amount: number;
  vendor: string;
  description: string;
};

export type Rota = {
  id: string;
  nome: string;
  fromIcao: string;
  toIcao: string;
  fromCity: string;
  toCity: string;
  blockHours: number;
  note: string;
};

export type Leg = {
  id: string;
  date: string;
  depart: string;
  arrive: string;
  fromIcao: string;
  toIcao: string;
  fromCity: string;
  toCity: string;
  blockHours: number;
  fuel: number;
  fees: number;
  handling: number;
  catering: number;
  commanderId: string;
  copilotId?: string;
  posting?: Posting;
};

export type Itinerary = {
  id: string;
  aircraftId: string;
  title: string;
  purpose: Purpose;
  requestedBy: string;
  passengers: string[];
  status: ItineraryStatus;
  note: string;
  conditional?: string;
  legs: Leg[];
};

export type MaintenanceItem = {
  id: string;
  aircraftId: string;
  kind: MxKind;
  title: string;
  system: string;
  status: MxStatus;
  openedAt: string;
  dueAt: string | null;
  dueLabel: string;
  remainingHours: number | null;
  grounding: boolean;
  vendor: string;
  cost: number;
  estimate: number | null;
  competencia: string | null;
  posting: Posting | null;
  summary: string;
};

export type Expense = {
  id: string;
  aircraftId: string;
  itineraryId?: string;
  legId?: string;
  maintenanceId?: string;
  hangarId?: string;
  crewId?: string;
  manual?: boolean;
  month: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: number;
  allocation: Allocation;
  partnerId?: string;
  posting: Posting;
};

export type Alerta = {
  id: string;
  tone: AlertTone;
  title: string;
  detail: string;
  href: string;
};

export type RateioAircraft = {
  aircraftId: string;
  participacao: number;
  voos: number;
  total: number;
  hours: number;
};

export type RateioCategory = {
  category: ExpenseCategory;
  amount: number;
};

export type AporteMetodo = "pix" | "ted" | "boleto" | "compensacao";

export type Aporte = {
  id: string;
  partnerId: string;
  month: string;
  date: string;
  amount: number;
  method: AporteMetodo;
  reference: string;
  note: string;
  aircraftId: string | null;
};

export type AporteAplicado = {
  id: string;
  date: string;
  note: string;
  amount: number;
  aplicado: number;
};

export type NaturezaConta = "debito" | "credito";

export type LancamentoConta = {
  id: string;
  date: string;
  historico: string;
  natureza: NaturezaConta;
  valor: number;
  saldo: number;
};

export type ContaCorrente = {
  partnerId: string;
  saldoAnterior: number;
  debitos: number;
  creditos: number;
  saldo: number;
  lancamentos: LancamentoConta[];
};

export type RateioPartner = {
  partnerId: string;
  participacao: number;
  voos: number;
  total: number;
  pago: number;
  saldo: number;
  hours: number;
  byAircraft: RateioAircraft[];
  byCategory: RateioCategory[];
  aportes: AporteAplicado[];
};

export type Rateio = {
  partners: RateioPartner[];
  total: number;
  pago: number;
  saldo: number;
  realizado: number;
  previsto: number;
  provisionado: number;
  fecha: boolean;
};

export type Kpis = {
  horasVoadas: number;
  horasPrevistas: number;
  custoComprometido: number;
  custoRealizado: number;
  custoHora: number | null;
  prontas: number;
  totalAeronaves: number;
  retidas: string[];
  saldoAberto: number;
  variacaoHoras: string | null;
  variacaoCusto: string | null;
};

export type CategoryTotal = {
  category: ExpenseCategory;
  amount: number;
};
