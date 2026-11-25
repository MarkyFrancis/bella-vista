-- Apply after 202611240001_initial.sql. Existing bookings are retained.
alter table public.rooms add column if not exists under_maintenance boolean not null default false;
alter table public.appointments add column if not exists customer_phone text;
alter table public.appointments add column if not exists payment_option text check (payment_option in ('downpayment','full'));
-- Remove the old reservation signature so all new bookings include the required fields.
drop function if exists public.reserve_appointment(text,text,text,boolean,text,text,integer,timestamptz,text,text);
create or replace function public.reserve_appointment(p_token_hash text,p_name text,p_email text,p_health boolean,p_details text,p_service text,p_guests integer,p_start timestamptz,p_receipt text,p_terms text,p_phone text,p_payment_option text)
returns public.appointments language plpgsql security definer set search_path=public,pg_temp as $$
declare d integer; cost integer; r record; a public.appointments; local_time timestamp;
begin
 if p_phone is null or p_phone !~ '^[0-9]{7,15}$' or p_payment_option is null or p_payment_option not in ('downpayment','full') or p_terms <> '2026-11-24' or p_name is null or length(trim(p_name)) not between 1 and 120 or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_health is null or (p_health and length(trim(coalesce(p_details,''))) not between 1 and 2000) or p_receipt is null then raise exception 'Invalid booking'; end if;
 case p_service when 'single' then d:=60;cost:=800;if p_guests<>1 then raise exception 'Invalid guest count';end if;
 when 'couples' then d:=60;cost:=1800;if p_guests<>2 then raise exception 'Invalid guest count';end if;
 when 'family' then d:=90;cost:=4000+greatest(p_guests-4,0)*750;if p_guests not between 1 and 6 then raise exception 'Invalid guest count';end if;
 else raise exception 'Invalid service';end case;
 local_time:=p_start at time zone 'Asia/Manila';
 if p_start<=now() or local_time::time < time '13:00' or (local_time+make_interval(mins=>d))::time > time '21:00' or local_time::date<>(local_time+make_interval(mins=>d))::date or local_time::time not in (select (time '13:00'+make_interval(mins=>n))::time from generate_series(0,480,d+30) n union select (time '21:00'-make_interval(mins=>d))::time) then raise exception 'Invalid session time';end if;
 for r in select id from public.rooms where service=p_service and not under_maintenance order by id for update loop
  begin
   insert into public.appointments(token_hash,customer_name,customer_email,health_yes,health_details,service,guests,price,room_id,start_at,end_at,reserved_until,receipt_path,terms_version,customer_phone,payment_option)
   values(p_token_hash,trim(p_name),lower(trim(p_email)),p_health,case when p_health then trim(p_details) else null end,p_service,p_guests,cost,r.id,p_start,p_start+make_interval(mins=>d),p_start+make_interval(mins=>d+30),p_receipt,p_terms,p_phone,p_payment_option) returning * into a;
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
 for r in select id from public.rooms where service=a.service and not under_maintenance order by id for update loop
  begin
   update public.appointments set room_id=r.id,start_at=p_start,end_at=p_start+make_interval(mins=>d),reserved_until=p_start+make_interval(mins=>d+30),therapist_id=null,late_review=late_review or (a.start_at-now()<interval '6 hours') where id=a.id returning * into a;
   return a;
  exception when exclusion_violation then null;end;
 end loop;
 raise exception 'No room available' using errcode='P0001';
end $$;

create or replace function public.set_room_maintenance(p_room text,p_maintenance boolean) returns public.rooms language plpgsql security definer set search_path=public,pg_temp as $$
declare room public.rooms;
begin
 select * into room from public.rooms where id=p_room for update;
 if not found or p_maintenance is null then raise exception 'Invalid room'; end if;
 if p_maintenance and exists(select 1 from public.appointments where room_id=p_room and status='booked' and reserved_until>now()) then raise exception 'Room has current or future bookings'; end if;
 update public.rooms set under_maintenance=p_maintenance where id=p_room returning * into room; return room;
end $$;
revoke all on function public.reserve_appointment(text,text,text,boolean,text,text,integer,timestamptz,text,text,text,text) from public,anon,authenticated;
revoke all on function public.move_appointment(text,timestamptz) from public,anon,authenticated;
revoke all on function public.set_room_maintenance(text,boolean) from public,anon,authenticated;
grant execute on function public.reserve_appointment(text,text,text,boolean,text,text,integer,timestamptz,text,text,text,text) to service_role;
grant execute on function public.move_appointment(text,timestamptz) to service_role;
grant execute on function public.set_room_maintenance(text,boolean) to service_role;
