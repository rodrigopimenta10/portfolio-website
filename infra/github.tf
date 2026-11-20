# Keyless sign-in for GitHub Actions (Workload Identity Federation). GitHub gives each workflow
# run a short-lived token saying which repository and workflow it is; Google Cloud exchanges it
# for credentials of one of the two service accounts below. No key is created, stored or rotated.

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
  description               = "Workflow runs of ${var.github_repository}"

  depends_on = [google_project_service.this]
}

resource "google_iam_workload_identity_pool_provider" "portfolio_website" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "portfolio-website"
  display_name                       = "portfolio-website"
  description                        = "Tokens GitHub issues to workflow runs of ${var.github_repository}"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"         = "assertion.sub"
    "attribute.repository"   = "assertion.repository"
    "attribute.ref"          = "assertion.ref"
    "attribute.workflow_ref" = "assertion.workflow_ref"
  }

  # Tokens from any other repository are refused here, before any service account is considered.
  # The owner is checked by number as well as by name: a name can change hands, the number cannot.
  attribute_condition = "assertion.repository == '${var.github_repository}' && assertion.repository_owner_id == '${var.github_owner_id}'"
}

# --- Production deploys: only the deploy workflow, only on main.

resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = "portfolio-deploy"
  display_name = "Portfolio deploy (GitHub Actions, main)"
  description  = "Deploys the status service and the Hosting site. Usable only by deploy.yml on main."

  depends_on = [google_project_service.this]
}

resource "google_service_account_iam_member" "deploy_from_main" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.workflow_ref/${var.github_repository}/.github/workflows/deploy.yml@refs/heads/main"
}

# Push images, to this one repository.
resource "google_artifact_registry_repository_iam_member" "deploy_pushes_images" {
  project    = google_artifact_registry_repository.portfolio.project
  location   = google_artifact_registry_repository.portfolio.location
  repository = google_artifact_registry_repository.portfolio.name
  role       = "roles/artifactregistry.writer"
  member     = google_service_account.deploy.member
}

# Deploy revisions and move traffic, on this one service.
resource "google_cloud_run_v2_service_iam_member" "deploy_updates_service" {
  project  = google_cloud_run_v2_service.status.project
  location = google_cloud_run_v2_service.status.location
  name     = google_cloud_run_v2_service.status.name
  role     = "roles/run.developer"
  member   = google_service_account.deploy.member
}

# A new revision runs as the runtime account, so the deployer must be allowed to hand it that
# identity, and only that one.
resource "google_service_account_iam_member" "deploy_acts_as_runtime" {
  service_account_id = google_service_account.status.name
  role               = "roles/iam.serviceAccountUser"
  member             = google_service_account.deploy.member
}

# --- Pull request previews: any workflow run of the repository, Hosting only.

resource "google_service_account" "preview" {
  project      = var.project_id
  account_id   = "portfolio-preview"
  display_name = "Portfolio preview (GitHub Actions, pull requests)"
  description  = "Publishes preview channels on Firebase Hosting. Cannot touch Cloud Run or the registry."

  depends_on = [google_project_service.this]
}

resource "google_service_account_iam_member" "preview_from_repository" {
  service_account_id = google_service_account.preview.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# --- What publishing to Firebase Hosting needs, for both accounts.
#
# Firebase has no role narrower than "Hosting admin", and it covers the live channel as well as
# preview channels. That is why the preview account is usable only from this repository, where
# only its owner can push a branch.

locals {
  hosting_publisher_roles = [
    "roles/firebasehosting.admin",      # create releases and channels
    "roles/run.viewer",                 # resolve the /api/** rewrite to the Cloud Run service
    "roles/serviceusage.apiKeysViewer", # the Firebase CLI reads the project's web configuration
  ]

  hosting_publishers = {
    deploy  = google_service_account.deploy.member
    preview = google_service_account.preview.member
  }

  hosting_grants = {
    for pair in setproduct(keys(local.hosting_publishers), local.hosting_publisher_roles) :
    "${pair[0]}:${pair[1]}" => { who = pair[0], role = pair[1] }
  }
}

resource "google_project_iam_member" "hosting_publisher" {
  for_each = local.hosting_grants

  project = var.project_id
  role    = each.value.role
  member  = local.hosting_publishers[each.value.who]
}
