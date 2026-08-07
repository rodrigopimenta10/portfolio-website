import './Projects.css'

const liveProjects = [
  {
    id: 'orbital-watch',
    num: '01',
    title: 'Orbital Watch',
    desc: 'A satellite situational-awareness site built on one thesis: the page reports its own data freshness rather than assuming it. Every upstream source is isolated and degrades independently — live fetch, then cache, then committed snapshot — and each is classified fresh, stale, or failed on the page with its reasoning shown. A build cannot fail, and it cannot silently publish stale data as current.',
    tech: ['Python', 'Cloudflare Workers', 'CI/CD', 'pytest'],
    impact: '150 tests · offline-deterministic builds · cron rebuilds with a dead-man check',
    live: 'https://orbital.rodrigopimenta.com',
    source: 'https://github.com/rodrigopimenta10/orbital-watch',
  },
  {
    id: 'this-site',
    num: '02',
    title: 'This Site',
    desc: 'The site you\'re reading — Vite + React with vanilla CSS, no UI framework, no router. One build is served from two hosts (Cloudflare Pages on the apex domain, GitHub Pages on a subpath) with a configurable asset base and deploy verification that asserts content-type, not just status codes.',
    tech: ['React', 'Vite', 'CSS', 'GitHub Actions'],
    impact: 'Dual-host deploy from a single build',
    live: 'https://rodrigopimenta.com',
    source: 'https://github.com/rodrigopimenta10/portfolio-website',
  },
]

const workProjects = [
  {
    id: 'ceph',
    num: '03',
    title: 'Ceph Self-Healing Monitor',
    desc: 'Sole author — 6,586 lines, 77 of 79 commits. Watches 24 nodes across 8 clusters on a 3-minute cycle. Automated metadata-server failover is gated on a standby-capacity assessment, so it never promotes a node that can\'t carry the load; every outcome is verified against the cluster log to distinguish a real failover from a same-node reclaim.',
    tech: ['Python', 'Ceph', 'PostgreSQL', 'Grafana', 'pytest'],
    impact: '7 PostgreSQL tables · 19-panel Grafana dashboard · pytest in CI',
  },
  {
    id: 'config-selfheal',
    num: '04',
    title: 'Config Integrity Self-Heal',
    desc: 'Sole author — 3,594 lines. Detects configuration drift and corruption across a gateway fleet over SFTP and restarts the affected service. Modernized a blocking-I/O workload onto asyncio with semaphore-bounded fan-out rather than process pools.',
    tech: ['Python', 'asyncio', 'SFTP', 'pytest'],
    impact: 'Fleet-wide drift detection and automated recovery',
  },
  {
    id: 'logging',
    num: '05',
    title: 'Platform-Wide Logging Redesign',
    desc: 'Root-caused a defect that was silently discarding log records, then redesigned the logging: 19.68 GB down to 58 MB for one service, ~25 GB reclaimed in production. Built audit tooling that swept all 146 scheduled jobs for the same pattern.',
    tech: ['Python', 'Linux', 'Log Management'],
    impact: '19.68 GB → 58 MB · 146 jobs audited',
  },
  {
    id: 'rca',
    num: '06',
    title: 'Production Root Cause Analysis',
    desc: 'A 738 MB core dump traced with gdb to an unguarded deserialization path in a vendor component; a 177-process leak traced to a library deadlock at interpreter teardown. Both delivered as actionable defect reports.',
    tech: ['gdb', 'Python', 'Linux Internals'],
    impact: 'Vendor defects pinpointed from raw core dumps',
  },
]

function ProjectCard({ p, i, live }) {
  return (
    <article
      data-reveal
      style={{ '--reveal-delay': `${i * 75}ms` }}
      className={`proj__card${live ? ' proj__card--live' : ''}`}
    >
      <div className="proj__card-top">
        <span className="proj__num" aria-hidden="true">{p.num}</span>
        {live && <span className="proj__live-badge">● Live</span>}
      </div>

      <h3 className="proj__title">{p.title}</h3>
      <p className="proj__desc">{p.desc}</p>

      {p.impact && (
        <div className="proj__impact">
          <span className="proj__impact-dot" aria-hidden="true" />
          {p.impact}
        </div>
      )}

      {live && (
        <div className="proj__links">
          <a
            href={p.live}
            target="_blank"
            rel="noopener noreferrer"
            className="proj__link proj__link--primary"
          >
            Visit site ↗
          </a>
          <a
            href={p.source}
            target="_blank"
            rel="noopener noreferrer"
            className="proj__link"
          >
            Source ↗
          </a>
        </div>
      )}

      <div className="proj__tech">
        {p.tech.map(t => (
          <span key={t} className="tag">{t}</span>
        ))}
      </div>
    </article>
  )
}

export default function Projects() {
  return (
    <section id="projects" className="section projects">
      <div className="container">
        <p className="section-label" data-reveal>03. Projects</p>
        <h2 className="section-title" data-reveal style={{ '--reveal-delay': '80ms' }}>Things I&apos;ve Built</h2>
        <div className="section-divider" data-reveal style={{ '--reveal-delay': '120ms' }} />

        <h3 className="proj__group-title" data-reveal>
          Live projects <span className="proj__group-hint">— click through and check for yourself</span>
        </h3>
        <div className="proj__grid proj__grid--live">
          {liveProjects.map((p, i) => (
            <ProjectCard key={p.id} p={p} i={i} live />
          ))}
        </div>

        <h3 className="proj__group-title" data-reveal>
          Systems built at work <span className="proj__group-hint">— production infrastructure at Hughes</span>
        </h3>
        <div className="proj__grid">
          {workProjects.map((p, i) => (
            <ProjectCard key={p.id} p={p} i={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
