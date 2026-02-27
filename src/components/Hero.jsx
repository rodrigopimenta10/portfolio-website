import './Hero.css'

export default function Hero() {
  return (
    <section id="hero" className="hero" aria-label="Introduction">
      {/* Decorative grid background */}
      <div className="hero__grid" aria-hidden="true" />

      <div className="hero__inner container">
        <div className="hero__content">
          <p className="hero__greeting">Hi, I&apos;m</p>
          <h1 className="hero__name">Rodrigo Pimenta.</h1>
          <h2 className="hero__tagline">
            I keep satellite networks running<br />
            <span className="hero__tagline-accent">at scale, automatically.</span>
          </h2>
          <p className="hero__desc">
            Systems Engineer III at Hughes Network Systems — 4+ years building
            self-healing infrastructure, automation pipelines, and dashboards for
            satellite ground systems serving 800K+ subscribers.
          </p>

          <div className="hero__cta">
            <a href="#projects" className="hero__btn hero__btn--primary">
              View My Work
            </a>
            <a href="#contact" className="hero__btn hero__btn--secondary">
              Get In Touch
            </a>
          </div>

          <div className="hero__badges">
            <span className="tag">Python</span>
            <span className="tag">Satellite Systems</span>
            <span className="tag">Automation</span>
            <span className="tag">Grafana</span>
            <span className="tag">Jenkins</span>
          </div>
        </div>

        <div className="hero__visual" aria-hidden="true">
          <div className="hero__headshot-wrap">
            <img
              src="/portfolio-website/images/headshot.png"
              alt="Rodrigo Pimenta"
              className="hero__headshot"
              loading="eager"
            />
            <div className="hero__headshot-ring" />
          </div>
          <div className="hero__orbit">
            <div className="hero__orbit-dot hero__orbit-dot--1" />
            <div className="hero__orbit-dot hero__orbit-dot--2" />
            <div className="hero__orbit-dot hero__orbit-dot--3" />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <a href="#about" className="hero__scroll" aria-label="Scroll to About section">
        <div className="hero__scroll-line" />
        <span className="hero__scroll-label">scroll</span>
      </a>
    </section>
  )
}
