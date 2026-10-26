-- MVP-02 private lessons: coverage and grounding use only the student's own private chunks (never
-- someone else's, never past questions); private versions never touch the shared lesson; students
-- see practice items only once published (11 §2 item 2).
begin;
create extension if not exists pgtap with schema extensions;

-- A one-hot 384-d vector: the same index is similarity 1, different indexes similarity 0.
create function pg_temp.onehot(i int) returns extensions.vector language sql as $$
  select ('[' || string_agg(case when g = i then '1' else '0' end, ',' order by g) || ']')::extensions.vector
  from generate_series(1, 384) g
$$;

-- a·e_i + b·e_j: similarity a to concept i and b to concept j.
create function pg_temp.mix(i int, a real, j int, b real) returns extensions.vector language sql as $$
  select ('[' || string_agg(case when g = i then a::text when g = j then b::text else '0' end, ',' order by g) || ']')::extensions.vector
  from generate_series(1, 384) g
$$;

insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a2','pa@x'),('00000000-0000-0000-0000-0000000000b2','pb@x');
update profiles set is_adult = true where id in ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000b2');
insert into universities (id,name,short_name) values ('12000000-0000-0000-0000-000000000001','Path Test University','T-PTU');
insert into courses (id,university_id,code,title,created_by) values
 ('22000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001','PHY 191','Mechanics','00000000-0000-0000-0000-0000000000a2');
insert into enrollments values ('00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001','student',false,now()),
 ('00000000-0000-0000-0000-0000000000b2','22000000-0000-0000-0000-000000000001','student',false,now());
insert into concepts (id,slug,title,subject,level_band,embedding) values
 ('72000000-0000-0000-0000-000000000001','mechanics.projectiles-path','Projectile motion','physics','introductory',pg_temp.onehot(1)),
 ('72000000-0000-0000-0000-000000000002','mechanics.friction-path','Friction','physics','introductory',pg_temp.onehot(2)),
 ('72000000-0000-0000-0000-000000000003','waves.sound-path','Sound waves','physics','introductory',pg_temp.onehot(3));
insert into topics (course_id,concept_id,position,title) values
 ('22000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001',1,'Projectiles'),
 ('22000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000002',2,'Friction');
insert into sources (id,owner_id,course_id,concept_id,kind,title) values
 ('52000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001',null,'notes','A notes'),
 ('52000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001',null,'past_paper','A papers'),
 ('52000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000b2','22000000-0000-0000-0000-000000000001',null,'notes','B notes'),
 ('52000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000a2',null,'72000000-0000-0000-0000-000000000003','notes','A sound notes');
-- A: 3 projectile chunks, 1 friction chunk, 1 projectile past question. B: 2 projectile chunks.
insert into chunks (source_id,owner_id,course_id,concept_id,visibility,page,content,embedding) values
 ('52000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001',null,'private',1,'a proj 1',pg_temp.onehot(1)),
 ('52000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001',null,'private',2,'a proj 2',pg_temp.onehot(1)),
 ('52000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001',null,'private',3,'a proj 3',pg_temp.onehot(1)),
 ('52000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001',null,'private',4,'a friction',pg_temp.onehot(2)),
 ('52000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001',null,'private',1,'a past q',pg_temp.onehot(1)),
 ('52000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000b2','22000000-0000-0000-0000-000000000001',null,'private',1,'b proj 1',pg_temp.onehot(1)),
 ('52000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000b2','22000000-0000-0000-0000-000000000001',null,'private',2,'b proj 2',pg_temp.onehot(1)),
 ('52000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000a2',null,'72000000-0000-0000-0000-000000000003','private',9,'a sound',pg_temp.onehot(3));

select plan(18);

-- Coverage and grounding (service role)
select is((select close_chunks from material_coverage('00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001',null,0.8)
            where concept_id = '72000000-0000-0000-0000-000000000001'), 3, 'A''s projectile coverage counts their notes, not past questions');
select is((select close_chunks from material_coverage('00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001',null,0.8)
            where concept_id = '72000000-0000-0000-0000-000000000002'), 1, 'A''s friction coverage: one close chunk');
select is((select close_chunks from material_coverage('00000000-0000-0000-0000-0000000000b2','22000000-0000-0000-0000-000000000001',null,0.8)
            where concept_id = '72000000-0000-0000-0000-000000000001'), 2, 'B''s coverage counts only B''s chunks');
