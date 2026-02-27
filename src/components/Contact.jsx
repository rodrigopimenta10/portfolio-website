import { useState } from 'react'
import './Contact.css'

const BASE = import.meta.env.BASE_URL
const EMAIL = 'RodrigoPimenta102@gmail.com'

export default function Contact() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: open mail client
      window.location.href = `mailto:${EMAIL}`
    }
  }

  return (
    <section id="contact" className="section contact">
      <div className="container">
        <p className="section-label" data-reveal>06. Contact</p>
        <h2 className="section-title" data-reveal style={{ '--reveal-delay': '80ms' }}>Get In Touch</h2>
        <div className="section-divider" data-reveal style={{ '--reveal-delay': '120ms' }} />

        <div className="contact__layout" data-reveal style={{ '--reveal-delay': '180ms' }}>
          <div className="contact__left">
            <p className="contact__intro">
              Whether it&apos;s about satellite systems, infrastructure automation,
              or something interesting you&apos;re working on — feel free to reach out.
            </p>
            <p className="contact__intro">
              Best way to reach me is email. I respond promptly.
            </p>

            <div className="contact__email-row">
              <a href={`mailto:${EMAIL}`} className="contact__email-btn">
                {EMAIL}
              </a>
              <button
                className={`contact__copy-btn${copied ? ' contact__copy-btn--copied' : ''}`}
                onClick={handleCopy}
                aria-label="Copy email address to clipboard"
                title={copied ? 'Copied!' : 'Copy email'}
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                  </svg>
                )}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <div className="contact__links">
              <a
                href="https://github.com/rodrigopimenta10"
                target="_blank"
                rel="noopener noreferrer"
                className="contact__link"
                aria-label="GitHub profile"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                <span>GitHub</span>
              </a>
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
                href={`${BASE}rodrigo_pimenta_resume.pdf`}
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
