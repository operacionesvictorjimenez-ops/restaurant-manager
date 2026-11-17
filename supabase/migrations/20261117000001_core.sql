-- =====================================================================
-- RESTAURANT MANAGER · Fase 0 · Núcleo
-- Restaurantes, perfiles, encargados autorizados, PIN de local y auditoría.
-- Modelo de acceso:
--   admin    → administrador general, ve todos los restaurantes
--   manager  → encargado, ve solo los restaurantes asignados
--   kiosk    → cuenta de la tablet de un restaurante, desbloqueada con el PIN del local
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.user_kind as enum ('admin', 'manager', 'kiosk');

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create table public.restaurants (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code            text not null unique check (code ~ '^[A-Z0-9-]{2,12}$'),
  slug            text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name            text not null check (length(trim(name)) between 2 and 80),
  address         text,
  timezone        text not null default 'Europe/Madrid',
  settings        jsonb not null default '{}',
  active          boolean not null default true,
  kiosk_user_id   uuid unique references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid()
);
create index on public.restaurants (organization_id);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  kind        public.user_kind not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.manager_restaurants (
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  primary key (profile_id, restaurant_id)
);
create index on public.manager_restaurants (restaurant_id);

-- El PIN vive en un esquema privado: la API nunca lo expone.
create table private.restaurant_pins (
  restaurant_id   uuid primary key references public.restaurants(id) on delete cascade,
  pin_hash        text not null,
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);

create table public.audit_log (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  actor_id      uuid,
  restaurant_id uuid,
  table_name    text not null,
  row_id        text,
  action        text not null,
  old_data      jsonb,
  new_data      jsonb
);
create index on public.audit_log (restaurant_id, at desc);
create index on public.audit_log (at desc);

-- ---------------------------------------------------------------------
-- Funciones de acceso (security definer para evitar recursión en RLS)
-- ---------------------------------------------------------------------
create function public.current_kind() returns public.user_kind
language sql stable security definer set search_path = '' as $$
  select kind from public.profiles where id = auth.uid() and active
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_kind() = 'admin', false)
$$;

