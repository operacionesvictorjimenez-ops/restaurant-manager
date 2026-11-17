-- =====================================================================
-- RESTAURANT MANAGER · Fase 1 · Temperaturas e incidencias
-- Las lecturas son inalterables (APPCC): no hay UPDATE ni DELETE.
-- Una lectura fuera de rango exige acción correctora y abre una incidencia.
-- =====================================================================

create type public.storage_kind as enum ('refrigeracion', 'congelacion');
create type public.incident_status as enum ('abierta', 'cerrada');

-- ---------------------------------------------------------------------
-- Cámaras
-- ---------------------------------------------------------------------
create table public.storage_units (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  code          text not null check (code ~ '^[A-Z0-9-]{1,10}$'),
  name          text not null check (length(trim(name)) between 1 and 60),
  kind          public.storage_kind not null,
  min_c         numeric(4,1) not null,
  max_c         numeric(4,1) not null,
  sort_order    int not null default 0,
  active        boolean not null default true,
  sensor_eui    text,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  unique (restaurant_id, code),
  check (min_c < max_c),
  check (min_c >= -50 and max_c <= 40)
);
create index on public.storage_units (restaurant_id, sort_order);

-- Horario de controles por restaurante
create table public.temperature_settings (
  restaurant_id     uuid primary key references public.restaurants(id) on delete cascade,
  check_times       time[] not null default '{09:00,17:00}',
  tolerance_minutes int not null default 60 check (tolerance_minutes between 10 and 240),
  updated_at        timestamptz not null default now(),
  updated_by        uuid default auth.uid(),
  check (cardinality(check_times) between 1 and 8)
);

-- ---------------------------------------------------------------------
-- Lecturas (inalterables)
-- ---------------------------------------------------------------------
create table public.temperature_readings (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants(id),
  storage_unit_id  uuid not null references public.storage_units(id),
  value_c          numeric(4,1) not null,
  recorded_at      timestamptz not null default now(),
  received_at      timestamptz not null default now(),
  source           text not null default 'manual' check (source in ('manual', 'sensor')),
  in_range         boolean not null,
  min_c            numeric(4,1) not null,  -- rango vigente en el momento de la lectura
  max_c            numeric(4,1) not null,
  note             text,
  recorded_by      uuid default auth.uid(),
  recorded_by_name text,
  client_id        uuid unique,             -- evita duplicados al reenviar desde la cola sin conexión
  corrects_id      uuid references public.temperature_readings(id)
);
create index on public.temperature_readings (storage_unit_id, recorded_at desc);
create index on public.temperature_readings (restaurant_id, recorded_at desc);

-- ---------------------------------------------------------------------
-- Incidencias (comunes a todos los módulos)
-- ---------------------------------------------------------------------
create table public.incidents (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants(id),
  module            text not null check (module in ('temperaturas', 'etiquetas', 'general')),
  storage_unit_id   uuid references public.storage_units(id),
  reading_id        uuid references public.temperature_readings(id),
  title             text not null,
  corrective_action text,
  status            public.incident_status not null default 'abierta',
  opened_at         timestamptz not null default now(),
  opened_by         uuid default auth.uid(),
  resolution        text,
  closed_at         timestamptz,
  closed_by         uuid
);
create index on public.incidents (restaurant_id, status, opened_at desc);

-- Última lectura de cada cámara (respeta RLS de quien consulta)
create view public.v_last_readings with (security_invoker = true) as
  select distinct on (storage_unit_id)
    storage_unit_id, restaurant_id, id, value_c, recorded_at, in_range, min_c, max_c
  from public.temperature_readings
  order by storage_unit_id, recorded_at desc;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.storage_units        enable row level security;
alter table public.temperature_settings enable row level security;
alter table public.temperature_readings enable row level security;
alter table public.incidents            enable row level security;

create policy "camaras: leer" on public.storage_units for select to authenticated
  using (public.has_restaurant_access(restaurant_id));
create policy "camaras: crear" on public.storage_units for insert to authenticated
  with check (public.can_manage_restaurant(restaurant_id));
create policy "camaras: editar" on public.storage_units for update to authenticated
  using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));

create policy "horario: leer" on public.temperature_settings for select to authenticated
  using (public.has_restaurant_access(restaurant_id));
create policy "horario: crear" on public.temperature_settings for insert to authenticated
  with check (public.can_manage_restaurant(restaurant_id));
create policy "horario: editar" on public.temperature_settings for update to authenticated
  using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));

