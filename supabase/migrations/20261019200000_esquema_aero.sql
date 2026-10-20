-- Esquema da Dynamics Aero.
-- Cada organização é um cliente. Aeronaves, sócios e o restante do cadastro
-- ficam presos a uma organização e não vazam para outra.
-- Rateio, conta corrente, alertas e indicadores continuam calculados no app.

create schema if not exists aero;

create table aero.organizacao (
  id text primary key,
  nome text not null,
  created_at timestamptz not null default now()
);

create table aero.membro (
  id text primary key,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel text not null check (papel in ('controlador', 'operacao', 'leitura')),
  created_at timestamptz not null default now(),
  unique (organizacao_id, user_id)
);

create or replace function aero.pode_ler(org text)
returns boolean
language sql
stable
security definer
set search_path = aero
as $$
  select exists (
    select 1
    from aero.membro
    where user_id = auth.uid()
      and organizacao_id = org
  );
$$;

create or replace function aero.pode_escrever(org text)
returns boolean
language sql
stable
security definer
set search_path = aero
as $$
  select exists (
    select 1
    from aero.membro
    where user_id = auth.uid()
      and organizacao_id = org
      and papel in ('controlador', 'operacao')
  );
$$;

create or replace function aero.pode_controlar(org text)
returns boolean
language sql
stable
security definer
set search_path = aero
as $$
  select exists (
    select 1
    from aero.membro
    where user_id = auth.uid()
      and organizacao_id = org
      and papel = 'controlador'
  );
$$;

revoke all on function aero.pode_ler(text) from public;
revoke all on function aero.pode_escrever(text) from public;
revoke all on function aero.pode_controlar(text) from public;
grant execute on function aero.pode_ler(text) to authenticated, service_role;
grant execute on function aero.pode_escrever(text) to authenticated, service_role;
grant execute on function aero.pode_controlar(text) to authenticated, service_role;

create table aero.socio (
  id text primary key,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  nome text not null,
  nome_curto text not null,
  empresa text not null default '',
  papel text not null default '',
  telefone text not null default '',
  created_at timestamptz not null default now()
);

create unique index socio_telefone_unico
  on aero.socio (organizacao_id, telefone)
  where telefone <> '';

create table aero.aeronave (
  id text primary key,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  matricula text not null,
  fabricante text not null default '',
  modelo text not null default '',
  categoria text not null check (categoria in ('jato', 'helicoptero')),
  ano integer not null,
  assentos integer not null,
  serie text not null default '',
  propulsao text not null default '',
  alcance text not null default '',
  base_icao text not null default '',
  base_nome text not null default '',
  horas_totais numeric(10, 1) not null default 0,
  ciclos integer not null default 0,
  status text not null check (status in ('disponivel', 'em_voo', 'manutencao')),
  created_at timestamptz not null default now(),
  unique (organizacao_id, matricula)
);

create table aero.participacao (
  id text primary key,
  aeronave_id text not null references aero.aeronave (id) on delete cascade,
  socio_id text not null references aero.socio (id) on delete cascade,
  percentual numeric(8, 6) not null check (percentual >= 0 and percentual <= 1),
  created_at timestamptz not null default now(),
  unique (aeronave_id, socio_id)
);

create table aero.tripulante (
  id text primary key,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  nome text not null,
  funcao text not null check (funcao in ('comandante', 'copiloto', 'mecanico', 'gestor')),
  base text not null default '',
  documento_rotulo text not null default '',
  documento_validade date,
  medico_rotulo text,
  medico_validade date,
  custo_mensal numeric(14, 2) not null default 0,
  status text not null check (status in ('ativo', 'ferias', 'treinamento')),
  proxima_escala text not null default '',
  created_at timestamptz not null default now()
);

create table aero.tripulante_aeronave (
  tripulante_id text not null references aero.tripulante (id) on delete cascade,
  aeronave_id text not null references aero.aeronave (id) on delete cascade,
  primary key (tripulante_id, aeronave_id)
);

create table aero.hangar (
  id text primary key,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  aeronave_id text not null unique references aero.aeronave (id) on delete cascade,
  nome text not null,
  aeroporto text not null default '',
  icao text not null default '',
  box text not null default '',
  contrato text not null default '',
  contrato_ate date,
  mensalidade numeric(14, 2) not null default 0,
  fornecedor text not null default '',
  servicos text[] not null default '{}',
  gestor text not null default '',
  status text not null check (status in ('regular', 'renovacao')),
  nota text not null default '',
  created_at timestamptz not null default now()
);

create table aero.seguro (
  id text primary key,
  aeronave_id text not null unique references aero.aeronave (id) on delete cascade,
  valor numeric(14, 2) not null default 0,
  fornecedor text not null default '',
  descricao text not null default '',
  created_at timestamptz not null default now()
);

