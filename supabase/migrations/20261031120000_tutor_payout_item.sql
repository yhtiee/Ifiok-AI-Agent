-- MVP-07: the tutor's payout item id is only known once PayPal reports it (the payout is created
-- as a batch keyed on the booking), so the first status report records it and later ones must match.
create or replace function record_tutor_payout(p_booking uuid, p_item_id text, p_paypal_status text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_status text := case upper(p_paypal_status)
    when 'SUCCESS' then 'paid' when 'UNCLAIMED' then 'unclaimed'
    when 'FAILED' then 'failed' when 'BLOCKED' then 'failed' when 'DENIED' then 'failed'
    when 'RETURNED' then 'returned' when 'REFUNDED' then 'returned' when 'REVERSED' then 'returned'
    else 'sent' end;
begin
  update tutoring_bookings set tutor_payout_status = v_status,
    tutor_payout_item_id = coalesce(tutor_payout_item_id, p_item_id), updated_at = now()
  where id = p_booking and status = 'paid_out'
    and (tutor_payout_item_id is null or tutor_payout_item_id = p_item_id)
    and tutor_payout_status is distinct from v_status;
  return found;
end $$;
revoke execute on function record_tutor_payout(uuid, text, text) from public, anon, authenticated;
grant execute on function record_tutor_payout(uuid, text, text) to service_role;
