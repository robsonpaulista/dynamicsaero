-- Leitura e gravação da operação pelo aplicativo.
-- A chave de serviço chama estas funções. A chave anônima não executa.

create or replace function public.ler_operacao_aero()
returns jsonb
language plpgsql
stable
security definer
set search_path = aero, public
as $$
declare
  resultado jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'sem permissão';
  end if;

  if not exists (select 1 from aero.organizacao where id = 'ventura') then
    return jsonb_build_object(
      'aircraft', '[]'::jsonb,
      'partners', '[]'::jsonb,
      'crew', '[]'::jsonb,
      'hangars', '[]'::jsonb,
      'seguros', '[]'::jsonb,
      'itineraries', '[]'::jsonb,
      'rotas', '[]'::jsonb,
      'maintenance', '[]'::jsonb,
      'extras', '[]'::jsonb,
      'aportes', '[]'::jsonb
    );
  end if;

  select jsonb_build_object(
    'partners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.nome,
        'shortName', s.nome_curto,
        'company', s.empresa,
        'role', s.papel,
        'phone', s.telefone
      ) order by s.nome)
      from aero.socio s
      where s.organizacao_id = 'ventura'
    ), '[]'::jsonb),
    'aircraft', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'registration', a.matricula,
        'manufacturer', a.fabricante,
        'model', a.modelo,
        'category', a.categoria,
        'year', a.ano,
        'seats', a.assentos,
        'serial', a.serie,
        'propulsion', a.propulsao,
        'range', a.alcance,
        'baseIcao', a.base_icao,
        'baseName', a.base_nome,
        'hangarId', coalesce((select h.id from aero.hangar h where h.aeronave_id = a.id), ''),
        'totalHours', a.horas_totais,
        'cycles', a.ciclos,
        'status', a.status,
        'ownership', coalesce((
          select jsonb_agg(jsonb_build_object(
            'partnerId', p.socio_id,
            'share', p.percentual
          ) order by p.socio_id)
          from aero.participacao p
          where p.aeronave_id = a.id
        ), '[]'::jsonb)
      ) order by a.matricula)
      from aero.aeronave a
      where a.organizacao_id = 'ventura'
    ), '[]'::jsonb),
    'crew', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.nome,
        'role', t.funcao,
        'base', t.base,
        'aircraftIds', coalesce((
          select jsonb_agg(ta.aeronave_id order by ta.aeronave_id)
          from aero.tripulante_aeronave ta
          where ta.tripulante_id = t.id
        ), '[]'::jsonb),
        'documentLabel', t.documento_rotulo,
        'documentExpiry', t.documento_validade,
        'medicalLabel', t.medico_rotulo,
        'medicalExpiry', t.medico_validade,
        'monthlyCost', t.custo_mensal,
        'status', t.status,
        'nextDuty', t.proxima_escala
      ) order by t.nome)
      from aero.tripulante t
      where t.organizacao_id = 'ventura'
    ), '[]'::jsonb),
    'hangars', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'name', h.nome,
        'airport', h.aeroporto,
        'icao', h.icao,
        'slot', h.box,
        'aircraftId', h.aeronave_id,
        'contract', h.contrato,
        'contractUntil', h.contrato_ate,
        'monthlyFee', h.mensalidade,
        'vendor', h.fornecedor,
        'services', to_jsonb(h.servicos),
        'manager', h.gestor,
        'status', h.status,
        'note', h.nota
      ) order by h.nome)
      from aero.hangar h
      where h.organizacao_id = 'ventura'
    ), '[]'::jsonb),
    'seguros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'aircraftId', g.aeronave_id,
        'amount', g.valor,
        'vendor', g.fornecedor,
        'description', g.descricao
      ) order by g.aeronave_id)
      from aero.seguro g
      join aero.aeronave a on a.id = g.aeronave_id
      where a.organizacao_id = 'ventura'
    ), '[]'::jsonb),
    'itineraries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'aircraftId', i.aeronave_id,
        'title', i.titulo,
        'purpose', i.finalidade,
        'requestedBy', i.solicitado_por,
        'passengers', to_jsonb(i.passageiros),
        'status', i.status,
        'note', i.nota,
        'conditional', i.condicional,
        'legs', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', pe.id,
            'date', pe.data,
            'depart', pe.partida,
            'arrive', pe.chegada,
            'fromIcao', pe.origem_icao,
            'toIcao', pe.destino_icao,
            'fromCity', pe.origem_cidade,
            'toCity', pe.destino_cidade,
            'blockHours', pe.horas_bloco,
            'fuel', pe.combustivel,
            'fees', pe.taxas,
            'handling', pe.handling,
            'catering', pe.catering,
            'commanderId', pe.comandante_id,
            'copilotId', pe.copiloto_id,
            'posting', pe.lancamento
          ) order by pe.data, pe.partida, pe.id)
          from aero.perna pe
          where pe.itinerario_id = i.id
        ), '[]'::jsonb)
      ) order by i.created_at, i.id)
      from aero.itinerario i
      where i.organizacao_id = 'ventura'
    ), '[]'::jsonb),
    'maintenance', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'aircraftId', m.aeronave_id,
        'kind', m.tipo,
        'title', m.titulo,
        'system', m.sistema,
        'status', m.status,
        'openedAt', m.aberta_em,
        'dueAt', m.vence_em,
        'dueLabel', m.vencimento_rotulo,
        'remainingHours', m.horas_restantes,
        'grounding', m.retencao,
        'vendor', m.fornecedor,
        'cost', m.custo,
        'estimate', m.estimativa,
        'competencia', m.competencia,
        'posting', m.lancamento,
        'summary', m.resumo
      ) order by m.aberta_em, m.id)
      from aero.manutencao m
      where m.organizacao_id = 'ventura'
    ), '[]'::jsonb),
    'extras', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'aircraftId', d.aeronave_id,
        'itineraryId', d.itinerario_id,
        'legId', d.perna_id,
        'maintenanceId', d.manutencao_id,
        'hangarId', d.hangar_id,
        'crewId', d.tripulante_id,
        'manual', d.manual,
        'month', d.competencia,
        'date', d.data,
        'category', d.categoria,
        'description', d.descricao,
        'vendor', d.fornecedor,
        'amount', d.valor,
        'allocation', d.alocacao,
        'partnerId', d.socio_id,
        'posting', d.lancamento
      ) order by d.data, d.id)
      from aero.despesa d
      where d.organizacao_id = 'ventura'
    ), '[]'::jsonb),
    'aportes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ap.id,
        'partnerId', ap.socio_id,
        'month', ap.competencia,
        'date', ap.data,
        'amount', ap.valor,
        'method', ap.metodo,
        'reference', ap.referencia,
        'note', ap.nota,
        'aircraftId', ap.aeronave_id
      ) order by ap.data, ap.id)
      from aero.aporte ap
      where ap.organizacao_id = 'ventura'
    ), '[]'::jsonb),
    'rotas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'nome', r.nome,
        'fromIcao', r.origem_icao,
        'toIcao', r.destino_icao,
        'fromCity', r.origem_cidade,
        'toCity', r.destino_cidade,
        'blockHours', r.horas_bloco,
        'note', r.nota
      ) order by r.nome)
      from aero.rota r
      where r.organizacao_id = 'ventura'
    ), '[]'::jsonb)
  )
  into resultado;

  return resultado;
