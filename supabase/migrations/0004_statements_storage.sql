-- Políticas de acceso al bucket privado "statements" (PDFs de resúmenes).
-- Cada usuario solo puede ver/subir archivos bajo su propia carpeta
-- (statements/<user_id>/...).

drop policy if exists "statements_owner_all" on storage.objects;

create policy "statements_owner_all" on storage.objects
  for all
  using (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);
