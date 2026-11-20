# The APIs this configuration uses. They stay enabled if this is destroyed: turning an API off can
# break things that were not created here.
locals {
  services = [
    "artifactregistry.googleapis.com",     # the container registry
    "billingbudgets.googleapis.com",       # the budget alert
    "cloudresourcemanager.googleapis.com", # reading the project, IAM on it
    "firebase.googleapis.com",             # adding Firebase to the project
    "firebasehosting.googleapis.com",      # the Hosting sites
    "iam.googleapis.com",                  # service accounts, the workload identity pool
    "iamcredentials.googleapis.com",       # short-lived credentials for GitHub Actions
    "monitoring.googleapis.com",           # the email channel the budget alert uses
    "run.googleapis.com",                  # the status service
    "serviceusage.googleapis.com",         # enabling the others
    "sts.googleapis.com",                  # exchanging GitHub's token for a Google one
  ]
}

resource "google_project_service" "this" {
  for_each = toset(local.services)

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

data "google_project" "this" {
  project_id = var.project_id
}
