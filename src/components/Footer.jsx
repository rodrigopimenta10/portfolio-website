import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="container footer__inner">
        <p className="footer__text">
          Rodrigo Pimenta · Systems Engineer · Rockville, MD
        </p>
        <p className="footer__built">
          Built with Vite + React · Deployed on GitHub Pages
        </p>
      </div>
    </footer>
  )
}
