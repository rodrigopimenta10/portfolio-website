// Facts about the site itself, in one place. Contact details come from the resume (resume.json).
import resume from './resume.json';

export const site = {
  name: resume.contact.name,
  url: 'https://rodrigopimenta.com',
  // One sentence: who he is and what he builds. The clauses are the resume summary's and
  // Orbital Watch's thesis, joined.
  sentence:
    "I'm Rodrigo Pimenta, a backend and platform engineer who builds systems that keep themselves running and report their own degradation.",
  description:
    'Rodrigo Pimenta is a backend and platform engineer (six-plus years, Python) who builds systems that keep themselves running and report their own degradation. Open to backend and platform engineering roles in New York.',
  seeking: 'Open to backend and platform engineering roles in New York.',
  email: resume.contact.email,
  linkedin: resume.contact.linkedin,
  github: resume.contact.github,
  resumePdf: '/rodrigo_pimenta_resume.pdf',
  repo: 'https://github.com/rodrigopimenta10/portfolio-website',
  /**
   * Whether the hosting described on "How this site runs" is live. While false, that page and the
   * footer say plainly that it is built and tested but not deployed. Flip it on the day it goes live.
   */
  hosting: { live: false, asOf: '2026-11-18' },
} as const;

export const nav = [
  { href: '/projects', label: 'Projects' },
  { href: '/experience', label: 'Experience' },
  { href: '/how-this-site-runs', label: 'How it runs', title: 'How this site runs' },
  { href: '/resume', label: 'Resume' },
] as const;
