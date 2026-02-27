import { useState, useEffect } from 'react'
import './Nav.css'

const links = [
  { href: '#about', label: 'About' },
  { href: '#experience', label: 'Experience' },
  { href: '#projects', label: 'Projects' },
  { href: '#skills', label: 'Skills' },
  { href: '#contact', label: 'Contact' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = () => setMenuOpen(false)

  return (
    <header className={`nav${scrolled ? ' nav--scrolled' : ''}`} role="banner">
      <div className="nav__inner container">
        <a href="#hero" className="nav__logo" aria-label="Home">
          <span className="nav__logo-bracket">[</span>
          RP
          <span className="nav__logo-bracket">]</span>
        </a>

        {/* Desktop links */}
        <nav className="nav__links" aria-label="Primary navigation">
          {links.map(({ href, label }, i) => (
            <a key={href} href={href} className="nav__link">
              <span className="nav__link-num">0{i + 1}.</span> {label}
            </a>
          ))}
          <a
            href="/portfolio-website/rodrigo_pimenta_resume.pdf"
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
            href="/portfolio-website/rodrigo_pimenta_resume.pdf"
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
