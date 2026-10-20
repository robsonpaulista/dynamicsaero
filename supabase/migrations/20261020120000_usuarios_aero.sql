-- Nome e e-mail de quem acessa o cockpit.
-- As funções ficam no schema public para a chave de serviço chamá-las.
-- A chave anônima não executa.

alter table aero.membro
  add column if not exists nome text not null default '',
  add column if not exists email text not null default '';

create unique index if not exists membro_email_org_unico
  on aero.membro (organizacao_id, lower(email))
  where email <> '';

create or replace function public.listar_membros_aero()
returns jsonb
language plpgsql
stable
security definer
set search_path = aero, public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'sem permissão';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'userId', m.user_id,
      'nome', m.nome,
      'email', m.email,
      'papel', m.papel
    ) order by m.nome, m.email)
    from aero.membro m
    where m.organizacao_id = 'ventura'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.membro_por_usuario_aero(uid uuid)
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

  select jsonb_build_object(
    'id', m.id,
    'userId', m.user_id,
    'nome', m.nome,
    'email', m.email,
    'papel', m.papel
  )
  into resultado
  from aero.membro m
  where m.organizacao_id = 'ventura'
    and m.user_id = uid;

  return resultado;
end;
$$;

create or replace function public.salvar_membro_aero(
  membro_id text,
  uid uuid,
  nome_membro text,
  email_membro text,
  papel_membro text
)
returns void
language plpgsql
security definer
set search_path = aero, public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'sem permissão';
  end if;

  if papel_membro not in ('controlador', 'operacao', 'leitura') then
    raise exception 'papel inválido';
  end if;

  insert into aero.organizacao (id, nome)
  values ('ventura', 'Ventura Aviação')
  on conflict (id) do nothing;

  insert into aero.membro (id, organizacao_id, user_id, papel, nome, email)
  values (membro_id, 'ventura', uid, papel_membro, btrim(nome_membro), lower(btrim(email_membro)))
  on conflict (id) do update
    set user_id = excluded.user_id,
        papel = excluded.papel,
        nome = excluded.nome,
        email = excluded.email;
end;
$$;

create or replace function public.excluir_membro_aero(membro_id text)
returns void
language plpgsql
security definer
set search_path = aero, public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'sem permissão';
  end if;

  delete from aero.membro
  where id = membro_id
    and organizacao_id = 'ventura';
end;
$$;

revoke all on function public.listar_membros_aero() from public, anon, authenticated;
revoke all on function public.membro_por_usuario_aero(uuid) from public, anon, authenticated;
revoke all on function public.salvar_membro_aero(text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.excluir_membro_aero(text) from public, anon, authenticated;

grant execute on function public.listar_membros_aero() to service_role;
grant execute on function public.membro_por_usuario_aero(uuid) to service_role;
grant execute on function public.salvar_membro_aero(text, uuid, text, text, text) to service_role;
grant execute on function public.excluir_membro_aero(text) to service_role;

notify pgrst, 'reload schema';
