import './Contact.css'

export default function Contact() {
  return (
    <section id="contact" className="section contact">
      <div className="container">
        <p className="section-label">05. Contact</p>
        <h2 className="section-title">Get In Touch</h2>
        <div className="section-divider" />

        <div className="contact__layout">
          <div className="contact__left">
            <p className="contact__intro">
              I&apos;m open to new opportunities — whether that&apos;s a full-time role,
              a contract engagement, or just a conversation about satellite systems,
              infrastructure automation, or something interesting you&apos;re building.
            </p>
            <p className="contact__intro">
              Best way to reach me is email. I respond promptly.
            </p>

            <a
              href="mailto:RodrigoPimenta102@gmail.com"
              className="contact__email-btn"
            >
              RodrigoPimenta102@gmail.com
            </a>

            <div className="contact__links">
              <a
                href="https://linkedin.com/in/rodrigoppimenta"
                target="_blank"
                rel="noopener noreferrer"
                className="contact__link"
                aria-label="LinkedIn profile"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                </svg>
                <span>LinkedIn</span>
              </a>
              <a
                href="tel:9802592752"
                className="contact__link"
                aria-label="Phone number"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
                <span>980-259-2752</span>
              </a>
            </div>
          </div>

          <div className="contact__right">
            <div className="contact__card">
              <div className="contact__card-label">Location</div>
              <div className="contact__card-value">Rockville, MD</div>
            </div>
            <div className="contact__card">
              <div className="contact__card-label">Current Role</div>
              <div className="contact__card-value">Systems Engineer III</div>
              <div className="contact__card-sub">Hughes Network Systems</div>
            </div>
            <div className="contact__card">
              <div className="contact__card-label">Resume</div>
              <a
                href="/portfolio-website/rodrigo_pimenta_resume.pdf"
                className="contact__resume-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download PDF ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
