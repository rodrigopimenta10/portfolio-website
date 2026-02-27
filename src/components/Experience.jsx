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
      'Developed Ceph storage self-healing suite (Python/Fabric) that stopped hours-long outages affecting 30K+ users per site; integrated Grafana dashboards and webhook alerts to SL1.',
      'Built zero-touch RF Gateway self-healing system detecting failovers across 20 sites and automatically resetting 12 modems in under 60 seconds, eliminating ~1-hour outages per event.',
      'Built Grafana & Tableau dashboards correlating satellite performance data from PostgreSQL and BigQuery for 800K+ subscribers, enabling data-driven anomaly detection.',
      'Conducted BigQuery root cause analysis for OVT satellite failures, correlating installer vs beam diagnostics to drive data-driven remediation.',
      'Built CI/CD pipelines in Jenkins and authored operational runbooks adopted as a reusable framework across engineering teams.',
      'Built SHU automation tool (Python, pandas, uv); refactored from monolith to modular pipeline with config-driven thresholds and pytest coverage.',
      'Tier 3 on-call engineer for satellite ground systems spanning North America, Latin America, and Brazil.',
    ],
  },
  {
    id: 'navy',
    company: 'U.S. Navy Reserve',
    title: 'Mass Communication Specialist (Active Duty)',
    range: '2020 – 2021',
    location: 'Active Duty',
    bullets: [
      'Honorably discharged; operated in a 24/7, mission-critical communications environment directly analogous to satellite ground operations.',
      'Executed Tier 1 incident response for global communications systems — real-time decision-making, escalation procedures, and recovery under operational pressure.',
      'Developed the discipline and communication clarity that now informs how I handle on-call infrastructure incidents at scale.',
    ],
  },
  {
    id: 'bofa',
    company: 'Bank of America',
    title: 'Technology Analyst',
    range: '2018 – 2019',
    location: 'Charlotte, NC',
    bullets: [
      'Developed PowerShell and Python automation scripts that reduced manual operational overhead across banking infrastructure.',
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
