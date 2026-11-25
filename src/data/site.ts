// Facts about the site itself, in one place. Contact details come from the resume (resume.json).
import resume from './resume.json';

export const site = {
  name: resume.contact.name,
  url: 'https://rodrigopimenta.com',
  // One sentence: who he is and what he builds. The first clause is the resume summary's; the
  // second is Orbital Watch's thesis (a system should report its own degradation) in plain words.
  sentence: "I'm Rodrigo Pimenta. I build systems that keep themselves running and say so when they can't.",
  description:
    'Backend and platform software engineer, six-plus years in Python. I build systems that keep themselves running and say so when they cannot. Open to roles in New York.',
  seeking: 'Open to senior backend and platform engineering roles in New York.',
  email: resume.contact.email,
  linkedin: resume.contact.linkedin,
  github: resume.contact.github,
  resumePdf: '/rodrigo_pimenta_resume.pdf',
  // His own 30-minute "Intro Call" booking page.
  bookCall: 'https://calendly.com/rodrigopimenta102/30min',
  repo: 'https://github.com/rodrigopimenta10/portfolio-website',
  /**
   * Whether the hosting described on "How this site runs" is live. While false, that page says
   * plainly that it is built and tested but not deployed. Flip it on the day it goes live.
   */
  hosting: { live: true, asOf: '2026-11-18' },
} as const;

// The tabs read as one story, in order: the calls, the scripts I wrote to answer them faster, the
// automation that made the calls stop, and what I build outside work.
export const nav = [
  { href: '/on-call', label: 'On call' },
  { href: '/tools', label: 'Tools' },
  { href: '/self-healing', label: 'Self-healing' },
  { href: '/projects', label: 'Side projects' },
] as const;
