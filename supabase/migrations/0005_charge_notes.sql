-- Nota libre por cuota a cobrar ("esta cuota es por tal cosa").
alter table receivable_charges add column if not exists note text;
