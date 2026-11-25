// Reading the projects collection, and one check that ties the home page to the resume.
import { getCollection, type CollectionEntry } from 'astro:content';
import resume from '../data/resume.json';

export type Project = CollectionEntry<'projects'>;

/** The side projects, in the order they are shown everywhere. */
export async function allProjects(): Promise<Project[]> {
  return (await getCollection('projects')).sort((a, b) => a.data.order - b.data.order);
}

/** The line in a project's Markdown that says where its architecture figure goes. */
const ARCHITECTURE_MARK = '<!-- architecture -->';

/**
 * A project's body as HTML, in the two parts that go before and after its architecture figure.
 * The build fails if the Markdown does not say exactly once where the figure goes.
 */
export function bodyAroundArchitecture(project: Project): { before: string; after: string } {
  const [before, after, ...more] = (project.rendered?.html ?? '').split(ARCHITECTURE_MARK);
  if (before === undefined || after === undefined || more.length > 0) {
    throw new Error(`${project.id}: the body needs one "${ARCHITECTURE_MARK}" line where the architecture figure goes`);
  }
  return { before, after };
}

/**
 * A line about work, cut from a resume bullet. The build fails if the resume no longer says it,
 * so the home page cannot drift from the resume. Returned with a capital first letter.
 */
export function resumeLine(excerpt: string): string {
  const said = resume.experience.some((job) =>
    job.bullets.some((bullet) => bullet.toLowerCase().includes(excerpt.toLowerCase())),
  );
  if (!said) throw new Error(`The resume has no line that says: "${excerpt}"`);
  return excerpt.charAt(0).toUpperCase() + excerpt.slice(1);
}
