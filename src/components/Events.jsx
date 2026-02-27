import './Events.css'

const BASE = import.meta.env.BASE_URL

export default function Events() {
  return (
    <section id="events" className="section events">
      <div className="container">
        <p className="section-label" data-reveal>02. Events</p>
        <h2 className="section-title" data-reveal style={{ '--reveal-delay': '80ms' }}>Out in the World</h2>
        <div className="section-divider" data-reveal style={{ '--reveal-delay': '120ms' }} />

        <article className="events__card" data-reveal style={{ '--reveal-delay': '180ms' }}>
          <div className="events__photo-wrap">
            <img
              src={`${BASE}images/ansible-fest-2025.jpeg`}
              alt="Rodrigo Pimenta at Ansible Fest Boston 2025, Fenway Park suite"
              className="events__photo"
              loading="lazy"
            />
          </div>
          <div className="events__body">
            <div className="events__header">
              <span className="events__type">Conference</span>
              <span className="events__year">2025</span>
            </div>
            <h3 className="events__title">Ansible Fest Boston 2025</h3>
            <p className="events__desc">
              Red Hat event at Fenway Park — automation, infrastructure, and community.
            </p>
            <div className="events__meta">
              <span className="events__location">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                Boston, MA
              </span>
            </div>
            <div className="events__tags">
              <span className="tag">Ansible</span>
              <span className="tag">Red Hat</span>
              <span className="tag">Automation</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
