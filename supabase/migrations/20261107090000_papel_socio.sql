-- Papel Sócio nos acessos do cockpit (visão filtrada do cotista).

do $$
declare
  nome text;
begin
  for nome in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'aero'
      and t.relname = 'membro'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%papel%'
  loop
    execute format('alter table aero.membro drop constraint %I', nome);
  end loop;
end $$;

alter table aero.membro
  add constraint membro_papel_check
  check (papel in ('controlador', 'operacao', 'leitura', 'socio'));

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

  if papel_membro not in ('controlador', 'operacao', 'leitura', 'socio') then
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

notify pgrst, 'reload schema';
