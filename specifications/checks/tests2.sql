-- Ledger and quota checks (run after tests.sql on the same fresh database).
insert into ledger_accounts (id,owner_id,kind,currency,normal_side) values
 ('60000000-0000-0000-0000-000000000001',null,'unit_issuance','UNIT','debit'),
 ('60000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','user_units_earned','UNIT','credit');
select plan(7);
select lives_ok($$select post_txn('earn','earn:a:1','[{"account_id":"60000000-0000-0000-0000-000000000001","amount":3},{"account_id":"60000000-0000-0000-0000-000000000002","amount":-3}]')$$,'earn posts');
select throws_ok($$select post_txn('bad','bad:1','[{"account_id":"60000000-0000-0000-0000-000000000001","amount":3},{"account_id":"60000000-0000-0000-0000-000000000002","amount":-2}]')$$, 'P0001', 'unbalanced transaction (unit 1, ngn 0)', 'unbalanced rejected');
select throws_ok($$select post_txn('spend','spend:a:1','[{"account_id":"60000000-0000-0000-0000-000000000002","amount":5},{"account_id":"60000000-0000-0000-0000-000000000001","amount":-5}]')$$, 'P0001', 'insufficient balance on user_units_earned', 'overdraw rejected');
select is(post_txn('earn','earn:a:1','[{"account_id":"60000000-0000-0000-0000-000000000001","amount":3},{"account_id":"60000000-0000-0000-0000-000000000002","amount":-3}]'), (select id from ledger_txns where idempotency_key='earn:a:1'), 'replay returns same txn');
select is((select balance from ledger_accounts where id='60000000-0000-0000-0000-000000000002'), -3::bigint, 'replay did not double credit');
select is((select count(*)::int from ledger_txns), 1, 'failed txns rolled back');
select is(consume_quota('00000000-0000-0000-0000-00000000000b','new_lesson',0), false, 'a zero quota allows nothing');
select * from finish();
