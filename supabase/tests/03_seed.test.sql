-- Seed data loads and is readable before sign-in (the onboarding university picker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
select ok((select count(*) from universities where short_name = 'UNIUYO') = 1, 'launch university is seeded once');
set local role anon;
select ok((select count(*) from universities) >= 30, 'universities are readable without signing in');
reset role;
select * from finish();
rollback;
