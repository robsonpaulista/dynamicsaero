-- Colunas de abastecimento do voo no itinerário (valor, litros e comprovante).

alter table aero.itinerario
  add column if not exists abastecimento_valor numeric(14, 2),
  add column if not exists abastecimento_litros numeric(14, 2),
  add column if not exists abastecimento_anexo_nome text,
  add column if not exists abastecimento_anexo_url text;
