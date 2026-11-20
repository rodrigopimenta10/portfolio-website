# Firebase Hosting: the CDN in front of the site. Free up to 10 GB stored and 360 MB a day.

resource "google_firebase_project" "this" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.this]
}

# The portfolio. firebase.json in the site repository sends /api/** from here to the Cloud Run
# service below; everything else is static files.
resource "google_firebase_hosting_site" "portfolio" {
  provider = google-beta
  project  = google_firebase_project.this.project
  site_id  = var.hosting_site_id
}

# Reserved for Orbital Watch, which is on Cloudflare Pages today. Nothing is deployed here yet.
resource "google_firebase_hosting_site" "orbital_watch" {
  provider = google-beta
  project  = google_firebase_project.this.project
  site_id  = var.orbital_watch_site_id
}
