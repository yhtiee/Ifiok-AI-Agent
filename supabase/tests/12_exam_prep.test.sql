-- MVP-04 exam prep: past questions stay in their course, study plans are the owner's, and a
-- self-marked "Partly" moves mastery at half weight (12 §4 Q53).
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a4','ea@x'),('00000000-0000-0000-0000-0000000000b4','eb@x');
update profiles set is_adult = true where id in ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-0000000000b4');
insert into universities (id,name,short_name) values ('14000000-0000-0000-0000-000000000001','Exam Test University','T-ETU');
insert into courses (id,university_id,code,title,created_by) values
 ('24000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000001','CPE 391','Exams','00000000-0000-0000-0000-0000000000a4');
insert into enrollments values ('00000000-0000-0000-0000-0000000000a4','24000000-0000-0000-0000-000000000001','student',false,now());
insert into concepts (id,slug,title,subject,level_band) values
 ('74000000-0000-0000-0000-000000000001','cs.sql-exam-test','SQL','computer-science','intermediate');
insert into sources (id,owner_id,course_id,kind,title) values
 ('54000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a4','24000000-0000-0000-0000-000000000001','past_paper','2024 paper');
insert into items (id,concept_id,course_id,type,stem,answer,verification,origin,status) values
 ('64000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000001','short_text','{"n":"past"}','{}','{}','past_paper','published'),
 ('64000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000001',null,'mcq','{"n":"shared"}','{}','{}','generated','published');
insert into exam_questions (course_id,source_id,year,number,text_latex,marks,qtype,concept_id,item_id,added_by) values
 ('24000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001',2024,'1a','Define a primary key.',5,'definition',
  '74000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a4');
insert into exam_plans (user_id,course_id,exam_date,plan) values
 ('00000000-0000-0000-0000-0000000000a4','24000000-0000-0000-0000-000000000001',current_date + 10,'{"days":[]}');

select plan(9);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a4';
select is((select array_agg(stem->>'n' order by stem->>'n') from items where concept_id = '74000000-0000-0000-0000-000000000001'),
          array['past','shared'], 'a member sees the course''s past-question items and shared practice');
select is((select count(*)::int from exam_questions), 1, 'a member reads the course''s past questions');
select is((select count(*)::int from exam_plans), 1, 'a student reads their own plan');
select throws_ok($$insert into exam_plans (user_id,course_id,exam_date) values (auth.uid(),'24000000-0000-0000-0000-000000000001',current_date)$$,
                 '42501', null, 'plans are written by the server only');
select throws_ok($$update exam_questions set marks = 99$$, '42501', null, 'past questions are saved by the server only');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b4';
select is((select array_agg(stem->>'n') from items where concept_id = '74000000-0000-0000-0000-000000000001'),
          array['shared'], 'a non-member never sees another course''s past questions as items');
select is((select count(*)::int from exam_questions) + (select count(*)::int from exam_plans), 0,
          'nor its past questions or anyone''s plan');
reset role;

select is((select m from record_attempt('a4000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a4',
          '64000000-0000-0000-0000-000000000001','{"self":"partly"}',true,null,0.5)), 0.090::numeric,
          'a self-marked "Partly" counts as correct at half weight');
select throws_ok($$select * from record_attempt(gen_random_uuid(),'00000000-0000-0000-0000-0000000000a4','64000000-0000-0000-0000-000000000001','{}',true,null,2)$$,
                 'P0001', null, 'the weight factor can only reduce a weight');

select * from finish();
rollback;
