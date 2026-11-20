terraform {
  required_version = ">= 1.17.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.12"
    }
    # Firebase resources (the Firebase project and the Hosting sites) exist only in google-beta.
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 8.12"
    }
  }

  # State in a Cloud Storage bucket. The bucket is created once by hand (README, "Bootstrap") and
  # named at init time, because its name contains the project ID:
  #   terraform init -backend-config="bucket=<project-id>-tfstate"
  backend "gcs" {
    prefix = "portfolio"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  # The Budgets API is called on behalf of this project, not the caller's default one.
  billing_project       = var.project_id
  user_project_override = true
}

provider "google-beta" {
  project = var.project_id
  region  = var.region

  billing_project       = var.project_id
  user_project_override = true
}