create policy "lecturas: leer" on public.temperature_readings for select to authenticated
  using (public.has_restaurant_access(restaurant_id));
create policy "incidencias: leer" on public.incidents for select to authenticated
  using (public.has_restaurant_access(restaurant_id));

-- Lecturas e incidencias solo se escriben mediante las funciones de abajo.
revoke insert, update, delete on public.temperature_readings from anon, authenticated;
revoke insert, update, delete on public.incidents            from anon, authenticated;

create trigger audit_storage_units after insert or update on public.storage_units
  for each row execute function private.audit();
create trigger audit_temperature_settings after insert or update on public.temperature_settings
  for each row execute function private.audit();
create trigger audit_incidents after insert or update on public.incidents
  for each row execute function private.audit();

-- ---------------------------------------------------------------------
-- Registrar una lectura
-- ---------------------------------------------------------------------
create function public.record_temperature(
  p_unit        uuid,
  p_value       numeric,
  p_client_id   uuid,
  p_recorded_at timestamptz default null,
  p_action      text default null,
  p_note        text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u        public.storage_units%rowtype;
  ts       timestamptz := coalesce(p_recorded_at, now());
  existing uuid;
  rid      uuid;
  inr      boolean;
  inc      uuid;
  v        numeric(4,1) := round(p_value, 1);
begin
  select * into u from public.storage_units where id = p_unit and active;
  if not found or not public.has_restaurant_access(u.restaurant_id) then
    raise exception 'Cámara no encontrada' using errcode = '42501';
  end if;

  if p_client_id is not null then
    select id into existing from public.temperature_readings where client_id = p_client_id;
    if existing is not null then
      return jsonb_build_object('ok', true, 'id', existing, 'duplicate', true);
    end if;
  end if;

  if v is null or v < -50 or v > 40 then
    raise exception 'La temperatura % °C no es posible. Revisa el valor.', v using errcode = '22023';
  end if;
  if ts > now() + interval '5 minutes' or ts < now() - interval '24 hours' then
    raise exception 'La hora de la lectura no es válida' using errcode = '22023';
  end if;

  inr := v between u.min_c and u.max_c;
  if not inr and coalesce(trim(p_action), '') = '' then
    raise exception 'Temperatura fuera de rango: indica la acción correctora' using errcode = 'P0001', hint = 'action_required';
  end if;

  insert into public.temperature_readings
    (restaurant_id, storage_unit_id, value_c, recorded_at, in_range, min_c, max_c, note, client_id)
  values
    (u.restaurant_id, u.id, v, ts, inr, u.min_c, u.max_c, nullif(trim(p_note), ''), p_client_id)
  returning id into rid;

  if not inr then
    insert into public.incidents (restaurant_id, module, storage_unit_id, reading_id, title, corrective_action, opened_at)
    values (u.restaurant_id, 'temperaturas', u.id, rid,
            format('%s a %s °C (rango %s a %s °C)', u.name,
                   replace(v::text, '.', ','), replace(u.min_c::text, '.', ','), replace(u.max_c::text, '.', ',')),
            trim(p_action), ts)
    returning id into inc;
  end if;

  return jsonb_build_object('ok', true, 'id', rid, 'in_range', inr, 'incident_id', inc);
end $$;

-- ---------------------------------------------------------------------
-- Cerrar una incidencia (encargado o administrador)
-- ---------------------------------------------------------------------
create function public.close_incident(p_id uuid, p_resolution text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i public.incidents%rowtype;
begin
  select * into i from public.incidents where id = p_id for update;
  if not found or not public.can_manage_restaurant(i.restaurant_id) then
    raise exception 'No tienes permiso para cerrar esta incidencia' using errcode = '42501';
  end if;
  if i.status = 'cerrada' then
    raise exception 'La incidencia ya está cerrada' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_resolution, ''))) < 3 then
    raise exception 'Describe cómo se ha resuelto' using errcode = '22023';
  end if;
  update public.incidents
     set status = 'cerrada', resolution = trim(p_resolution), closed_at = now(), closed_by = auth.uid()
   where id = p_id;
end $$;

revoke execute on function public.record_temperature(uuid, numeric, uuid, timestamptz, text, text) from public, anon;
revoke execute on function public.close_incident(uuid, text) from public, anon;
grant  execute on function public.record_temperature(uuid, numeric, uuid, timestamptz, text, text) to authenticated;
grant  execute on function public.close_incident(uuid, text) to authenticated;
