alter table aero.aeronave
  drop constraint if exists aeronave_categoria_check;

alter table aero.aeronave
  add constraint aeronave_categoria_check
  check (categoria in ('jato', 'helicoptero', 'turbohelice'));
