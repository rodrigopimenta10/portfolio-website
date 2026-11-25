// Content collections. A new project is a new Markdown file in src/content/projects/.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      order: z.number(),
      /** What it is, in a sentence or two. The first lines of its case study. */
      summary: z.string(),
      /** My part, stated plainly, including what AI tools did. */
      role: z.string(),
      /** A concrete result, with its numbers. */
      result: z.string(),
      /** What it is built with. Read out as one sentence, so the items are in reading order. */
      stack: z.array(z.string()).min(1),
      live: z.url().optional(),
      code: z.url(),
      /** A recorded demo. */
      video: z.url().optional(),
      screenshot: z.object({ src: image(), alt: z.string(), caption: z.string() }),
      /**
       * The architecture figure, shown where the body says `<!-- architecture -->`. Either a picture
       * or the name of an inline diagram in src/components/diagrams/.
       */
      architecture: z
        .object({
          caption: z.string(),
          image: z.object({ src: image(), alt: z.string() }).optional(),
          diagram: z.enum(['orbital-watch', 'aws-platform-terraform']).optional(),
        })
        .refine((figure) => Boolean(figure.image) !== Boolean(figure.diagram), 'Give a picture or a diagram, one of the two.'),
      /** The project's row on the Side projects page. */
      card: z.object({
        summary: z.string(),
        /** The screenshot described in a line, for the smaller picture. */
        alt: z.string(),
        /** The one thing to remember, set in bold, and the sentence it starts. */
        claim: z.string(),
        detail: z.string(),
        tags: z.array(z.string()).min(1),
      }),
    }),
});

export const collections = { projects };
