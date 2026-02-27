import './Skills.css'

const skillGroups = [
  {
    category: 'Programming',
    icon: '{ }',
    skills: ['Python', 'JavaScript', 'Bash', 'PowerShell', 'SQL', 'Java', 'C'],
  },
  {
    category: 'Web',
    icon: '⟨/⟩',
    skills: ['React', 'Vite', 'HTML', 'CSS'],
  },
  {
    category: 'Automation & CI/CD',
    icon: '⟳',
    skills: ['Jenkins', 'Git', 'CI/CD Pipelines', 'Automated Runbooks', 'uv', 'pytest'],
  },
  {
    category: 'Monitoring & Data',
    icon: '▦',
    skills: ['Grafana', 'Tableau', 'PostgreSQL', 'BigQuery', 'Pandas', 'Jupyter', 'SL1 / ScienceLogic'],
  },
  {
    category: 'Infrastructure & Ops',
    icon: '◈',
    skills: ['Linux / RHEL', 'VMware', 'Docker', 'Ansible', 'Satellite Ground Systems', 'On-Call Incident Response', 'Delinea / Thycotic'],
  },
]

export default function Skills() {
  return (
    <section id="skills" className="section skills">
      <div className="container">
        <p className="section-label" data-reveal>05. Skills</p>
        <h2 className="section-title" data-reveal style={{ '--reveal-delay': '80ms' }}>Tech Stack</h2>
        <div className="section-divider" data-reveal style={{ '--reveal-delay': '120ms' }} />

        <div className="skills__grid">
          {skillGroups.map((group, i) => (
            <div
              key={group.category}
              className="skills__group"
              data-reveal
              style={{ '--reveal-delay': `${160 + i * 70}ms` }}
            >
              <div className="skills__group-header">
                <span className="skills__icon" aria-hidden="true">{group.icon}</span>
                <h3 className="skills__category">{group.category}</h3>
              </div>
              <ul className="skills__list">
                {group.skills.map(skill => (
                  <li key={skill} className="skills__item">
                    <span className="skills__dot" aria-hidden="true" />
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Education strip */}
        <div className="skills__edu" data-reveal style={{ '--reveal-delay': '200ms' }}>
          <div className="skills__edu-label">Education</div>
          <div className="skills__edu-body">
            <p className="skills__edu-school">University of Maryland — A. James Clark School of Engineering</p>
            <p className="skills__edu-degree">B.S. Computer Engineering · College Park Scholars · 2014 – 2018</p>
          </div>
        </div>
      </div>
    </section>
  )
}
