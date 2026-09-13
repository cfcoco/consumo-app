-- Gastos fijos: consumos que se repiten todos los meses en la tarjeta
-- (streaming, gimnasio, seguros) y que no son una compra en cuotas.
-- Se generan por adelantado igual que las cuotas, pero se marcan aparte para
-- no mostrarlos como "cuota N de N" ni contarlos como deuda que se termina.
alter table installment_series add column if not exists is_fixed boolean not null default false;
alter table transactions add column if not exists is_fixed boolean not null default false;
