-- Tabelas que as funções ler/gravar_operacao_aero já esperam, mas ainda não existiam no banco.

create table if not exists aero.plano_conta (
  id text primary key,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  nome text not null,
  categoria text not null,
  grupo text not null check (grupo in ('fixa', 'variavel')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table aero.plano_conta enable row level security;

drop policy if exists plano_conta_leitura on aero.plano_conta;
drop policy if exists plano_conta_escrita on aero.plano_conta;

create policy plano_conta_leitura on aero.plano_conta
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy plano_conta_escrita on aero.plano_conta
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

grant select, insert, update, delete on aero.plano_conta to authenticated;
grant all on aero.plano_conta to service_role;

alter table aero.despesa
  add column if not exists conta_id text references aero.plano_conta (id) on delete set null;

create table if not exists aero.aerodromo (
  icao text not null,
  organizacao_id text not null references aero.organizacao (id) on delete cascade,
  cidade text not null,
  created_at timestamptz not null default now(),
  primary key (organizacao_id, icao)
);

alter table aero.aerodromo enable row level security;

drop policy if exists aerodromo_leitura on aero.aerodromo;
drop policy if exists aerodromo_escrita on aero.aerodromo;

create policy aerodromo_leitura on aero.aerodromo
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy aerodromo_escrita on aero.aerodromo
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

grant select, insert, update, delete on aero.aerodromo to authenticated;
grant all on aero.aerodromo to service_role;
