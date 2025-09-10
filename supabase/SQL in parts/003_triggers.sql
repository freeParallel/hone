-- 003_triggers.sql

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_polls_updated_at on public.polls;
create trigger trg_polls_updated_at
before update on public.polls
for each row execute procedure public.set_updated_at();