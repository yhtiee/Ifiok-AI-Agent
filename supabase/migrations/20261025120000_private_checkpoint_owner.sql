-- A private lesson's checkpoint items belong to its owner, like the lesson (MVP-02 saved them as
-- shared, which let other students read checkpoints built from someone's own notes). New ones are
-- saved with the owner by the lesson_gen job.
update items i set owner_id = l.owner_id
from lessons l
where i.lesson_id = l.id and l.owner_id is not null and i.owner_id is distinct from l.owner_id;
