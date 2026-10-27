-- MVP-06 moderation (12 §4 Q58): 3 reports from distinct students hide an explainer, the author
-- can't report their own, reports are server-written, and the review-admin check needs the role.
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a7','ma@x'),('00000000-0000-0000-0000-0000000000b7','mb@x'),
 ('00000000-0000-0000-0000-0000000000c7','mc@x'),('00000000-0000-0000-0000-0000000000d7','md@x'),
 ('00000000-0000-0000-0000-0000000000e7','me@x');
update profiles set is_adult = true where id::text like '00000000-0000-0000-0000-0000000000_7';
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000e7';
insert into concepts (id,slug,title,subject,level_band) values
 ('77000000-0000-0000-0000-000000000001','phy.ohm-mod-test','Ohm''s law','physics','introductory');
insert into explainers (id,author_id,concept_id,kind,title,body_md,status) values
 ('87000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a7','77000000-0000-0000-0000-000000000001','text','V equals IR','Explained…','approved');

insert into sources (id,owner_id,kind,title,visibility,review,shared_at) values
 ('57000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a7','notes','Ohm notes','bank','approved',now());

select plan(11);

select is(report_explainer('87000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a7','Mine'), 0,
          'the author can''t report their own explainer');
select is(report_explainer('87000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b7','Wrong'), 1, 'a first report');
select is(report_explainer('87000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b7','Again'), 1,
          'the same student reporting again counts once');
select is(report_explainer('87000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c7','Wrong'), 2, 'a second student');
select is((select status from explainers where id = '87000000-0000-0000-0000-000000000001'), 'approved', 'still live after 2');
select is(report_explainer('87000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d7','Wrong'), 3, 'a third student');
select is((select status from explainers where id = '87000000-0000-0000-0000-000000000001'), 'hidden', 'hidden after 3 reports');

select is(report_source('57000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a7','x x x'), 0, 'an uploader can''t report their own document');
select is((select count(*)::int from (select report_source('57000000-0000-0000-0000-000000000001', u::uuid, 'Copied from a book') from unnest(array['00000000-0000-0000-0000-0000000000b7','00000000-0000-0000-0000-0000000000c7','00000000-0000-0000-0000-0000000000d7']) u) r), 3, 'three students report it');
select is((select review::text from sources where id = '57000000-0000-0000-0000-000000000001'), 'needs_review', 'a document reported 3 times goes back to an admin');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e7';
select is(is_review_admin(), true, 'the admin role opens the review section');

select * from finish();
rollback;
