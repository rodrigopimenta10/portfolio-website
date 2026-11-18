// The part of Firebase Hosting's glob syntax that firebase.json here uses: `**`, `*` and `@(a|b)`.
// Shared by the local server and the test that checks every built page is covered by a header rule.

/** Does `pathname` (starting with "/") match the Firebase Hosting glob `source`? */
export function matches(source, pathname) {
  let pattern = '';
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '*' && source[i + 1] === '*') {
      // "/**" also matches the directory itself, as in Firebase ("/projects/**" covers "/projects/x").
      pattern += '.*';
      i++;
    } else if (char === '*') {
      pattern += '[^/]*';
    } else if (char === '@' && source[i + 1] === '(') {
      const end = source.indexOf(')', i);
      const options = source.slice(i + 2, end).split('|');
      pattern += `(?:${options.map((option) => option.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
      i = end;
    } else {
      pattern += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  // A source without a leading slash matches anywhere in the path, as "**" patterns do.
  return new RegExp(`^${source.startsWith('/') ? '' : '/?'}${pattern}$`).test(pathname);
}
