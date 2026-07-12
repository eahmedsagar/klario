-- Row-Level Security: every row visible/writable ONLY by its owner.
alter table members  enable row level security;
alter table reports  enable row level security;
alter table readings enable row level security;
alter table notes    enable row level security;
alter table reminders enable row level security;

do $$
declare t text;
begin
  foreach t in array array['members','reports','readings','notes','reminders'] loop
    execute format('create policy "own rows select" on %I for select using (user_id = auth.uid())', t);
    execute format('create policy "own rows insert" on %I for insert with check (user_id = auth.uid())', t);
    execute format('create policy "own rows update" on %I for update using (user_id = auth.uid())', t);
    execute format('create policy "own rows delete" on %I for delete using (user_id = auth.uid())', t);
  end loop;
end $$;

-- storage: each user can only touch reports/<their-uid>/...
create policy "own pdfs read"  on storage.objects for select
  using (bucket_id='reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own pdfs write" on storage.objects for insert
  with check (bucket_id='reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own pdfs update" on storage.objects for update
  using (bucket_id='reports' and (storage.foldername(name))[1] = auth.uid()::text);
