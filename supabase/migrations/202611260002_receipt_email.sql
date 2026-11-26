-- Track one receipt-confirmation email per reviewed payment amount.
alter table public.appointments add column if not exists receipt_email_state text not null default 'not_sent' check(receipt_email_state in ('not_sent','sending','sent','failed'));
alter table public.appointments add column if not exists receipt_email_amount numeric(10,2);
alter table public.appointments add column if not exists receipt_email_claim uuid;
alter table public.appointments add column if not exists receipt_email_claimed_at timestamptz;
create or replace function public.claim_receipt_email(p_id uuid) returns setof public.appointments language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.appointments;
begin
 select * into a from public.appointments where id=p_id for update;
 if not found or a.status<>'booked' or a.receipt_status<>'reviewed' or a.payment_recorded<=0 then return; end if;
 if a.receipt_email_state='sent' and a.receipt_email_amount=a.payment_recorded then return; end if;
 if a.receipt_email_state='sending' and a.receipt_email_claimed_at>now()-interval '5 minutes' then return; end if;
 update public.appointments set receipt_email_state='sending',receipt_email_amount=payment_recorded,receipt_email_claim=gen_random_uuid(),receipt_email_claimed_at=now() where id=p_id returning * into a;
 return next a;
end $$;
create or replace function public.finish_receipt_email(p_id uuid,p_claim uuid,p_sent boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.appointments set receipt_email_state=case when p_sent then 'sent' else 'failed' end,receipt_email_claim=null,receipt_email_claimed_at=null where id=p_id and receipt_email_claim=p_claim;
end $$;
revoke all on function public.claim_receipt_email(uuid),public.finish_receipt_email(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_receipt_email(uuid),public.finish_receipt_email(uuid,uuid,boolean) to service_role;
