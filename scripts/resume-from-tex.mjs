// Turns the resume's LaTeX source into src/data/resume.json, which the Resume and Experience
// pages render. The .tex lives in a separate repository and is the approved wording; this site
// never rewrites it. Run by hand when the resume changes:
//
//   npm run resume:import -- ../resume/rodrigo_pimenta_resume.tex
//
// The parser knows only the handful of macros that file uses (Jake Gutierrez's template plus
// \resumeOneLineHeading). Anything it does not recognise stops the import with an error, so a
// new macro cannot silently drop a line from the site.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Read one {...} group starting at `start` (which must be "{"). Returns its inside and the index after it. */
function readGroup(text, start) {
  if (text[start] !== '{') throw new Error(`expected "{" at ${start}: ${text.slice(start, start + 40)}`);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (text[i] === '{') depth++;
    if (text[i] === '}') {
      depth--;
      if (depth === 0) return { inside: text.slice(start + 1, i), end: i + 1 };
    }
  }
  throw new Error(`unclosed "{" at ${start}`);
}

/** Read `count` consecutive groups after a macro name, skipping whitespace between them. */
function readArgs(text, start, count) {
  const args = [];
  let at = start;
  for (let n = 0; n < count; n++) {
    while (/\s/.test(text[at] ?? '')) at++;
    const group = readGroup(text, at);
    args.push(group.inside);
    at = group.end;
  }
  return { args, end: at };
}

/** Replace \name{...} (one argument) using `replace(inside)`, innermost last. */
function replaceMacro(text, name, replace) {
  let out = '';
  let at = 0;
  const needle = `\\${name}{`;
  for (;;) {
    const found = text.indexOf(needle, at);
    if (found === -1) return out + text.slice(at);
    const group = readGroup(text, found + needle.length - 1);
    out += text.slice(at, found) + replace(group.inside);
    at = group.end;
  }
}

/** LaTeX inline markup to plain text. Links become their visible text. */
export function plain(tex) {
  let text = tex;
  // \href{url}{text} -> text
  for (;;) {
    const found = text.indexOf('\\href{');
    if (found === -1) break;
    const { args, end } = readArgs(text, found + 5, 2);
    text = text.slice(0, found) + args[1] + text.slice(end);
  }
  for (const name of ['underline', 'textbf', 'textit', 'emph', 'small']) {
    text = replaceMacro(text, name, (inside) => inside);
  }
  text = text
    .replace(/\$\\sim\$/g, '~')
    .replace(/\$\^\\circ\$/g, '°')
    .replace(/\$\\rightarrow\$/g, '→')
    .replace(/\$\|\$/g, '|')
    .replace(/\\vspace\{[^}]*\}/g, '')
    .replace(/\\(small|scshape|Huge|par)\b/g, '')
    .replace(/\\%/g, '%')
    .replace(/\\&/g, '&')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\\\/g, ' ')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/~/g, (match, offset, whole) => (/\d/.test(whole[offset + 1] ?? '') ? '~' : ' '))
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/\\[a-zA-Z]+/.test(text)) throw new Error(`unhandled LaTeX in: ${text}`);
  return text;
}

/** The first \href in `tex` as { href, text }, or null. */
function firstLink(tex) {
  const found = tex.indexOf('\\href{');
  if (found === -1) return null;
  const { args } = readArgs(tex, found + 5, 2);
  return { href: args[0], text: plain(args[1]) };
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Split a section body into entries: each heading macro with the \resumeItem lines that follow it. */
function entries(body) {
  const headings = { resumeSubheading: 4, resumeOneLineHeading: 3, resumeProjectHeading: 2 };
  const pattern = /\\(resumeSubheading|resumeOneLineHeading|resumeProjectHeading|resumeItem)(?=\s*\{)/g;
  const found = [];
  let match;
  while ((match = pattern.exec(body))) {
    const name = match[1];
    const { args, end } = readArgs(body, match.index + match[0].length, name === 'resumeItem' ? 1 : headings[name]);
    pattern.lastIndex = end;
    if (name === 'resumeItem') {
      if (!found.length) throw new Error('a \\resumeItem appears before any heading');
      found[found.length - 1].items.push(plain(args[0]));
    } else {
      found.push({ macro: name, args, items: [] });
    }
  }
  return found;
}

function parseExperience(body) {
  return entries(body).map((entry) => {
    if (entry.macro === 'resumeSubheading') {
      const [role, dates, org, location] = entry.args.map(plain);
      return { id: slug(org), role, org, location, dates, bullets: entry.items };
    }
    // One-line entries: "Role, Org (place): what it was" with the dates on the right.
    let role;
    let detail;
    let dates;
    if (entry.macro === 'resumeOneLineHeading') {
      [role, detail, dates] = entry.args.map(plain);
    } else {
      const line = plain(entry.args[0]);
      const comma = line.indexOf(',');
      role = line.slice(0, comma).trim();
      detail = line.slice(comma + 1).trim();
      dates = plain(entry.args[1]);
    }
    const colon = detail.indexOf(':');
    const orgAndPlace = colon === -1 ? detail : detail.slice(0, colon);
    const place = /\(([^)]+)\)/.exec(orgAndPlace);
    const org = orgAndPlace.replace(/\([^)]*\)/, '').trim();
    return {
      id: slug(org),
      role,
      org,
      location: place ? place[1][0].toUpperCase() + place[1].slice(1) : '',
      dates,
      bullets: entry.items,
      ...(colon === -1 ? {} : { summary: detail.slice(colon + 1).trim() }),
    };
  });
}

