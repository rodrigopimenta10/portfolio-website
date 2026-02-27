import { useState, useEffect } from 'react'
import './Nav.css'

const BASE = import.meta.env.BASE_URL

const links = [
  { href: '#about',      label: 'About' },
  { href: '#events',     label: 'Events' },
  { href: '#experience', label: 'Experience' },
  { href: '#projects',   label: 'Projects' },
  { href: '#skills',     label: 'Skills' },
  { href: '#contact',    label: 'Contact' },
]

export default function Nav() {
  const [scrolled, setScrolled]         = useState(false)
  const [menuOpen, setMenuOpen]         = useState(false)
  const [activeSection, setActiveSection] = useState('')

  // Scrolled state for backdrop blur
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Active section via IntersectionObserver
  useEffect(() => {
    const sections = document.querySelectorAll('section[id]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { rootMargin: '-30% 0px -65% 0px' }
    )
    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const close = () => setMenuOpen(false)

  return (
    <header className={`nav${scrolled ? ' nav--scrolled' : ''}`} role="banner">
      <div className="nav__inner container">
        <a href="#hero" className="nav__logo" aria-label="Rodrigo Pimenta — Back to top">
          <span className="nav__logo-bracket">[</span>
          RP
          <span className="nav__logo-bracket">]</span>
        </a>

        {/* Desktop links */}
        <nav className="nav__links" aria-label="Primary navigation">
          {links.map(({ href, label }, i) => {
            const sectionId = href.slice(1)
            return (
              <a
                key={href}
                href={href}
                className={`nav__link${activeSection === sectionId ? ' nav__link--active' : ''}`}
              >
                <span className="nav__link-num">0{i + 1}.</span> {label}
              </a>
            )
          })}
          <a
            href="https://github.com/rodrigopimenta10"
            className="nav__icon-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub profile"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
          </a>
          <a
            href={`${BASE}rodrigo_pimenta_resume.pdf`}
            className="nav__resume"
            target="_blank"
            rel="noopener noreferrer"
          >
            Resume
          </a>
        </nav>

        {/* Mobile hamburger */}
        <button
          className={`nav__hamburger${menuOpen ? ' nav__hamburger--open' : ''}`}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <nav className="nav__drawer" aria-label="Mobile navigation">
          {links.map(({ href, label }, i) => (
            <a key={href} href={href} className="nav__drawer-link" onClick={close}>
              <span className="nav__link-num">0{i + 1}.</span> {label}
            </a>
          ))}
          <a
            href={`${BASE}rodrigo_pimenta_resume.pdf`}
            className="nav__resume nav__resume--mobile"
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
          >
            Resume ↗
          </a>
        </nav>
      )}
    </header>
  )
}
