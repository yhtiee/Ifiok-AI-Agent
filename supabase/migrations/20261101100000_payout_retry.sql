-- MVP-07: a month whose PayPal batch was denied or whose items failed can be sent again. Failed,
-- returned and unclaimed lines go back to pending and the period gets a new attempt number, so the
-- next batch has a new sender_batch_id (PayPal won't take the same one twice).
alter table payout_periods add column attempt int not null default 1 check (attempt >= 1);

create or replace function reopen_failed_payouts(p_period uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update payout_lines set status = 'pending', paypal_item_id = null, updated_at = now()
  where period_id = p_period and status in ('failed', 'returned', 'unclaimed');
  get diagnostics v_n = row_count;
  if v_n > 0 then
    update payout_periods set status = 'computed', paypal_batch_id = null, attempt = attempt + 1
    where id = p_period and status = 'sent';
  end if;
  return v_n;
end $$;
revoke execute on function reopen_failed_payouts(uuid) from public, anon, authenticated;
grant execute on function reopen_failed_payouts(uuid) to service_role;
