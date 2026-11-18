import { describe, expect, it } from 'vitest';
import { parseResumeTex, plain } from '../../scripts/resume-from-tex.mjs';

const TEX = String.raw`
% a comment with 100% nonsense \section{Not A Section}
\begin{document}
\begin{center}
    \textbf{\Huge \scshape Ada Example} \\ \vspace{1pt}
    \small 555-010-0199 $|$ \href{mailto:ada@example.com}{\underline{ada@example.com}} $|$
    \href{https://linkedin.com/in/ada}{\underline{linkedin.com/in/ada}} $|$
    \href{https://github.com/ada}{\underline{github.com/ada}} $|$
    \href{https://example.com}{\underline{example.com}} $|$
    New York, NY
\end{center}
\section{Summary}
{\small Engineer with a 99.9\% SLA.\par}
\section{Experience}
  \resumeSubHeadingListStart
    \resumeSubheading
      {Engineer II}{Jan 2020 -- Present}
      {Example Corp}{Remote}
      \resumeItemListStart
        \resumeItem{Cut logs from 19.68 GB to 58 MB, reclaiming $\sim$25 GB}
        \resumeItem{Matched within 0.0071$^\circ$ on R\&D data}
      \resumeItemListEnd
    \resumeOneLineHeading
      {Fellow}{Somewhere (remote): algorithms, interviewing}{2019 -- 2020}
  \resumeSubHeadingListEnd
\section{Systems Built}
  \resumeSubHeadingListStart
    \resumeProjectHeading
      {\textbf{Widget} $|$ \emph{Python, Go} $|$ \href{https://widget.example.com}{\underline{widget.example.com}}}{}
      \resumeItemListStart
        \resumeItem{Sole author. Does a thing}
      \resumeItemListEnd
    \resumeProjectHeading
      {\textbf{Gadget} $|$ \emph{Python} $|$ a one-line description $|$ \href{https://gadget.example.com}{\underline{gadget.example.com}}}{}
  \resumeSubHeadingListEnd
\section{Education}
  \resumeSubHeadingListStart
    \resumeSubheading
      {A University}{Somewhere, MD}
      {B.S. in Things $|$ Scholars}{Aug 2014 -- Dec 2018}
  \resumeSubHeadingListEnd
\section{Technical Skills}
 \begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{
     \textbf{Languages}{: Python (uv, ruff), SQL} \\
     \textbf{CI/CD \& Testing}{: Terraform, pytest}
    }}
 \end{itemize}
\end{document}
`;

describe('parseResumeTex', () => {
  const resume = parseResumeTex(TEX);

  it('reads the heading', () => {
    expect(resume.contact).toEqual({
      name: 'Ada Example',
      phone: '555-010-0199',
      email: 'ada@example.com',
      linkedin: 'https://linkedin.com/in/ada',
      github: 'https://github.com/ada',
      site: 'https://example.com',
      location: 'New York, NY',
    });
  });

  it('reads the summary and unescapes LaTeX', () => {
    expect(resume.summary).toBe('Engineer with a 99.9% SLA.');
  });

  it('reads roles with their bullets, and one-line roles', () => {
    expect(resume.experience).toEqual([
      {
        id: 'example-corp',
        role: 'Engineer II',
        org: 'Example Corp',
        location: 'Remote',
        dates: 'Jan 2020 – Present',
        bullets: ['Cut logs from 19.68 GB to 58 MB, reclaiming ~25 GB', 'Matched within 0.0071° on R&D data'],
      },
      { id: 'somewhere', role: 'Fellow', org: 'Somewhere', location: 'Remote', dates: '2019 – 2020', bullets: [], summary: 'algorithms, interviewing' },
    ]);
  });

  it('reads systems with stack, link and one-line note', () => {
    expect(resume.systems).toEqual([
      {
        id: 'widget',
        name: 'Widget',
        stack: ['Python', 'Go'],
        link: { href: 'https://widget.example.com', text: 'widget.example.com' },
        bullets: ['Sole author. Does a thing'],
      },
      {
        id: 'gadget',
        name: 'Gadget',
        stack: ['Python'],
        link: { href: 'https://gadget.example.com', text: 'gadget.example.com' },
        note: 'a one-line description',
        bullets: [],
      },
    ]);
  });

  it('reads education and skills', () => {
    expect(resume.education).toEqual([{ school: 'A University', location: 'Somewhere, MD', degree: 'B.S. in Things | Scholars', dates: 'Aug 2014 – Dec 2018' }]);
    expect(resume.skills).toEqual([
      { label: 'Languages', items: 'Python (uv, ruff), SQL' },
      { label: 'CI/CD & Testing', items: 'Terraform, pytest' },
    ]);
  });

  it('stops on a macro it does not know rather than dropping text', () => {
    expect(() => plain(String.raw`\mystery{thing}`)).toThrow(/unhandled LaTeX/);
  });

  it('stops when a section is missing', () => {
    expect(() => parseResumeTex(TEX.replace(String.raw`\section{Education}`, ''))).toThrow(/no "Education" section/);
  });
});
