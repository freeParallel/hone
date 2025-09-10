-- 002_policies.sql

drop policy if exists "profiles self access" on public.profiles;
create policy "profiles self access" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "polls owner full" on public.polls;
create policy "polls owner full" on public.polls
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "participants owner manage" on public.participants;
create policy "participants owner manage" on public.participants
  for all using (
    exists (
      select 1 from public.polls p
      where p.id = participants.poll_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.polls p
      where p.id = participants.poll_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "availabilities owner manage" on public.availabilities;
create policy "availabilities owner manage" on public.availabilities
  for all using (
    exists (
      select 1 from public.polls p
      where p.id = availabilities.poll_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.polls p
      where p.id = availabilities.poll_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "suggestions owner read" on public.suggestions;
create policy "suggestions owner read" on public.suggestions
  for select using (
    exists (
      select 1 from public.polls p
      where p.id = suggestions.poll_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "link tokens owner read" on public.poll_link_tokens;
create policy "link tokens owner read" on public.poll_link_tokens
  for select using (
    exists (
      select 1 from public.polls p
      where p.id = poll_link_tokens.poll_id and p.owner_id = auth.uid()
    )
  );