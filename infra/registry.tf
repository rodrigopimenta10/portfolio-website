# Where the deploy workflow pushes the status service's image. The first 0.5 GB is free; the
# cleanup rules keep it under that.
resource "google_artifact_registry_repository" "portfolio" {
  project       = var.project_id
  location      = var.region
  repository_id = "portfolio"
  description   = "Container images for the portfolio's status service"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-latest-five"
    action = "KEEP"

    most_recent_versions {
      keep_count = 5
    }
  }

  cleanup_policies {
    id     = "delete-the-rest-after-a-week"
    action = "DELETE"

    condition {
      older_than = "604800s" # seven days
    }
  }

  depends_on = [google_project_service.this]
}