create table aero.itinerario (
  id text primary key,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  aeronave_id text not null references aero.aeronave (id) on delete cascade,
  titulo text not null,
  finalidade text not null check (finalidade in ('negocios', 'pessoal')),
  solicitado_por text not null references aero.socio (id),
  passageiros text[] not null default '{}',
  status text not null check (status in ('concluido', 'em_voo', 'confirmado', 'previsto', 'cancelado')),
  nota text not null default '',
  condicional text,
  created_at timestamptz not null default now()
);

create table aero.perna (
  id text primary key,
  itinerario_id text not null references aero.itinerario (id) on delete cascade,
  data date not null,
  partida text not null,
  chegada text not null,
  origem_icao text not null,
  destino_icao text not null,
  origem_cidade text not null default '',
  destino_cidade text not null default '',
  horas_bloco numeric(6, 2) not null default 0,
  combustivel numeric(14, 2) not null default 0,
  taxas numeric(14, 2) not null default 0,
  handling numeric(14, 2) not null default 0,
  catering numeric(14, 2) not null default 0,
  comandante_id text not null references aero.tripulante (id),
  copiloto_id text references aero.tripulante (id),
  lancamento text check (lancamento in ('realizado', 'previsto', 'provisionado')),
  created_at timestamptz not null default now()
);

create table aero.manutencao (
  id text primary key,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  aeronave_id text not null references aero.aeronave (id) on delete cascade,
  tipo text not null check (tipo in ('preventiva', 'corretiva')),
  titulo text not null,
  sistema text not null default '',
  status text not null check (status in ('em_dia', 'proxima', 'em_execucao', 'concluida')),
  aberta_em date not null,
  vence_em date,
  vencimento_rotulo text not null default '',
  horas_restantes numeric(10, 1),
  retencao boolean not null default false,
  fornecedor text not null default '',
  custo numeric(14, 2) not null default 0,
  estimativa numeric(14, 2),
  competencia text,
  lancamento text check (lancamento in ('realizado', 'previsto', 'provisionado')),
  resumo text not null default '',
  created_at timestamptz not null default now()
);

create table aero.despesa (
  id text primary key,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  aeronave_id text not null references aero.aeronave (id) on delete cascade,
  itinerario_id text references aero.itinerario (id) on delete set null,
  perna_id text references aero.perna (id) on delete set null,
  manutencao_id text references aero.manutencao (id) on delete set null,
  hangar_id text references aero.hangar (id) on delete set null,
  tripulante_id text references aero.tripulante (id) on delete set null,
  manual boolean not null default false,
  competencia text not null,
  data date not null,
  categoria text not null check (
    categoria in (
      'combustivel', 'taxas', 'handling', 'catering', 'hangar',
      'seguro', 'tripulacao', 'administrativo', 'manutencao'
    )
  ),
  descricao text not null default '',
  fornecedor text not null default '',
  valor numeric(14, 2) not null,
  alocacao text not null check (alocacao in ('participacao', 'solicitante')),
  socio_id text references aero.socio (id),
  lancamento text not null check (lancamento in ('realizado', 'previsto', 'provisionado')),
  created_at timestamptz not null default now()
);

create table aero.rota (
  id text primary key,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  nome text not null,
  origem_icao text not null,
  destino_icao text not null,
  origem_cidade text not null default '',
  destino_cidade text not null default '',
  horas_bloco numeric(6, 2) not null default 0,
  nota text not null default '',
  created_at timestamptz not null default now()
);

create table aero.aporte (
  id text primary key,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  socio_id text not null references aero.socio (id),
  aeronave_id text references aero.aeronave (id),
  competencia text not null,
  data date not null,
  valor numeric(14, 2) not null,
  metodo text not null check (metodo in ('pix', 'ted', 'boleto', 'compensacao')),
  referencia text not null default '',
  nota text not null default '',
  created_at timestamptz not null default now()
);

create index aeronave_org_idx on aero.aeronave (organizacao_id);
create index socio_org_idx on aero.socio (organizacao_id);
create index membro_user_idx on aero.membro (user_id);
create index tripulante_org_idx on aero.tripulante (organizacao_id);
create index hangar_org_idx on aero.hangar (organizacao_id);
create index itinerario_org_idx on aero.itinerario (organizacao_id, aeronave_id);
create index perna_itinerario_idx on aero.perna (itinerario_id, data);
create index manutencao_org_idx on aero.manutencao (organizacao_id, aeronave_id);
create index despesa_org_idx on aero.despesa (organizacao_id, competencia);
create index aporte_org_idx on aero.aporte (organizacao_id, competencia);

create or replace function aero.exige_mesma_organizacao()
returns trigger
language plpgsql
as $$
declare
  org_aeronave text;
  org_socio text;
  org_tripulante text;
  org_itinerario text;
  org_hangar text;
