import './Projects.css'

const projects = [
  {
    id: 'ceph',
    num: '01',
    title: 'Ceph Storage Self-Healing Suite',
    desc: 'Developed a monitoring and self-healing suite for Ceph storage nodes that stopped hours-long outages affecting 30K+ users per site. Built Grafana dashboards, webhook alerts to SL1, and latency/memory remediation logic.',
    tech: ['Python', 'Fabric', 'PostgreSQL', 'Grafana', 'SL1'],
    highlight: true,
    impact: '30K+ users protected',
  },
  {
    id: 'rf',
    num: '02',
    title: 'RF Gateway Self-Healing System',
    desc: 'Zero-touch Python self-healing system for satellite ground infrastructure. Detects RF gateway failovers across 20 sites and automatically resets 12 modems in under 60 seconds, eliminating ~1-hour outages per event.',
    tech: ['Python', 'Satellite Systems', 'Automation'],
    highlight: true,
    impact: '20 sites · <60s recovery',
  },
  {
    id: 'dashboards',
    num: '03',
    title: 'Grafana & Tableau Dashboards',
    desc: 'Production dashboards correlating satellite performance data from PostgreSQL and BigQuery, enabling data-driven anomaly detection and QA benchmarking across a massive subscriber base.',
    tech: ['Grafana', 'Tableau', 'PostgreSQL', 'BigQuery'],
    impact: '800K+ subscribers monitored',
  },
  {
    id: 'ovt',
    num: '04',
    title: 'OVT Root Cause Analysis',
    desc: 'BigQuery-based root cause analysis for satellite OVT failures. Correlated installer vs beam diagnostics to drive data-driven remediation and reduce forced sign-off incidents.',
    tech: ['BigQuery', 'SQL', 'Data Analysis'],
    impact: 'Reduced forced sign-off incidents',
  },
  {
    id: 'cicd',
    num: '05',
    title: 'CI/CD Pipelines & Runbooks',
    desc: 'Built Jenkins CI/CD pipelines and authored operational runbooks for automation deployment. Created a reusable framework now adopted by other engineering teams at Hughes.',
    tech: ['Jenkins', 'CI/CD', 'Runbooks', 'Git'],
    impact: 'Adopted org-wide',
  },
  {
    id: 'shu',
    num: '06',
    title: 'Brazil SHU Automation Tool',
    desc: 'Built a Super Heavy User automation tool from scratch and refactored it from a monolith to a modular pipeline with config-driven thresholds and full pytest coverage.',
    tech: ['Python', 'pandas', 'uv', 'pytest'],
    impact: 'Full test coverage',
  },
]

export default function Projects() {
  return (
    <section id="projects" className="section projects">
      <div className="container">
        <p className="section-label" data-reveal>03. Projects</p>
        <h2 className="section-title" data-reveal style={{ '--reveal-delay': '80ms' }}>Things I&apos;ve Built</h2>
        <div className="section-divider" data-reveal style={{ '--reveal-delay': '120ms' }} />

        <div className="proj__grid">
          {projects.map((p, i) => (
            <article
              key={p.id}
              data-reveal
              style={{ '--reveal-delay': `${i * 75}ms` }}
              className={`proj__card${p.highlight ? ' proj__card--featured' : ''}`}
            >
              <div className="proj__card-top">
                <span className="proj__num" aria-hidden="true">{p.num}</span>
                {p.highlight && (
                  <span className="proj__featured-badge">Featured</span>
                )}
              </div>

              <h3 className="proj__title">{p.title}</h3>
              <p className="proj__desc">{p.desc}</p>

              {p.impact && (
                <div className="proj__impact">
                  <span className="proj__impact-dot" aria-hidden="true" />
                  {p.impact}
                </div>
              )}

              <div className="proj__tech">
                {p.tech.map(t => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