end;
$$;

create or replace function public.gravar_operacao_aero(payload jsonb)
returns void
language plpgsql
security definer
set search_path = aero, public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'sem permissão';
  end if;

  insert into aero.organizacao (id, nome)
  values ('ventura', 'Ventura Aviação')
  on conflict (id) do update set nome = excluded.nome;

  delete from aero.rota where organizacao_id = 'ventura';
  delete from aero.aporte where organizacao_id = 'ventura';
  delete from aero.despesa where organizacao_id = 'ventura';
  delete from aero.perna
  where itinerario_id in (select id from aero.itinerario where organizacao_id = 'ventura');
  delete from aero.itinerario where organizacao_id = 'ventura';
  delete from aero.manutencao where organizacao_id = 'ventura';
  delete from aero.seguro
  where aeronave_id in (select id from aero.aeronave where organizacao_id = 'ventura');
  delete from aero.hangar where organizacao_id = 'ventura';
  delete from aero.tripulante_aeronave
  where tripulante_id in (select id from aero.tripulante where organizacao_id = 'ventura');
  delete from aero.participacao
  where aeronave_id in (select id from aero.aeronave where organizacao_id = 'ventura');
  delete from aero.tripulante where organizacao_id = 'ventura';
  delete from aero.aeronave where organizacao_id = 'ventura';
  delete from aero.socio where organizacao_id = 'ventura';

  insert into aero.socio (id, organizacao_id, nome, nome_curto, empresa, papel, telefone)
  select
    item->>'id',
    'ventura',
    item->>'name',
    item->>'shortName',
    coalesce(item->>'company', ''),
    coalesce(item->>'role', ''),
    coalesce(item->>'phone', '')
  from jsonb_array_elements(coalesce(payload->'partners', '[]'::jsonb)) item;

  insert into aero.aeronave (
    id, organizacao_id, matricula, fabricante, modelo, categoria, ano, assentos,
    serie, propulsao, alcance, base_icao, base_nome, horas_totais, ciclos, status
  )
  select
    item->>'id',
    'ventura',
    item->>'registration',
    coalesce(item->>'manufacturer', ''),
    coalesce(item->>'model', ''),
    item->>'category',
    (item->>'year')::integer,
    (item->>'seats')::integer,
    coalesce(item->>'serial', ''),
    coalesce(item->>'propulsion', ''),
    coalesce(item->>'range', ''),
    coalesce(item->>'baseIcao', ''),
    coalesce(item->>'baseName', ''),
    coalesce((item->>'totalHours')::numeric, 0),
    coalesce((item->>'cycles')::integer, 0),
    item->>'status'
  from jsonb_array_elements(coalesce(payload->'aircraft', '[]'::jsonb)) item;

  insert into aero.participacao (id, aeronave_id, socio_id, percentual)
  select
    (item->>'id') || ':' || (owner->>'partnerId'),
    item->>'id',
    owner->>'partnerId',
    (owner->>'share')::numeric
  from jsonb_array_elements(coalesce(payload->'aircraft', '[]'::jsonb)) item
  cross join jsonb_array_elements(coalesce(item->'ownership', '[]'::jsonb)) owner;

  insert into aero.tripulante (
    id, organizacao_id, nome, funcao, base, documento_rotulo, documento_validade,
    medico_rotulo, medico_validade, custo_mensal, status, proxima_escala
  )
  select
    item->>'id',
    'ventura',
    item->>'name',
    item->>'role',
    coalesce(item->>'base', ''),
    coalesce(item->>'documentLabel', ''),
    nullif(item->>'documentExpiry', '')::date,
    nullif(item->>'medicalLabel', ''),
    nullif(item->>'medicalExpiry', '')::date,
    coalesce((item->>'monthlyCost')::numeric, 0),
    item->>'status',
    coalesce(item->>'nextDuty', '')
  from jsonb_array_elements(coalesce(payload->'crew', '[]'::jsonb)) item;

  insert into aero.tripulante_aeronave (tripulante_id, aeronave_id)
  select item->>'id', aeronave_id
  from jsonb_array_elements(coalesce(payload->'crew', '[]'::jsonb)) item
  cross join jsonb_array_elements_text(coalesce(item->'aircraftIds', '[]'::jsonb)) aeronave_id;

  insert into aero.rota (
    id, organizacao_id, nome, origem_icao, destino_icao, origem_cidade, destino_cidade, horas_bloco, nota
  )
  select
    item->>'id',
    'ventura',
    item->>'nome',
    upper(coalesce(item->>'fromIcao', '')),
    upper(coalesce(item->>'toIcao', '')),
    coalesce(item->>'fromCity', ''),
    coalesce(item->>'toCity', ''),
    coalesce((item->>'blockHours')::numeric, 0),
    coalesce(item->>'note', '')
  from jsonb_array_elements(coalesce(payload->'rotas', '[]'::jsonb)) item
  where coalesce(item->>'id', '') <> '';

  insert into aero.hangar (
    id, organizacao_id, aeronave_id, nome, aeroporto, icao, box, contrato, contrato_ate,
    mensalidade, fornecedor, servicos, gestor, status, nota
  )
  select
    item->>'id',
    'ventura',
    item->>'aircraftId',
    item->>'name',
    coalesce(item->>'airport', ''),
    coalesce(item->>'icao', ''),
    coalesce(item->>'slot', ''),
    coalesce(item->>'contract', ''),
    nullif(item->>'contractUntil', '')::date,
    coalesce((item->>'monthlyFee')::numeric, 0),
    coalesce(item->>'vendor', ''),
    coalesce(array(select jsonb_array_elements_text(item->'services')), '{}'::text[]),
    coalesce(item->>'manager', ''),
    item->>'status',
    coalesce(item->>'note', '')
  from jsonb_array_elements(coalesce(payload->'hangars', '[]'::jsonb)) item;

  insert into aero.seguro (id, aeronave_id, valor, fornecedor, descricao)
  select
    item->>'aircraftId',
    item->>'aircraftId',
    coalesce((item->>'amount')::numeric, 0),
    coalesce(item->>'vendor', ''),
    coalesce(item->>'description', '')
  from jsonb_array_elements(coalesce(payload->'seguros', '[]'::jsonb)) item
  where coalesce((item->>'amount')::numeric, 0) > 0;

  insert into aero.itinerario (
    id, organizacao_id, aeronave_id, titulo, finalidade, solicitado_por,
    passageiros, status, nota, condicional
  )
  select
    item->>'id',
    'ventura',
    item->>'aircraftId',
    item->>'title',
    item->>'purpose',
    item->>'requestedBy',
    coalesce(array(select jsonb_array_elements_text(item->'passengers')), '{}'::text[]),
    item->>'status',
    coalesce(item->>'note', ''),
    nullif(item->>'conditional', '')
  from jsonb_array_elements(coalesce(payload->'itineraries', '[]'::jsonb)) item;

  insert into aero.perna (
    id, itinerario_id, data, partida, chegada, origem_icao, destino_icao,
    origem_cidade, destino_cidade, horas_bloco, combustivel, taxas, handling, catering,
    comandante_id, copiloto_id, lancamento
  )
  select
    leg->>'id',
    item->>'id',
    (leg->>'date')::date,
    leg->>'depart',
    leg->>'arrive',
    leg->>'fromIcao',
    leg->>'toIcao',
    coalesce(leg->>'fromCity', ''),
    coalesce(leg->>'toCity', ''),
    coalesce((leg->>'blockHours')::numeric, 0),
    coalesce((leg->>'fuel')::numeric, 0),
    coalesce((leg->>'fees')::numeric, 0),
    coalesce((leg->>'handling')::numeric, 0),
    coalesce((leg->>'catering')::numeric, 0),
    leg->>'commanderId',
    nullif(leg->>'copilotId', ''),
    nullif(leg->>'posting', '')
  from jsonb_array_elements(coalesce(payload->'itineraries', '[]'::jsonb)) item
  cross join jsonb_array_elements(coalesce(item->'legs', '[]'::jsonb)) leg;

  insert into aero.manutencao (
    id, organizacao_id, aeronave_id, tipo, titulo, sistema, status, aberta_em, vence_em,
    vencimento_rotulo, horas_restantes, retencao, fornecedor, custo, estimativa,
    competencia, lancamento, resumo
  )
  select
    item->>'id',
    'ventura',
    item->>'aircraftId',
    item->>'kind',
    item->>'title',
    coalesce(item->>'system', ''),
    item->>'status',
    (item->>'openedAt')::date,
    nullif(item->>'dueAt', '')::date,
    coalesce(item->>'dueLabel', ''),
    nullif(item->>'remainingHours', '')::numeric,
    coalesce((item->>'grounding')::boolean, false),
    coalesce(item->>'vendor', ''),
    coalesce((item->>'cost')::numeric, 0),
    nullif(item->>'estimate', '')::numeric,
    nullif(item->>'competencia', ''),
    nullif(item->>'posting', ''),
    coalesce(item->>'summary', '')
  from jsonb_array_elements(coalesce(payload->'maintenance', '[]'::jsonb)) item;

  insert into aero.despesa (
    id, organizacao_id, aeronave_id, itinerario_id, perna_id, manutencao_id, hangar_id,
    tripulante_id, manual, competencia, data, categoria, descricao, fornecedor, valor,
    alocacao, socio_id, lancamento
  )
  select
    item->>'id',
    'ventura',
    item->>'aircraftId',
    nullif(item->>'itineraryId', ''),
    nullif(item->>'legId', ''),
    nullif(item->>'maintenanceId', ''),
    nullif(item->>'hangarId', ''),
    nullif(item->>'crewId', ''),
    coalesce((item->>'manual')::boolean, true),
    item->>'month',
    (item->>'date')::date,
    item->>'category',
    coalesce(item->>'description', ''),
    coalesce(item->>'vendor', ''),
    (item->>'amount')::numeric,
    item->>'allocation',
    nullif(item->>'partnerId', ''),
    item->>'posting'
  from jsonb_array_elements(coalesce(payload->'extras', '[]'::jsonb)) item;

  insert into aero.aporte (
    id, organizacao_id, socio_id, aeronave_id, competencia, data, valor, metodo, referencia, nota
  )
  select
    item->>'id',
    'ventura',
    item->>'partnerId',
    nullif(item->>'aircraftId', ''),
    item->>'month',
    (item->>'date')::date,
    (item->>'amount')::numeric,
    item->>'method',
    coalesce(item->>'reference', ''),
    coalesce(item->>'note', '')
  from jsonb_array_elements(coalesce(payload->'aportes', '[]'::jsonb)) item;
end;
$$;

revoke all on function public.ler_operacao_aero() from public;
revoke all on function public.gravar_operacao_aero(jsonb) from public;
revoke all on function public.ler_operacao_aero() from anon, authenticated;
revoke all on function public.gravar_operacao_aero(jsonb) from anon, authenticated;
grant execute on function public.ler_operacao_aero() to service_role;
grant execute on function public.gravar_operacao_aero(jsonb) to service_role;

notify pgrst, 'reload schema';