-- A chunk close to both topics (0.6 projectiles, 0.8 friction) counts only for its best match.
insert into chunks (source_id,owner_id,course_id,visibility,page,content,embedding) values
 ('52000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001','private',6,'a mixed',pg_temp.mix(1,0.6,2,0.8));
select is((select array_agg(close_chunks order by concept_id) from material_coverage('00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001',null,0.5)),
          array[3,2], 'a chunk counts only for the topic it matches best');
delete from chunks where content = 'a mixed';
select is((select close_chunks from material_coverage('00000000-0000-0000-0000-0000000000a2',null,'72000000-0000-0000-0000-000000000003',0.8)), 1,
          'a free-standing topic counts the chunks filed under it');
select is((select array_agg(content order by content) from private_lesson_sources('00000000-0000-0000-0000-0000000000a2','22000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001',0.8,12)),
          array['a proj 1','a proj 2','a proj 3'], 'A''s lesson is grounded only in A''s own notes on the topic');
select is((select count(*)::int from private_lesson_sources('00000000-0000-0000-0000-0000000000b2','22000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001',0.8,12) p
            join chunks c on c.id = p.id where c.owner_id <> '00000000-0000-0000-0000-0000000000b2'), 0, 'B never grounds a lesson in A''s chunks');

-- Private lesson versions
insert into lessons (id,concept_id,owner_id,status,dsl_version,spec) values
 ('42000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001',null,'published',1,'{}');
update concepts set current_lesson_id = '42000000-0000-0000-0000-000000000001' where id = '72000000-0000-0000-0000-000000000001';
select publish_private_lesson('00000000-0000-0000-0000-0000000000a2','72000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001','{"v":1}','published',array[1::bigint],1,'m');
select publish_private_lesson('00000000-0000-0000-0000-0000000000a2','72000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001','{"v":2}','published',array[1::bigint],1,'m');
select is((select array_agg(version || ':' || status order by version) from lessons where owner_id = '00000000-0000-0000-0000-0000000000a2'),
          array['1:superseded','2:published'], 'a new private version supersedes the earlier one');
select is((select status::text from lessons where id = '42000000-0000-0000-0000-000000000001'), 'published', 'the shared lesson is untouched');
select is((select current_lesson_id from concepts where id = '72000000-0000-0000-0000-000000000001'), '42000000-0000-0000-0000-000000000001'::uuid,
          'the concept still points at the shared lesson');

-- Practice items: one shared, A's published and in-review private items.
insert into items (concept_id,owner_id,type,stem,answer,verification,origin,status) values
 ('72000000-0000-0000-0000-000000000001',null,'mcq','{"n":"shared"}','{}','{}','generated','published'),
 ('72000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','numeric','{"n":"a ok"}','{}','{}','generated','published'),
 ('72000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','numeric','{"n":"a review"}','{}','{}','generated','review');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select is((select count(*)::int from lessons where owner_id = auth.uid() and status = 'published'), 1, 'A sees their private lesson');
select is((select array_agg(stem->>'n' order by stem->>'n') from items where concept_id = '72000000-0000-0000-0000-000000000001'),
          array['a ok','shared'], 'A sees published items only: their own and shared, never one in review');
select throws_ok($$select * from material_coverage(auth.uid(),'22000000-0000-0000-0000-000000000001',null,0.8)$$, '42501', null, 'clients cannot call material_coverage');
select throws_ok($$select * from private_lesson_sources(auth.uid(),'22000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001',0.8,12)$$, '42501', null, 'clients cannot call private_lesson_sources');
select throws_ok($$select publish_private_lesson(auth.uid(),'72000000-0000-0000-0000-000000000001',null,'{}','published','{}',0)$$, '42501', null, 'clients cannot publish lessons');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select is((select count(*)::int from lessons where owner_id = '00000000-0000-0000-0000-0000000000a2'), 0, 'B cannot see A''s private lessons');
select is((select array_agg(stem->>'n') from items where concept_id = '72000000-0000-0000-0000-000000000001'), array['shared'], 'B never sees A''s private items');
reset role;

select is((select (value->'private_lesson'->>'limit')::int from app_config where key = 'ai_quotas'), 30, 'pilot allowance: 30 private lessons a day');

select * from finish();
rollback;
