import { useState } from 'react'
import './Experience.css'

const jobs = [
  {
    id: 'hughes',
    company: 'Hughes Network Systems',
    title: 'Systems Engineer III',
    range: 'Nov 2021 – Present',
    location: 'Rockville, MD',
    bullets: [
      'Sole author of a Ceph storage self-healing monitor (6,586 lines, 77 of 79 commits) covering 24 nodes across 8 clusters on a 3-minute cycle. Metadata-server failover is gated on a standby-capacity assessment — it never promotes a node that can\'t carry the load — and outcomes are verified against the cluster log to distinguish a real failover from a same-node reclaim.',
      'Sole author of a config-integrity self-healing tool (3,594 lines) that detects configuration drift and corruption across a gateway fleet over SFTP and restarts the affected service; modernized a blocking-I/O workload onto asyncio with semaphore-bounded fan-out instead of process pools.',
      'Root-caused a platform-wide defect silently discarding log records; the logging redesign took one service from 19.68 GB to 58 MB and reclaimed ~25 GB in production, with audit tooling that swept all 146 scheduled jobs for the same pattern.',
      'Traced a 738 MB core dump with gdb to an unguarded deserialization path in a vendor component, and a 177-process leak to a library deadlock at interpreter teardown — delivered as actionable defect reports.',
      'Built Grafana dashboards (19 panels backed by 7 PostgreSQL tables) and BigQuery analyses for data-driven anomaly detection across the network.',
      'Built CI/CD pipelines in Jenkins with pytest gates, and authored operational runbooks adopted as a reusable framework across engineering teams.',
      'Tier 3 on-call engineer for distributed ground systems spanning North America and Latin America.',
    ],
  },
  {
    id: 'navy',
    company: 'U.S. Navy Reserve',
    title: 'Mass Communication Specialist, E-3 (Active Duty)',
    range: '2020 – 2021',
    location: 'Great Lakes, IL / Fort Meade, MD',
    bullets: [
      'Completed basic training and the Defense Information School (DINFOS) at Fort Meade, MD; honorably discharged.',
    ],
  },
  {
    id: 'bofa',
    company: 'Bank of America',
    title: 'Technology Analyst',
    range: '2018 – 2019',
    location: 'Charlotte, NC',
    bullets: [
      'Developed PowerShell and Python automation scripts that reduced manual operational overhead in ATM banking infrastructure.',
      'Implemented CI/CD pipelines and ATM validation workflows, improving deployment reliability.',
      'Collaborated with cross-functional teams to maintain and improve enterprise-scale systems.',
    ],
  },
  {
    id: 'pismo',
    company: 'Pismo',
    title: 'Software Engineering Intern',
    range: '2018',
    location: 'Remote',
    bullets: [
      'Implemented canary deployment strategy for a cloud-native fintech platform.',
      'Pismo was later acquired by Visa for $1B — the platform\'s architecture held up under that scrutiny.',
      'Gained hands-on experience with microservices, modern deployment patterns, and production-grade reliability requirements.',
    ],
  },
  {
    id: 'paradyme',
    company: 'Paradyme Management',
    title: 'Software Development Intern',
    range: '2016 – 2018',
    location: 'Greenbelt, MD',
    bullets: [
      'Built CRM features and a resume parsing application using Python.',
      'Contributed to internal tooling that improved operational workflows.',
      'Developed foundational software engineering skills in an agile team environment.',
    ],
  },
]

export default function Experience() {
  const [active, setActive] = useState(0)

  return (
    <section id="experience" className="section experience">
      <div className="container">
        <p className="section-label" data-reveal>03. Experience</p>
        <h2 className="section-title" data-reveal style={{ '--reveal-delay': '80ms' }}>Where I&apos;ve Worked</h2>
        <div className="section-divider" data-reveal style={{ '--reveal-delay': '120ms' }} />

        <div className="exp__layout" data-reveal style={{ '--reveal-delay': '180ms' }}>
          {/* Tab list */}
          <div className="exp__tabs" role="tablist" aria-label="Companies">
            {jobs.map((j, i) => (
              <button
                key={j.id}
                role="tab"
                aria-selected={i === active}
                aria-controls={`panel-${j.id}`}
                id={`tab-${j.id}`}
                className={`exp__tab${i === active ? ' exp__tab--active' : ''}`}
                onClick={() => setActive(i)}
              >
                {j.company}
              </button>
            ))}
          </div>

          {/* Panels — render all, show only active (screen reader friendly) */}
          {jobs.map((job, i) => (
            <div
              key={job.id}
              className={`exp__panel${i === active ? ' exp__panel--active' : ''}`}
              role="tabpanel"
              id={`panel-${job.id}`}
              aria-labelledby={`tab-${job.id}`}
              hidden={i !== active}
            >
              <div className="exp__panel-header">
                <h3 className="exp__role">
                  {job.title}{' '}
                  <span className="exp__company">@ {job.company}</span>
                </h3>
                <p className="exp__meta">
                  <span className="exp__range">{job.range}</span>
                  <span className="exp__sep">·</span>
                  <span className="exp__location">{job.location}</span>
                </p>
              </div>
              <ul className="exp__bullets">
                {job.bullets.map((b, idx) => (
                  <li key={idx} className="exp__bullet">
                    <span className="exp__bullet-icon" aria-hidden="true">▸</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