create function public.has_restaurant_access(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case public.current_kind()
    when 'admin' then true
    when 'manager' then exists (
      select 1 from public.manager_restaurants mr
      join public.restaurants r on r.id = mr.restaurant_id
      where mr.profile_id = auth.uid() and mr.restaurant_id = rid and r.active)
    when 'kiosk' then exists (
      select 1 from public.restaurants r
      where r.id = rid and r.kiosk_user_id = auth.uid() and r.active)
    else false
  end
$$;

-- Puede administrar el local (cambiar PIN, registrar tablet): admin o encargado asignado.
create function public.can_manage_restaurant(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_kind() in ('admin', 'manager') and public.has_restaurant_access(rid)
$$;

-- ---------------------------------------------------------------------
-- Seguridad por fila
-- ---------------------------------------------------------------------
alter table public.organizations       enable row level security;
alter table public.restaurants         enable row level security;
alter table public.profiles            enable row level security;
alter table public.manager_restaurants enable row level security;
alter table public.audit_log           enable row level security;

create policy "org: leer" on public.organizations for select to authenticated
  using (public.current_kind() is not null);
create policy "org: admin edita" on public.organizations for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "restaurantes: leer autorizados" on public.restaurants for select to authenticated
  using (public.has_restaurant_access(id));
create policy "restaurantes: admin crea" on public.restaurants for insert to authenticated
  with check (public.is_admin());
create policy "restaurantes: admin edita" on public.restaurants for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Sin DELETE: un restaurante se desactiva (active = false), nunca se borra.

create policy "perfiles: el propio o admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "perfiles: admin edita" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "asignaciones: leer" on public.manager_restaurants for select to authenticated
  using (public.is_admin() or profile_id = auth.uid());
create policy "asignaciones: admin crea" on public.manager_restaurants for insert to authenticated
  with check (public.is_admin());
create policy "asignaciones: admin borra" on public.manager_restaurants for delete to authenticated
  using (public.is_admin());

create policy "actividad: admin o encargado del local" on public.audit_log for select to authenticated
  using (public.is_admin()
         or (public.current_kind() = 'manager' and restaurant_id is not null
             and public.has_restaurant_access(restaurant_id)));

-- Nada se puede escribir en audit_log desde la API; solo el trigger.
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- Auditoría automática
-- ---------------------------------------------------------------------
create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, restaurant_id, table_name, row_id, action, old_data, new_data)
  values (
    auth.uid(),
    coalesce((r ->> 'restaurant_id')::uuid,
             case when tg_table_name = 'restaurants' then (r ->> 'id')::uuid end),
    tg_table_name,
    coalesce(r ->> 'id', r ->> 'profile_id'),
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end $$;

create trigger audit_restaurants after insert or update on public.restaurants
  for each row execute function private.audit();
create trigger audit_profiles after insert or update on public.profiles
  for each row execute function private.audit();
create trigger audit_manager_restaurants after insert or delete on public.manager_restaurants
  for each row execute function private.audit();

-- ---------------------------------------------------------------------
-- PIN del local
-- ---------------------------------------------------------------------
create function public.set_restaurant_pin(rid uuid, pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_restaurant(rid) then
    raise exception 'No tienes permiso para cambiar el PIN de este restaurante' using errcode = '42501';
  end if;
  if pin !~ '^[0-9]{4,6}$' then
    raise exception 'El PIN debe tener entre 4 y 6 cifras' using errcode = '22023';
  end if;

  insert into private.restaurant_pins (restaurant_id, pin_hash, failed_attempts, locked_until, updated_at, updated_by)
  values (rid, extensions.crypt(pin, extensions.gen_salt('bf', 10)), 0, null, now(), auth.uid())
  on conflict (restaurant_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null,
        updated_at = now(), updated_by = auth.uid();

  insert into public.audit_log (actor_id, restaurant_id, table_name, row_id, action)
  values (auth.uid(), rid, 'restaurant_pins', rid::text, 'pin_changed');
end $$;

create function public.restaurant_pin_status(rid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.has_restaurant_access(rid) then
    jsonb_build_object(
      'configured', exists (select 1 from private.restaurant_pins where restaurant_id = rid),
      'locked_until', (select locked_until from private.restaurant_pins where restaurant_id = rid and locked_until > now()),
      'updated_at', (select updated_at from private.restaurant_pins where restaurant_id = rid))
  end
$$;

-- Lo llama la tablet (cuenta kiosk). Tras 5 fallos bloquea 5 minutos.
create function public.verify_restaurant_pin(pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  rid uuid;
  p   private.restaurant_pins%rowtype;
  max_attempts constant int := 5;
begin
  select r.id into rid from public.restaurants r
  where r.kiosk_user_id = auth.uid() and r.active;
  if rid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_kiosk');
  end if;

  select * into p from private.restaurant_pins where restaurant_id = rid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_pin');
  end if;

  if p.locked_until is not null and p.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', p.locked_until);
  end if;

  if p.pin_hash = extensions.crypt(coalesce(pin, ''), p.pin_hash) then
    update private.restaurant_pins set failed_attempts = 0, locked_until = null where restaurant_id = rid;
    return jsonb_build_object('ok', true, 'restaurant_id', rid);
  end if;

  if p.failed_attempts + 1 >= max_attempts then
    update private.restaurant_pins
       set failed_attempts = 0, locked_until = now() + interval '5 minutes'
     where restaurant_id = rid;
    insert into public.audit_log (actor_id, restaurant_id, table_name, row_id, action)
    values (auth.uid(), rid, 'restaurant_pins', rid::text, 'pin_locked');
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', now() + interval '5 minutes');
  end if;

  update private.restaurant_pins set failed_attempts = p.failed_attempts + 1 where restaurant_id = rid;
  return jsonb_build_object('ok', false, 'reason', 'wrong_pin',
                            'remaining', max_attempts - p.failed_attempts - 1);
end $$;

revoke execute on function public.set_restaurant_pin(uuid, text)  from public, anon;
revoke execute on function public.verify_restaurant_pin(text)     from public, anon;
revoke execute on function public.restaurant_pin_status(uuid)     from public, anon;
grant  execute on function public.set_restaurant_pin(uuid, text)  to authenticated;
grant  execute on function public.verify_restaurant_pin(text)     to authenticated;
grant  execute on function public.restaurant_pin_status(uuid)     to authenticated;

-- Lista de restaurantes visibles con PIN configurado (para el listado de administración).
create function public.restaurants_with_pin() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.restaurant_id from private.restaurant_pins p
  where public.has_restaurant_access(p.restaurant_id)
$$;
revoke execute on function public.restaurants_with_pin() from public, anon;
grant  execute on function public.restaurants_with_pin() to authenticated;
