-- Catálogo de rotas da operação.
-- A gravação continua em public.gravar_operacao_aero.

create table if not exists aero.rota (
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

alter table aero.rota enable row level security;

drop policy if exists rota_leitura on aero.rota;
drop policy if exists rota_escrita on aero.rota;

create policy rota_leitura on aero.rota
  for select to authenticated
  using (aero.pode_ler(organizacao_id));

create policy rota_escrita on aero.rota
  for all to authenticated
  using (aero.pode_escrever(organizacao_id))
  with check (aero.pode_escrever(organizacao_id));

grant select, insert, update, delete on aero.rota to authenticated;
grant all on aero.rota to service_role;

insert into aero.rota (
  id, organizacao_id, nome, origem_icao, destino_icao, origem_cidade, destino_cidade, horas_bloco, nota
)
select distinct on (p.origem_icao, p.destino_icao)
  lower(p.origem_icao || '-' || p.destino_icao),
  'ventura',
  trim(p.origem_cidade) || ' → ' || trim(p.destino_cidade),
  p.origem_icao,
  p.destino_icao,
  p.origem_cidade,
  p.destino_cidade,
  p.horas_bloco,
  ''
from aero.perna p
join aero.itinerario i on i.id = p.itinerario_id
where i.organizacao_id = 'ventura'
order by p.origem_icao, p.destino_icao, p.horas_bloco desc
on conflict (id) do nothing;
