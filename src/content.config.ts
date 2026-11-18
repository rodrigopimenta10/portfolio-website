// Content collections. A new project is a new Markdown file in src/content/projects/.
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const source = z.object({
  /** The claim as the site makes it. */
  claim: z.string(),
  /** Where it was checked. */
  where: z.string(),
  href: z.url().optional(),
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '*.md' }),
  schema: ({ image }) =>
    z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('personal'),
        title: z.string(),
        order: z.number(),
        /** One sentence: what it is. */
        summary: z.string(),
        /** His part, stated plainly, including what AI tools did. */
        role: z.string(),
        stack: z.array(z.string()).min(1),
        /** A concrete result, with its numbers. */
        result: z.string(),
        live: z.url().optional(),
        code: z.url(),
        /** The row of the status panel that reports on this project. */
        statusId: z.enum(['sightline', 'orbital-watch', 'aws-platform']).optional(),
        screenshot: z.object({ src: image(), alt: z.string(), caption: z.string() }),
        /** Which architecture sketch (src/components/diagrams/) to show, and what it was drawn from. */
        diagram: z.object({
          name: z.enum(['sightline', 'aws-platform-terraform', 'orbital-watch']),
          caption: z.string(),
          sourceHref: z.url(),
          sourceLabel: z.string(),
        }),
        /** Three or four short facts for the card on the home page. */
        facts: z.array(z.string()).max(4),
        sources: z.array(source),
      }),
      z.object({
        kind: z.literal('work'),
        title: z.string(),
        order: z.number(),
        /** The id of this system in the resume (src/data/resume.json). Its words are shown as written there. */
        resumeId: z.string(),
      }),
    ]),
});

// Roles come straight from the resume, so the Experience page and the Resume page cannot disagree.
const experience = defineCollection({
  loader: file('src/data/resume.json', { parser: (text) => JSON.parse(text).experience }),
  schema: z.object({
    role: z.string(),
    org: z.string(),
    location: z.string(),
    dates: z.string(),
    bullets: z.array(z.string()),
    summary: z.string().optional(),
  }),
});

export const collections = { projects, experience };
