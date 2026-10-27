// Query key factory: the single source of query keys, so reads and invalidations always agree.
// Keys are hierarchical. Invalidating a prefix (e.g. `queryKeys.courses.all()`) also
// invalidates everything under it (search results, details, outlines).
// Add a domain here when the ticket that reads it lands.

const courses = {
  all: () => ["courses"] as const,
  mine: () => [...courses.all(), "mine"] as const,
  search: (term: string) => [...courses.all(), "search", term.trim().toLowerCase()] as const,
  detail: (courseId: string) => [...courses.all(), "detail", courseId] as const,
  outline: (courseId: string) => [...courses.detail(courseId), "outline"] as const,
  path: (courseId: string) => [...courses.detail(courseId), "path"] as const,
};

const concepts = {
  all: () => ["concepts"] as const,
  followed: () => [...concepts.all(), "followed"] as const,
  detail: (conceptId: string) => [...concepts.all(), "detail", conceptId] as const,
  /** Where the concept's shared lesson stands (published, generating, waiting, review, failed). */
  lesson: (conceptId: string) => [...concepts.detail(conceptId), "lesson"] as const,
};

const lessons = {
  all: () => ["lessons"] as const,
  detail: (lessonId: string) => [...lessons.all(), "detail", lessonId] as const,
  progress: (lessonId: string) => [...lessons.detail(lessonId), "progress"] as const,
};

const plan = {
  all: () => ["plan"] as const,
  day: (isoDate: string) => [...plan.all(), "day", isoDate] as const,
};

const practice = {
  all: () => ["practice"] as const,
  due: () => [...practice.all(), "due"] as const,
  mastery: (conceptId: string) => [...practice.all(), "mastery", conceptId] as const,
};

/** A student's own materials for a course or a free-standing topic (MVP-01). */
const materials = {
  all: () => ["materials"] as const,
  list: (scope: string) => [...materials.all(), "list", scope] as const,
  search: (scope: string, q: string) => [...materials.all(), "search", scope, q.trim().toLowerCase()] as const,
};

/** Virtual labs (MVP-05): the lists are server-rendered; mutations invalidate this prefix. */
const labs = {
  all: () => ["labs"] as const,
};

/** Contribute, teach and earn (MVP-06): explainers, tutor profile, earnings, admin review. */
const contribute = {
  all: () => ["contribute"] as const,
};

const jobs = {
  all: () => ["jobs"] as const,
  detail: (jobId: string) => [...jobs.all(), "detail", jobId] as const,
};

export const queryKeys = {
  me: () => ["me"] as const,
  courses,
  concepts,
  lessons,
  plan,
  practice,
  materials,
  labs,
  contribute,
  jobs,
};
