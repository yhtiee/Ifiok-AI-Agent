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
};

const concepts = {
  all: () => ["concepts"] as const,
  followed: () => [...concepts.all(), "followed"] as const,
  detail: (conceptId: string) => [...concepts.all(), "detail", conceptId] as const,
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
  jobs,
};