function parseSystems(body) {
  return entries(body).map((entry) => {
    const heading = entry.args[0];
    const link = firstLink(heading);
    const parts = heading.split('$|$').map((part) => part.trim());
    const name = plain(parts[0]);
    const rest = parts.slice(1).filter((part) => !part.includes('\\href{'));
    // The first remaining part is the stack (in \emph); a second, if any, is a one-line description.
    const stack = rest[0] ? plain(rest[0]) : '';
    const note = rest[1] ? plain(rest[1]) : undefined;
    return {
      id: slug(name),
      name,
      stack: stack.split(',').map((item) => item.trim()).filter(Boolean),
      ...(link ? { link } : {}),
      ...(note ? { note } : {}),
      bullets: entry.items,
    };
  });
}

function parseEducation(body) {
  return entries(body).map((entry) => {
    // A one-row entry: the school, then "what it was (where): details", then the dates.
    if (entry.macro === 'resumeOneLineHeading') {
      const [school, detail, dates] = entry.args.map(plain);
      const place = /\(([^)]+)\)/.exec(detail);
      return {
        school,
        location: place ? place[1][0].toUpperCase() + place[1].slice(1) : '',
        degree: detail.replace(/\s*\([^)]*\)/, ''),
        dates,
      };
    }
    const [school, location, degree, dates] = entry.args.map(plain);
    return { school, location, degree, dates };
  });
}

function parseSkills(body) {
  const skills = [];
  const pattern = /\\textbf\{([^}]+)\}\{:\s*/g;
  let match;
  while ((match = pattern.exec(body))) {
    // The items run from after "{: " to the group's closing brace.
    const group = readGroup(body, match.index + match[0].length - (match[0].length - match[0].indexOf('{:')));
    skills.push({ label: plain(match[1]), items: plain(group.inside.replace(/^:\s*/, '')) });
  }
  return skills;
}

function parseHeading(tex) {
  const start = tex.indexOf('\\begin{center}');
  const end = tex.indexOf('\\end{center}');
  if (start === -1 || end === -1) throw new Error('no heading block');
  const block = tex.slice(start, end);
  const name = plain(/\\textbf\{\\Huge \\scshape ([^}]+)\}/.exec(block)?.[1] ?? '');
  const links = [];
  let at = 0;
  for (;;) {
    const found = block.indexOf('\\href{', at);
    if (found === -1) break;
    const { args, end: after } = readArgs(block, found + 5, 2);
    links.push({ href: args[0], text: plain(args[1]) });
    at = after;
  }
  const phone = /\\small\s+([0-9][0-9\-() +.]+[0-9])/.exec(block)?.[1];
  const pieces = plain(block.slice(block.indexOf('\\small'))).split('|').map((piece) => piece.trim());
  const location = pieces[pieces.length - 1];
  const find = (test) => links.find((link) => test(link.href));
  const email = find((href) => href.startsWith('mailto:'));
  return {
    name,
    phone,
    email: email?.text,
    linkedin: find((href) => href.includes('linkedin.com'))?.href,
    github: find((href) => href.includes('github.com'))?.href,
    site: find((href) => !href.startsWith('mailto:') && !/linkedin|github/.test(href))?.href,
    location,
  };
}

/** The whole resume as data. Throws if a section is missing or empty. */
export function parseResumeTex(source) {
  // Drop comments (an unescaped % to end of line).
  const tex = source.replace(/(^|[^\\])%.*$/gm, '$1');
  const body = tex.slice(tex.indexOf('\\begin{document}'));
  const sections = {};
  const pattern = /\\section\{([^}]+)\}/g;
  const marks = [];
  let match;
  while ((match = pattern.exec(body))) marks.push({ name: match[1], start: match.index + match[0].length });
  marks.forEach((mark, index) => {
    sections[mark.name] = body.slice(mark.start, marks[index + 1] ? body.lastIndexOf('\\section', marks[index + 1].start) : undefined);
  });
  for (const name of ['Summary', 'Experience', 'Systems Built', 'Education', 'Technical Skills']) {
    if (!sections[name]) throw new Error(`the resume has no "${name}" section`);
  }
  const resume = {
    contact: parseHeading(body),
    summary: plain(sections.Summary),
    experience: parseExperience(sections.Experience),
    systems: parseSystems(sections['Systems Built']),
    education: parseEducation(sections.Education),
    skills: parseSkills(sections['Technical Skills']),
  };
  for (const [key, value] of Object.entries(resume)) {
    if (Array.isArray(value) && value.length === 0) throw new Error(`the resume's ${key} came out empty`);
  }
  return resume;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input) {
    console.error('usage: npm run resume:import -- path/to/rodrigo_pimenta_resume.tex');
    process.exit(2);
  }
  const resume = parseResumeTex(await readFile(input, 'utf8'));
  const output = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'resume.json');
  await writeFile(output, `${JSON.stringify({ source: path.basename(input), ...resume }, null, 2)}\n`);
  console.log(
    `wrote ${path.relative(process.cwd(), output)}: ${resume.experience.length} roles, ${resume.systems.length} systems, ` +
      `${resume.skills.length} skill lines`,
  );
}