begin
  if tg_table_name = 'participacao' then
    select organizacao_id into org_aeronave from aero.aeronave where id = new.aeronave_id;
    select organizacao_id into org_socio from aero.socio where id = new.socio_id;
    if org_aeronave is distinct from org_socio then
      raise exception 'sócio e aeronave pertencem a organizações diferentes';
    end if;
  elsif tg_table_name = 'tripulante_aeronave' then
    select organizacao_id into org_aeronave from aero.aeronave where id = new.aeronave_id;
    select organizacao_id into org_tripulante from aero.tripulante where id = new.tripulante_id;
    if org_aeronave is distinct from org_tripulante then
      raise exception 'tripulante e aeronave pertencem a organizações diferentes';
    end if;
  elsif tg_table_name = 'hangar' then
    select organizacao_id into org_aeronave from aero.aeronave where id = new.aeronave_id;
    if org_aeronave is distinct from new.organizacao_id then
      raise exception 'hangar e aeronave pertencem a organizações diferentes';
    end if;
  elsif tg_table_name = 'itinerario' then
    select organizacao_id into org_aeronave from aero.aeronave where id = new.aeronave_id;
    select organizacao_id into org_socio from aero.socio where id = new.solicitado_por;
    if org_aeronave is distinct from new.organizacao_id
       or org_socio is distinct from new.organizacao_id then
      raise exception 'itinerário mistura organizações diferentes';
    end if;
  elsif tg_table_name = 'perna' then
    select organizacao_id into org_itinerario from aero.itinerario where id = new.itinerario_id;
    select organizacao_id into org_tripulante from aero.tripulante where id = new.comandante_id;
    if org_tripulante is distinct from org_itinerario then
      raise exception 'comandante de outra organização';
    end if;
    if new.copiloto_id is not null then
      select organizacao_id into org_tripulante from aero.tripulante where id = new.copiloto_id;
      if org_tripulante is distinct from org_itinerario then
        raise exception 'copiloto de outra organização';
      end if;
    end if;
  elsif tg_table_name = 'manutencao' then
    select organizacao_id into org_aeronave from aero.aeronave where id = new.aeronave_id;
    if org_aeronave is distinct from new.organizacao_id then
      raise exception 'manutenção e aeronave pertencem a organizações diferentes';
    end if;
  elsif tg_table_name = 'despesa' then
    select organizacao_id into org_aeronave from aero.aeronave where id = new.aeronave_id;
    if org_aeronave is distinct from new.organizacao_id then
      raise exception 'despesa e aeronave pertencem a organizações diferentes';
    end if;
    if new.socio_id is not null then
      select organizacao_id into org_socio from aero.socio where id = new.socio_id;
      if org_socio is distinct from new.organizacao_id then
        raise exception 'despesa aponta para sócio de outra organização';
      end if;
    end if;
    if new.itinerario_id is not null then
      select organizacao_id into org_itinerario from aero.itinerario where id = new.itinerario_id;
      if org_itinerario is distinct from new.organizacao_id then
        raise exception 'despesa aponta para itinerário de outra organização';
      end if;
    end if;
    if new.manutencao_id is not null then
      select organizacao_id into org_aeronave from aero.manutencao where id = new.manutencao_id;
      if org_aeronave is distinct from new.organizacao_id then
        raise exception 'despesa aponta para manutenção de outra organização';
      end if;
    end if;
    if new.hangar_id is not null then
      select organizacao_id into org_hangar from aero.hangar where id = new.hangar_id;
      if org_hangar is distinct from new.organizacao_id then
        raise exception 'despesa aponta para hangar de outra organização';
      end if;
    end if;
    if new.tripulante_id is not null then
      select organizacao_id into org_tripulante from aero.tripulante where id = new.tripulante_id;
      if org_tripulante is distinct from new.organizacao_id then
        raise exception 'despesa aponta para tripulante de outra organização';
      end if;
    end if;
  elsif tg_table_name = 'aporte' then
    select organizacao_id into org_socio from aero.socio where id = new.socio_id;
    if org_socio is distinct from new.organizacao_id then
      raise exception 'aporte aponta para sócio de outra organização';
    end if;
    if new.aeronave_id is not null then
      select organizacao_id into org_aeronave from aero.aeronave where id = new.aeronave_id;
      if org_aeronave is distinct from new.organizacao_id then
        raise exception 'aporte aponta para aeronave de outra organização';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger participacao_mesma_org
  before insert or update on aero.participacao
  for each row execute function aero.exige_mesma_organizacao();

create trigger tripulante_aeronave_mesma_org
  before insert or update on aero.tripulante_aeronave
  for each row execute function aero.exige_mesma_organizacao();

