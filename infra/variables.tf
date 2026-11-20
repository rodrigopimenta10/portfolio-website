variable "project_id" {
  description = "The Google Cloud project everything here lives in. It exists already (display name portfolio-prod) with billing linked; Terraform does not create it."
  type        = string
  default     = "portfolio-prod-0p1ht"
}

variable "region" {
  description = "Region of the Cloud Run service and the container registry. firebase.json in the site repository names the same one."
  type        = string
  default     = "us-east4"
}

variable "billing_account_id" {
  description = "Billing account the budget alert watches, as XXXXXX-XXXXXX-XXXXXX. No default on purpose: pass it as TF_VAR_billing_account_id and never write it to a file."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$", var.billing_account_id))
    error_message = "A billing account ID looks like 0X0X0X-0X0X0X-0X0X0X."
  }
}

variable "alert_email" {
  description = "Where the budget alert is sent. No default on purpose: pass it as TF_VAR_alert_email and never write it to a file."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.alert_email))
    error_message = "alert_email must be an email address."
  }
}

variable "monthly_budget_usd" {
  description = "The monthly amount the budget alert is set at, in whole US dollars."
  type        = number
  default     = 10
}

variable "github_repository" {
  description = "The one GitHub repository allowed to sign in to this project, as owner/name."
  type        = string
  default     = "rodrigopimenta10/portfolio-website"
}

variable "github_owner_id" {
  description = "Numeric ID of the GitHub account that owns the repository (gh api users/<login> --jq .id). Names can be given up and taken by someone else; this number cannot."
  type        = string
  default     = "11894505"
}

variable "hosting_site_id" {
  description = "Firebase Hosting site for the portfolio. Site IDs are global: the site is served at <id>.web.app until the custom domain is connected."
  type        = string
  default     = "rodrigopimenta-portfolio"
}

variable "orbital_watch_site_id" {
  description = "The Firebase Hosting site that serves Orbital Watch. The orbital-watch repository deploys to it."
  type        = string
  default     = "rodrigopimenta-orbital-watch"
}

variable "status_image" {
  description = "Image the Cloud Run service is created with. The deploy workflow replaces it on every merge, and Terraform ignores that change, so this matters only on the first apply."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello:latest"
}
