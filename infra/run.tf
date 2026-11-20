# The status service: one Cloud Run service that runs no instances when nobody is asking.

# Its own identity, with no roles at all. The service reads three public URLs and nothing in this
# project, so it is given nothing to misuse.
resource "google_service_account" "status" {
  project      = var.project_id
  account_id   = "portfolio-status"
  display_name = "Portfolio status service (runtime)"
  description  = "Identity the Cloud Run service portfolio-status runs as. Holds no roles."

  depends_on = [google_project_service.this]
}

resource "google_cloud_run_v2_service" "status" {
  project  = var.project_id
  name     = "portfolio-status"
  location = var.region

  # Reached through Firebase Hosting's /api/** rewrite, which calls the service's public address.
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.status.email

    # Scale to zero, and never past two: a portfolio does not need more, and a runaway caller
    # cannot run up a bill.
    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    max_instance_request_concurrency = 80
    timeout                          = "15s"

    containers {
      image = var.status_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
        # Billed only while a request is being handled.
        cpu_idle = true
        # A cold start is the one slow moment; give it more CPU for those seconds.
        startup_cpu_boost = true
      }

      # Cloud Run does not put the region in the environment; the service reports it in its
      # "This site" row.
      env {
        name  = "STATUS_REGION"
        value = var.region
      }

      # Ready when the port is open. The deploy workflow goes further: it asks each new revision
      # for /api/healthz and /api/status before sending it any visitors.
      startup_probe {
        tcp_socket {
          port = 8080
        }
        period_seconds    = 1
        timeout_seconds   = 1
        failure_threshold = 20
      }
    }
  }

  lifecycle {
    # The deploy workflow owns what is running: it pushes a new image on every merge, tags the new
    # revision "candidate", checks it, then moves traffic. Terraform owns the shape of the service.
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
      traffic,
    ]
  }

  depends_on = [google_project_service.this]
}

# Anyone may call it: it is a public, read-only status endpoint, and Firebase Hosting's rewrite
# reaches it without credentials.
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = google_cloud_run_v2_service.status.project
  location = google_cloud_run_v2_service.status.location
  name     = google_cloud_run_v2_service.status.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
