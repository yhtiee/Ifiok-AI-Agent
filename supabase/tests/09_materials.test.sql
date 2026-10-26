-- MVP-01 materials: private sources and chunks stay with their owner, the embed job's write is
-- server-only, and retrieval never hands one student another's private chunks (11 §2 items 2, 5).
begin;
create extension if not exists pgtap with schema extensions;

-- Fixtures. A and B: students in the same course. A also has notes for a free-standing topic.
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1','ma@x'),('00000000-0000-0000-0000-0000000000b1','mb@x');
update profiles set is_adult = true where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1');
insert into universities (id,name,short_name) values ('11000000-0000-0000-0000-000000000001','Materials Test University','T-MTU');
insert into courses (id,university_id,code,title,created_by)
select ('21000000-0000-0000-0000-00000000000' || n)::uuid, '11000000-0000-0000-0000-000000000001', 'PHY 10' || n, 'Physics ' || n,
       '00000000-0000-0000-0000-0000000000a1'
from generate_series(1, 5) n;
insert into enrollments values ('00000000-0000-0000-0000-0000000000a1','21000000-0000-0000-0000-000000000001','student',false,now()),
 ('00000000-0000-0000-0000-0000000000b1','21000000-0000-0000-0000-000000000001','student',false,now());
insert into concepts (id,slug,title,subject,level_band) values
 ('71000000-0000-0000-0000-000000000001','mechanics.projectiles-test','Projectile motion','physics','introductory');
insert into sources (id,owner_id,course_id,concept_id,kind,title,page_count) values
 ('51000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','21000000-0000-0000-0000-000000000001',null,'notes','A notes',2),
 ('51000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1',null,'71000000-0000-0000-0000-000000000001','textbook_private','A textbook pages',1),
 ('51000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000b1','21000000-0000-0000-0000-000000000001',null,'notes','B notes',500);
insert into chunks (source_id,owner_id,course_id,concept_id,visibility,page,content) values
 ('51000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','21000000-0000-0000-0000-000000000001',null,'private',1,'zygomorphic projectile range derivation'),
 ('51000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','21000000-0000-0000-0000-000000000001',null,'private',2,'horizontal and vertical components'),
 ('51000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1',null,'71000000-0000-0000-0000-000000000001','private',7,'projectile time of flight');
-- B: 500 private chunks in each of the 5 courses, all about projectiles (no post-filter starvation).
insert into chunks (source_id,owner_id,course_id,visibility,page,content)
select '51000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b1',
       ('21000000-0000-0000-0000-00000000000' || c)::uuid, 'private', n, 'projectile range filler ' || n
from generate_series(1, 5) c, generate_series(1, 500) n;

select plan(15);

set local role authenticated;
-- Student B
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select is((select count(*)::int from sources where owner_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'B cannot see A''s sources');
select is((select count(*)::int from chunks where owner_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'B cannot read A''s chunks');
select is((select count(*)::int from material_summaries('21000000-0000-0000-0000-000000000001', null) where title = 'A notes'), 0, 'B''s materials list never shows A''s sources');
select throws_ok($$insert into chunks (source_id,owner_id,visibility,content) values ('51000000-0000-0000-0000-000000000003',auth.uid(),'private','x')$$, '42501', null, 'clients cannot write chunks');
select throws_ok($$select set_chunk_embeddings('51000000-0000-0000-0000-000000000003', array[1::bigint], array['[0]'])$$, '42501', null, 'clients cannot write embeddings');
select throws_ok($$update sources set concept_id = '71000000-0000-0000-0000-000000000001' where owner_id = auth.uid()$$, '42501', null, 'clients cannot move a source to another topic');
select throws_ok($$delete from sources where owner_id = auth.uid()$$, '42501', null, 'clients delete materials through the server only');
-- Student A
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select is((select chunks || '/' || pending_chunks from material_summaries('21000000-0000-0000-0000-000000000001', null)), '2/2', 'A sees their course notes: 2 chunks, both waiting for embeddings');
select is((select title from material_summaries(null, '71000000-0000-0000-0000-000000000001')), 'A textbook pages', 'A sees their topic materials by concept');
reset role;

-- Server-side (service role)
select is(set_chunk_embeddings('51000000-0000-0000-0000-000000000003',
  array(select id from chunks where content like 'zygomorphic%'), array[(select '[' || array_to_string(array_fill(0.1::real, array[384]), ',') || ']')]),
  0, 'embeddings are written only for chunks of the named source');
select is(set_chunk_embeddings('51000000-0000-0000-0000-000000000001',
  array(select id from chunks where content like 'zygomorphic%'), array[(select '[' || array_to_string(array_fill(0.1::real, array[384]), ',') || ']')]),
  1, 'the embed job fills one chunk''s embedding');
select is((select count(*)::int from match_chunks('00000000-0000-0000-0000-0000000000b1','21000000-0000-0000-0000-000000000001',null,'zygomorphic projectile range', null, 6) m
            join chunks c on c.id = m.id where c.owner_id <> '00000000-0000-0000-0000-0000000000b1'), 0, 'B never retrieves A''s private chunks in a shared course');
select is((select count(*)::int from match_chunks('00000000-0000-0000-0000-0000000000b1',null,'71000000-0000-0000-0000-000000000001','projectile time of flight', null, 6)), 0, 'B never retrieves A''s private topic chunks by concept');
select is((select c.content from match_chunks('00000000-0000-0000-0000-0000000000a1','21000000-0000-0000-0000-000000000001',null,'zygomorphic projectile', null, 6) m
            join chunks c on c.id = m.id order by m.score desc limit 1), 'zygomorphic projectile range derivation', 'A finds their chunk first among 2,500 other chunks across 5 courses');
delete from sources where id = '51000000-0000-0000-0000-000000000001';
select is((select count(*)::int from chunks where source_id = '51000000-0000-0000-0000-000000000001'), 0, 'deleting a source deletes its chunks');

select * from finish();
rollback;
