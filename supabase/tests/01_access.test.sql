-- Access rules for the P0 schema, ported from specifications/checks/tests.sql.
-- Changes from the spec file: profiles come from the handle_new_user trigger (fixtures update
-- them), and the post_txn check moves to P2-02 with the ledger.
begin;
create extension if not exists pgtap with schema extensions;

-- Fixtures. Users: A, B students (Uniuyo, MTH 101); L lecturer (MTH 101); D admin;
-- E curator (mathematics); F student at another university, not enrolled in MTH 101.
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','a@x'),('00000000-0000-0000-0000-00000000000b','b@x'),
 ('00000000-0000-0000-0000-00000000000c','lect@x'),('00000000-0000-0000-0000-00000000000d','adm@x'),
 ('00000000-0000-0000-0000-00000000000e','cur@x'),('00000000-0000-0000-0000-00000000000f','f@x');
insert into universities (id,name,short_name) values
 ('10000000-0000-0000-0000-000000000001','Test University of Uyo','T-UNIUYO'),
 ('10000000-0000-0000-0000-000000000002','Test University of Lagos','T-UNILAG');
update profiles p set display_name = v.name, role = v.role::user_role, university_id = v.uni::uuid, is_adult = true
from (values
 ('00000000-0000-0000-0000-00000000000a','A','student','10000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-00000000000b','B','student','10000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-00000000000c','L','lecturer','10000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-00000000000d','D','admin','10000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-00000000000e','E','student','10000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-00000000000f','F','student','10000000-0000-0000-0000-000000000002')
) as v(id, name, role, uni) where p.id = v.id::uuid;
insert into subjects (code,title,sensitive) values ('mathematics','Mathematics',false),('physics','Physics',false),('law','Law',true)
  on conflict (code) do nothing;
insert into courses (id,university_id,code,title,created_by) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','MTH 101','Elementary Mathematics I','00000000-0000-0000-0000-00000000000a');
insert into enrollments values ('00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','student',false,now()),
 ('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001','student',false,now()),
 ('00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001','lecturer',true,now());
insert into concepts (id,slug,title,subject,level_band) values
 ('70000000-0000-0000-0000-000000000001','calculus.limits','Limits of a function','mathematics','introductory'),
 ('70000000-0000-0000-0000-000000000002','mechanics.newtons-laws','Newton''s laws of motion','physics','introductory');
insert into curators (user_id,subject) values ('00000000-0000-0000-0000-00000000000e','mathematics');
insert into topics (id,course_id,concept_id,position,title) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',1,'Limits');
insert into lessons (id,concept_id,course_id,owner_id,status,dsl_version,spec) values
 ('40000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',null,null,'published',1,'{}'),
 ('40000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','published',1,'{}'),
 ('40000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000002',null,null,'review',1,'{}');
insert into sources (id,owner_id,course_id,kind,visibility,title,review) values
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','textbook_private','private','My book','pending'),
 ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','notes','bank','Rejected notes','rejected'),
 ('50000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','notes','bank','Approved notes','approved'),
 ('50000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001','handout','course','Lecture handout','approved'),
 ('50000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001','past_paper','bank','2024 exam','approved');
insert into chunks (source_id,owner_id,course_id,concept_id,visibility,page,content) values
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','private',3,'secret limit content about epsilon delta'),
 ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','bank',1,'rejected limit text'),
 ('50000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','bank',1,'approved notes on the limit of a function'),
 ('50000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000000c','20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','course',2,'lecturer handout on the limit of sin x over x'),
 ('50000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','bank',1,'Q3 evaluate the limit of a function as x tends to 2');

select plan(39);
select throws_ok($$insert into sources (owner_id,course_id,kind,visibility,title) values ('00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','textbook_private','bank','x')$$, '23514', null, 'private textbook cannot be bank');

