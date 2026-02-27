import './About.css'

const BASE = import.meta.env.BASE_URL

export default function About() {
  return (
    <section id="about" className="section about">
      <div className="container">
        <p className="section-label" data-reveal>01. About</p>
        <h2 className="section-title" data-reveal style={{ '--reveal-delay': '80ms' }}>Who I Am</h2>
        <div className="section-divider" data-reveal style={{ '--reveal-delay': '120ms' }} />

        <div className="about__grid" data-reveal style={{ '--reveal-delay': '160ms' }}>
          <div className="about__text">
            <p>
              I&apos;m a Systems Engineer specializing in self-healing infrastructure
              and operational automation for one of the world&apos;s largest satellite
              internet providers. At <strong>Hughes Network Systems</strong>, I built
              systems that stopped hours-long outages affecting 30K+ users per site —
              and the dashboards that catch problems before they cascade.
            </p>
            <p>
              Before Hughes, I was a <strong>Mass Communication Specialist in
              the U.S. Navy</strong> — operating in a 24/7, mission-critical
              environment that directly mirrors satellite ground ops. Prior to that
              I built software at Bank of America, contributed to a fintech startup
              (later acquired by Visa for $1B), and started my career in automation
              at Paradyme Management.
            </p>
            <p>
              I hold a <strong>B.S. in Computer Engineering</strong> from the
              University of Maryland (Clark School), where I was a College Park
              Scholar.
            </p>

            <div className="about__facts">
              <div className="about__fact">
                <span className="about__fact-num">4+</span>
                <span className="about__fact-label">Years in satellite systems</span>
              </div>
              <div className="about__fact">
                <span className="about__fact-num">800K+</span>
                <span className="about__fact-label">Subscribers on monitored infrastructure</span>
              </div>
              <div className="about__fact">
                <span className="about__fact-num">30K+</span>
                <span className="about__fact-label">Users protected per self-healing site</span>
              </div>
              <div className="about__fact">
                <span className="about__fact-num">20</span>
                <span className="about__fact-label">Sites covered by RF automation</span>
              </div>
            </div>

            <div className="about__langs">
              <span className="about__lang-title">Languages:</span>
              <span className="tag">English (Fluent)</span>
              <span className="tag">Portuguese (Fluent)</span>
              <span className="tag">Spanish (Proficient)</span>
            </div>
          </div>

          <div className="about__photo-col">
            <div className="about__photo-wrap">
              <img
                src={`${BASE}images/about-1.jpg`}
                alt="Rodrigo Pimenta, Systems Engineer at Hughes Network Systems"
                className="about__photo"
                loading="lazy"
              />
              <div className="about__photo-border" aria-hidden="true" />
            </div>
            <div className="about__links">
              <a
                href="https://linkedin.com/in/rodrigoppimenta"
                target="_blank"
                rel="noopener noreferrer"
                className="about__link"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                </svg>
                LinkedIn
              </a>
              <a
                href="mailto:RodrigoPimenta102@gmail.com"
                className="about__link"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                Email
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
