# The values the site repository's deploy workflow needs, as GitHub repository variables. None of
# them is a secret: each is a name, and a name is useless without a token GitHub issues only to
# that repository's workflow runs.

output "repository_variables" {
  description = "Set these as Actions variables on the site repository (gh variable set NAME --body VALUE)."
  value = {
    GCP_PROJECT_ID                 = var.project_id
    GCP_WORKLOAD_IDENTITY_PROVIDER = google_iam_workload_identity_pool_provider.portfolio_website.name
    GCP_DEPLOY_SERVICE_ACCOUNT     = google_service_account.deploy.email
    GCP_PREVIEW_SERVICE_ACCOUNT    = google_service_account.preview.email
    FIREBASE_HOSTING_SITE          = google_firebase_hosting_site.portfolio.site_id
  }
}

output "hosting_default_url" {
  description = "Where the portfolio is served until the custom domain is connected."
  value       = google_firebase_hosting_site.portfolio.default_url
}

output "status_service_url" {
  description = "The Cloud Run service's own address. Visitors reach it as /api/** on the Hosting site."
  value       = google_cloud_run_v2_service.status.uri
}

output "image_repository" {
  description = "Where the deploy workflow pushes the status service's image."
  value       = "${google_artifact_registry_repository.portfolio.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.portfolio.repository_id}"
}