set local role authenticated;
-- Lecturer L
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select throws_ok($$update lessons set status='published'$$, '42501', null, 'lecturer cannot update lessons directly');
select is((select count(*)::int from lessons), 1, 'lecturer sees the published shared lesson only (not private, not in review)');
select is((select count(*)::int from chunks), 1, 'clients read only their own chunks (lecturer: own handout)');
-- Student B (same course)
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from lessons), 1, 'student B sees shared lesson only');
select is((select count(*)::int from chunks where content like 'rejected%'), 0, 'rejected bank text is hidden');
select is((select count(*)::int from sources where owner_id <> auth.uid()), 0, 'clients cannot list other people''s sources');
select throws_ok($$select * from match_chunks(auth.uid(),'20000000-0000-0000-0000-000000000001',null,'limit', null, 6)$$, '42501', null, 'clients cannot call match_chunks');
select throws_ok($$insert into courses (university_id,code,title) values ('10000000-0000-0000-0000-000000000001','CHM 101','Chemistry')$$, '42501', null, 'courses are created through the server, not directly');
select throws_ok($$insert into topics (course_id,concept_id,position,title) values ('20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',2,'x')$$, '42501', null, 'outline edits go through the server');
select throws_ok($$insert into concepts (slug,title,subject,level_band) values ('x','x','x','introductory')$$, '42501', null, 'concepts are created by the server');
select lives_ok($$insert into concept_follows (user_id,concept_id) values (auth.uid(),'70000000-0000-0000-0000-000000000002')$$, 'student can follow any concept outside a course');
-- Student F (another university, not enrolled): global sharing
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select is((select count(*)::int from lessons), 1, 'student at another university reuses the shared lesson');
select is((select count(*)::int from chunks), 0, 'no bulk reads of the crowd bank from the client');
-- Curator E
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select is(is_curator('70000000-0000-0000-0000-000000000001'), true, 'maths curator covers maths concepts');
select is(is_curator('70000000-0000-0000-0000-000000000002'), false, 'maths curator does not cover physics concepts');
-- Student A (owner)
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select is((select count(*)::int from lessons), 2, 'owner sees shared + private lesson');
select throws_ok($$insert into sources (owner_id,course_id,kind,visibility,title,review) values (auth.uid(),'20000000-0000-0000-0000-000000000001','notes','bank','x','approved')$$, '42501', null, 'cannot insert self-approved bank source');
select throws_ok($$update sources set review='approved', visibility='bank' where owner_id = auth.uid()$$, '42501', null, 'cannot self-approve own source');
select lives_ok($$insert into sources (owner_id,course_id,kind,title) values (auth.uid(),null,'notes','My course-free notes')$$, 'can create a private pending source, with or without a course');
select throws_ok($$insert into sources (owner_id,course_id,kind,title) values (auth.uid(),'20000000-0000-0000-0000-000000000001','handout','Fake handout')$$, '42501', null, 'students cannot create handout sources');
select throws_ok($$update lessons set status='published' where id='40000000-0000-0000-0000-000000000002'$$, '42501', null, 'cannot update lessons from the client');
select throws_ok($$insert into review_cards (user_id,item_id,due,stability,difficulty) values (auth.uid(),gen_random_uuid(),now(),1,1)$$, '42501', null, 'cannot write review cards');
select throws_ok($$select consume_quota(auth.uid(),'tutor',8)$$, '42501', null, 'cannot call consume_quota');
select throws_ok($$select enqueue_job('payouts','{}'::jsonb)$$, '42501', null, 'cannot call enqueue_job');
select throws_ok($$update profiles set role='admin' where id = auth.uid()$$, '42501', null, 'cannot self-promote');
select lives_ok($$update profiles set first_name='Ada' where id = auth.uid()$$, 'can edit own name');
select throws_ok($$insert into attempts (id,user_id,item_id,response,correct) values (gen_random_uuid(), auth.uid(), gen_random_uuid(), '{}', true)$$, '42501', null, 'clients cannot insert attempts');
-- Admin D
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
set local request.jwt.claims = '{"aal":"aal1"}';
select is(is_admin(), false, 'admin without MFA is not admin');
set local request.jwt.claims = '{"aal":"aal2"}';
select is(is_admin(), true, 'admin with MFA is admin');
reset role;
-- Server-side functions (service role / superuser)
select is((select count(*)::int from match_chunks('00000000-0000-0000-0000-00000000000b','20000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','limit epsilon', null, 6)), 3, 'B in the course: bank + course chunks + own upload, never A''s private chunk');
select is((select count(*)::int from match_chunks('00000000-0000-0000-0000-00000000000f',null,'70000000-0000-0000-0000-000000000001','what is the limit of a function', null, 6)), 1, 'F by concept only: the approved crowd chunk (others'' past papers excluded)');
select is((select count(*)::int from match_chunks('00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001',null,'what is the limit of epsilon', null, 6)), 4, 'owner retrieves own private and own uploads too (OR query)');
select is(consume_quota('00000000-0000-0000-0000-00000000000a','tutor',2) and consume_quota('00000000-0000-0000-0000-00000000000a','tutor',2) and not consume_quota('00000000-0000-0000-0000-00000000000a','tutor',2), true, 'quota stops at the limit');
select is(consume_quota('00000000-0000-0000-0000-00000000000b','new_lesson',0), false, 'a zero quota allows nothing');
select is(enqueue_job('noop','{}','k1') = enqueue_job('noop','{}','k1'), true, 'enqueue dedupes on key');
insert into lesson_flags (lesson_id,block_id,user_id,reason) values ('40000000-0000-0000-0000-000000000001','s1b1','00000000-0000-0000-0000-00000000000a','wrong'),('40000000-0000-0000-0000-000000000001','s1b1','00000000-0000-0000-0000-00000000000b','wrong'),('40000000-0000-0000-0000-000000000001','s1b1','00000000-0000-0000-0000-00000000000f','unclear');
select is((select hidden_blocks from lessons where id='40000000-0000-0000-0000-000000000001'), array['s1b1'], '3 flags from any students hide the block');
select is((select array_agg(id order by id) from shared_lesson_sources('70000000-0000-0000-0000-000000000001')), (select array_agg(id order by id) from chunks where content like 'approved notes%'), 'shared lessons use only approved crowd chunks (no private, course-only or past-paper)');
insert into concepts (id,slug,title,subject,level_band) values ('70000000-0000-0000-0000-000000000003','calculus.limits-2','Limits','mathematics','introductory');
insert into mastery (user_id,concept_id,m,level,attempts_count) values ('00000000-0000-0000-0000-00000000000b','70000000-0000-0000-0000-000000000001',0.40,'familiar',5),('00000000-0000-0000-0000-00000000000b','70000000-0000-0000-0000-000000000003',0.70,'proficient',3);
select merge_concepts('70000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000d');
select is((select m::text||'/'||level||'/'||attempts_count from mastery where user_id='00000000-0000-0000-0000-00000000000b'), '0.700/proficient/8', 'merge keeps best mastery and sums attempts');
select * from finish();
rollback;
