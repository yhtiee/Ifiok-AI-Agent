-- MVP-05 labs: shared topic labs for everyone, manual labs for their owner, the hidden
-- configuration for the server only, and runs written by the server (12 §4 Q55).
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a5','la@x'),('00000000-0000-0000-0000-0000000000b5','lb@x');
update profiles set is_adult = true where id in ('00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000b5');
insert into sources (id,owner_id,kind,title) values
 ('55000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a5','lab_manual','PHY 107 manual');
insert into labs (id,owner_id,origin,topic_key,source_id,title,status,config,public_config,config_hash) values
 ('65000000-0000-0000-0000-000000000001',null,'topic','hookes law',null,'Hooke''s law','ready','{"hidden":{"k":25}}','{"title":"Hooke''s law"}','h1'),
 ('65000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a5','manual',null,'55000000-0000-0000-0000-000000000001','Simple pendulum','ready','{"hidden":{"g":9.81}}','{"title":"Simple pendulum"}','h2');
insert into user_labs (user_id,lab_id) values
 ('00000000-0000-0000-0000-0000000000a5','65000000-0000-0000-0000-000000000002');

select plan(9);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a5';
select is((select count(*)::int from labs), 2, 'the owner sees the shared lab and their own manual lab');
select is((select count(*)::int from user_labs), 1, 'a student sees their own lab list');
select throws_ok($$select config from labs$$, '42501', null, 'the hidden configuration is not readable by students');
select lives_ok($$select public_config, title, status from labs$$, 'the public columns are readable');
select throws_ok($$insert into labs (origin,title,status) values ('topic','x','declined')$$, '42501', null,
                 'labs are written by the server only');
select throws_ok($$insert into lab_runs (id,user_id,lab_slug,seed,data) values (gen_random_uuid(),auth.uid(),'experiment',1,'{}')$$,
                 '42501', null, 'lab runs are written by the server only');
select throws_ok($$insert into user_labs (user_id,lab_id) values (auth.uid(),'65000000-0000-0000-0000-000000000001')$$,
                 '42501', null, 'a student can''t add labs to their list directly');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b5';
select is((select array_agg(title) from labs), array['Hooke''s law'], 'another student sees only the shared lab');
select is((select count(*)::int from user_labs), 0, 'and none of the first student''s list');

select * from finish();
rollback;
