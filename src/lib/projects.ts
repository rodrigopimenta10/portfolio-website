// Reading the projects collection: order, and the resume's words for the systems built at work.
import { getCollection, type CollectionEntry } from 'astro:content';
import resume from '../data/resume.json';

export type Project = CollectionEntry<'projects'>;
export type PersonalProject = Project & { data: Extract<Project['data'], { kind: 'personal' }> };
export type WorkProject = Project & { data: Extract<Project['data'], { kind: 'work' }> };

export async function allProjects(): Promise<Project[]> {
  return (await getCollection('projects')).sort((a, b) => a.data.order - b.data.order);
}

export const isPersonal = (project: Project): project is PersonalProject => project.data.kind === 'personal';
export const isWork = (project: Project): project is WorkProject => project.data.kind === 'work';

/**
 * A system built at work, in the resume's words and no others: the code is the employer's, so
 * the site says exactly what the resume says. The bullet is split into its sentences for reading.
 */
export function resumeWords(project: WorkProject): { stack: string[]; sentences: string[] } {
  const system = resume.systems.find((candidate) => candidate.id === project.data.resumeId);
  if (!system) throw new Error(`${project.id}: the resume has no system "${project.data.resumeId}"`);
  const sentences = system.bullets
    .flatMap((bullet) => bullet.split(/(?<=\.)\s+(?=[A-Z0-9])/))
    .map((sentence) => (sentence.endsWith('.') ? sentence : `${sentence}.`));
  return { stack: system.stack, sentences };
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
