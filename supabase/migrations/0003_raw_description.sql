-- Guarda el nombre real del consumo tal como figura en el resumen de la
-- tarjeta, separado del nombre/etiqueta que el usuario le pone para
-- identificarlo. La conciliación de resúmenes importados matchea por
-- raw_description (estable), no por description (que el usuario cambia).

alter table transactions add column if not exists raw_description text;
