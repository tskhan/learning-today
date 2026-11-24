/** How long someone counts as new: "Welcome" for their first day, "Welcome back" after that. */
const NEW_FOR_MS = 24 * 60 * 60 * 1000;

/** The dashboard heading: "Welcome, Ayesha" on the day they join, "Welcome back, Ayesha" afterwards. */
export function greeting(firstName: string, joinedAt: string, now: Date = new Date()): string {
  const isNew = now.getTime() - new Date(joinedAt).getTime() < NEW_FOR_MS;
  return `${isNew ? "Welcome" : "Welcome back"}, ${firstName}`;
}
