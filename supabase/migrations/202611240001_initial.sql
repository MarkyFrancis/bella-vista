create extension if not exists btree_gist;
create extension if not exists pgcrypto;
create table public.staff_roles (user_id uuid primary key references auth.users(id) on delete cascade, role text not null check (role in ('admin','staff')));
create table public.rooms (id text primary key, service text not null check (service in ('single','couples','family')));
insert into public.rooms values ('SR-1','single'),('SR-2','single'),('SR-3','single'),('CS-1','couples'),('CS-2','couples'),('FL-1','family'),('FL-2','family');
create table public.therapists (id uuid primary key default gen_random_uuid(), name text not null, active boolean not null default true);
create table public.appointments (
 id uuid primary key default gen_random_uuid(), reference text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
 token_hash text not null unique, customer_name text not null, customer_email text not null,
 health_yes boolean not null, health_details text, service text not null, guests integer not null, price integer not null,
 room_id text not null references public.rooms(id), start_at timestamptz not null, end_at timestamptz not null, reserved_until timestamptz not null,
 status text not null default 'booked' check(status in ('booked','cancelled')), late_review boolean not null default false,
 receipt_path text not null, receipt_status text not null default 'pending' check(receipt_status in ('pending','reviewed','rejected')),
 therapist_id uuid references public.therapists(id), payment_recorded numeric(10,2) not null default 0 check(payment_recorded>=0),
 terms_version text not null, terms_accepted_at timestamptz not null default now(), created_at timestamptz not null default now(),
 constraint room_no_overlap exclude using gist (room_id with =, tstzrange(start_at,reserved_until,'[)') with &&) where (status='booked'),
 constraint therapist_no_overlap exclude using gist (therapist_id with =, tstzrange(start_at,end_at,'[)') with &&) where (status='booked' and therapist_id is not null)
);
alter table public.staff_roles enable row level security;
alter table public.rooms enable row level security;
alter table public.therapists enable row level security;
alter table public.appointments enable row level security;
revoke all on public.staff_roles,public.rooms,public.therapists,public.appointments from anon, authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('receipts','receipts',false,4000000,array['image/jpeg','image/png','application/pdf']) on conflict(id) do update set public=false,file_size_limit=4000000,allowed_mime_types=excluded.allowed_mime_types;
-- Only the trusted server uses service-role access. No public storage policies are created.
create or replace function public.reserve_appointment(p_token_hash text,p_name text,p_email text,p_health boolean,p_details text,p_service text,p_guests integer,p_start timestamptz,p_receipt text,p_terms text)
returns public.appointments language plpgsql security definer set search_path=public,pg_temp as $$
declare d integer; cost integer; r record; a public.appointments; local_time timestamp;
begin
 if p_terms <> '2026-11-24' or p_name is null or length(trim(p_name)) not between 1 and 120 or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_health is null or (p_health and length(trim(coalesce(p_details,''))) not between 1 and 2000) or p_receipt is null then raise exception 'Invalid booking'; end if;
 case p_service when 'single' then d:=60;cost:=800;if p_guests<>1 then raise exception 'Invalid guest count';end if;
 when 'couples' then d:=60;cost:=1800;if p_guests<>2 then raise exception 'Invalid guest count';end if;
 when 'family' then d:=90;cost:=4000+greatest(p_guests-4,0)*750;if p_guests not between 1 and 6 then raise exception 'Invalid guest count';end if;
 else raise exception 'Invalid service';end case;
 local_time:=p_start at time zone 'Asia/Manila';
 if p_start<=now() or local_time::time < time '13:00' or (local_time+make_interval(mins=>d))::time > time '21:00' or local_time::date<>(local_time+make_interval(mins=>d))::date or local_time::time not in (select (time '13:00'+make_interval(mins=>n))::time from generate_series(0,480,d+30) n union select (time '21:00'-make_interval(mins=>d))::time) then raise exception 'Invalid session time';end if;
 for r in select id from public.rooms where service=p_service order by id loop
  begin
   insert into public.appointments(token_hash,customer_name,customer_email,health_yes,health_details,service,guests,price,room_id,start_at,end_at,reserved_until,receipt_path,terms_version)
   values(p_token_hash,trim(p_name),lower(trim(p_email)),p_health,case when p_health then trim(p_details) else null end,p_service,p_guests,cost,r.id,p_start,p_start+make_interval(mins=>d),p_start+make_interval(mins=>d+30),p_receipt,p_terms) returning * into a;
   return a;
  exception when exclusion_violation then null;end;
 end loop;
 raise exception 'No room available' using errcode='P0001';
end $$;
create or replace function public.move_appointment(p_token_hash text,p_start timestamptz) returns public.appointments language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments; r record; d integer; local_time timestamp;
begin
 select * into a from public.appointments where token_hash=p_token_hash and status='booked' for update;
 if not found or a.start_at<=now() then raise exception 'Appointment unavailable';end if;
 d:=case when a.service='family' then 90 else 60 end;local_time:=p_start at time zone 'Asia/Manila';
 if p_start<=now() or local_time::time < time '13:00' or (local_time+make_interval(mins=>d))::time > time '21:00' or local_time::date<>(local_time+make_interval(mins=>d))::date or local_time::time not in (select (time '13:00'+make_interval(mins=>n))::time from generate_series(0,480,d+30) n union select (time '21:00'-make_interval(mins=>d))::time) then raise exception 'Invalid session time';end if;
 for r in select id from public.rooms where service=a.service order by id loop
  begin
   update public.appointments set room_id=r.id,start_at=p_start,end_at=p_start+make_interval(mins=>d),reserved_until=p_start+make_interval(mins=>d+30),therapist_id=null,late_review=late_review or (a.start_at-now()<interval '6 hours') where id=a.id returning * into a;
   return a;
  exception when exclusion_violation then null;end;
 end loop;
 raise exception 'No room available' using errcode='P0001';
end $$;
revoke all on function public.reserve_appointment(text,text,text,boolean,text,text,integer,timestamptz,text,text) from public,anon,authenticated;
revoke all on function public.move_appointment(text,timestamptz) from public,anon,authenticated;
grant execute on function public.reserve_appointment(text,text,text,boolean,text,text,integer,timestamptz,text,text) to service_role;
grant execute on function public.move_appointment(text,timestamptz) to service_role;