create trigger hangar_mesma_org
  before insert or update on aero.hangar
  for each row execute function aero.exige_mesma_organizacao();

create trigger itinerario_mesma_org
  before insert or update on aero.itinerario
  for each row execute function aero.exige_mesma_organizacao();

create trigger perna_mesma_org
  before insert or update on aero.perna
  for each row execute function aero.exige_mesma_organizacao();

create trigger manutencao_mesma_org
  before insert or update on aero.manutencao
  for each row execute function aero.exige_mesma_organizacao();

create trigger despesa_mesma_org
  before insert or update on aero.despesa
  for each row execute function aero.exige_mesma_organizacao();

create trigger aporte_mesma_org
  before insert or update on aero.aporte
  for each row execute function aero.exige_mesma_organizacao();

alter table aero.organizacao enable row level security;
alter table aero.membro enable row level security;
alter table aero.socio enable row level security;
alter table aero.aeronave enable row level security;
alter table aero.participacao enable row level security;
alter table aero.tripulante enable row level security;
alter table aero.tripulante_aeronave enable row level security;
alter table aero.hangar enable row level security;
alter table aero.seguro enable row level security;
alter table aero.itinerario enable row level security;
alter table aero.perna enable row level security;
alter table aero.manutencao enable row level security;
alter table aero.despesa enable row level security;
alter table aero.aporte enable row level security;

create policy organizacao_leitura on aero.organizacao
  for select to authenticated
  using (aero.pode_ler(id));

create policy organizacao_escrita on aero.organizacao
  for update to authenticated
  using (aero.pode_controlar(id))
  with check (aero.pode_controlar(id));

create policy membro_leitura on aero.membro
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy membro_escrita on aero.membro
  for all to authenticated
  using (aero.pode_controlar(organizacao_id))
  with check (aero.pode_controlar(organizacao_id));

create policy socio_leitura on aero.socio
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy socio_escrita on aero.socio
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

create policy aeronave_leitura on aero.aeronave
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy aeronave_escrita on aero.aeronave
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

create policy participacao_leitura on aero.participacao
  for select to authenticated
  using (aero.pode_ler((select organizacao_id from aero.aeronave where id = aeronave_id)));

create policy participacao_escrita on aero.participacao
  for all to authenticated
  using (aero.pode_escrever((select organizacao_id from aero.aeronave where id = aeronave_id)))
  with check (aero.pode_escrever((select organizacao_id from aero.aeronave where id = aeronave_id)));

create policy tripulante_leitura on aero.tripulante
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy tripulante_escrita on aero.tripulante
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

create policy tripulante_aeronave_leitura on aero.tripulante_aeronave
  for select to authenticated
  using (aero.pode_ler((select organizacao_id from aero.aeronave where id = aeronave_id)));

create policy tripulante_aeronave_escrita on aero.tripulante_aeronave
  for all to authenticated
  using (aero.pode_escrever((select organizacao_id from aero.aeronave where id = aeronave_id)))
  with check (aero.pode_escrever((select organizacao_id from aero.aeronave where id = aeronave_id)));

create policy hangar_leitura on aero.hangar
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy hangar_escrita on aero.hangar
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

create policy seguro_leitura on aero.seguro
  for select to authenticated
  using (aero.pode_ler((select organizacao_id from aero.aeronave where id = aeronave_id)));

create policy seguro_escrita on aero.seguro
  for all to authenticated
  using (aero.pode_escrever((select organizacao_id from aero.aeronave where id = aeronave_id)))
  with check (aero.pode_escrever((select organizacao_id from aero.aeronave where id = aeronave_id)));

create policy itinerario_leitura on aero.itinerario
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy itinerario_escrita on aero.itinerario
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

create policy perna_leitura on aero.perna
  for select to authenticated
  using (
    aero.pode_ler((select organizacao_id from aero.itinerario where id = itinerario_id))
  );

create policy perna_escrita on aero.perna
  for all to authenticated
  using (
    aero.pode_escrever((select organizacao_id from aero.itinerario where id = itinerario_id))
  )
  with check (
    aero.pode_escrever((select organizacao_id from aero.itinerario where id = itinerario_id))
  );

create policy manutencao_leitura on aero.manutencao
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy manutencao_escrita on aero.manutencao
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

create policy despesa_leitura on aero.despesa
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy despesa_escrita on aero.despesa
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

create policy rota_leitura on aero.rota
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy rota_escrita on aero.rota
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

create policy aporte_leitura on aero.aporte
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy aporte_escrita on aero.aporte
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

grant usage on schema aero to authenticated, service_role;
grant select, insert, update, delete on all tables in schema aero to authenticated;
grant all on all tables in schema aero to service_role;
grant usage, select on all sequences in schema aero to authenticated, service_role;
