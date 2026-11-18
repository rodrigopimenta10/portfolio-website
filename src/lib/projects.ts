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
