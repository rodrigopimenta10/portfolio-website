# Runs the whole configuration against mocked providers and checks the properties that keep this
# cheap and locked down. "apply" here is an apply to the mocks: no credentials, no network, and
# nothing is created anywhere. (Some values, such as the pool's full name, are known only after an
# apply, which is why these are not plan-only runs.)
#
#   terraform init -backend=false && terraform test

mock_provider "google" {
  mock_data "google_project" {
    defaults = {
      number = "805279368733"
    }
  }

  # The mocks invent random strings for computed values; these few are checked for their shape by
  # other resources, so they are given realistic ones.
  mock_resource "google_service_account" {
    defaults = {
      name   = "projects/portfolio-prod-0p1ht/serviceAccounts/mock@portfolio-prod-0p1ht.iam.gserviceaccount.com"
      email  = "mock@portfolio-prod-0p1ht.iam.gserviceaccount.com"
      member = "serviceAccount:mock@portfolio-prod-0p1ht.iam.gserviceaccount.com"
    }
  }

  mock_resource "google_iam_workload_identity_pool" {
    defaults = {
      name = "projects/805279368733/locations/global/workloadIdentityPools/github"
    }
  }
}

mock_provider "google-beta" {}

variables {
  billing_account_id = "000000-AAAAAA-000000"
  alert_email        = "alerts@example.com"
}

run "the_status_service_scales_to_zero_and_never_past_two" {
  command = apply

  assert {
    condition     = google_cloud_run_v2_service.status.template[0].scaling[0].min_instance_count == 0
    error_message = "The status service must scale to zero: no warm instances."
  }

  assert {
    condition     = google_cloud_run_v2_service.status.template[0].scaling[0].max_instance_count == 2
    error_message = "The status service must stop at two instances."
  }

  assert {
    condition     = google_cloud_run_v2_service.status.template[0].containers[0].resources[0].cpu_idle
    error_message = "CPU must be billed only while a request is handled."
  }

  assert {
    condition     = google_cloud_run_v2_service.status.name == "portfolio-status" && google_cloud_run_v2_service.status.location == "us-east4"
    error_message = "firebase.json in the site repository rewrites /api/** to portfolio-status in us-east4."
  }
}

run "only_one_repository_can_sign_in" {
  command = apply

  assert {
    condition     = google_iam_workload_identity_pool_provider.portfolio_website.attribute_condition == "assertion.repository == 'rodrigopimenta10/portfolio-website' && assertion.repository_owner_id == '11894505'"
    error_message = "The provider must refuse tokens from any other repository."
  }

  assert {
    condition     = endswith(google_service_account_iam_member.deploy_from_main.member, "/attribute.workflow_ref/rodrigopimenta10/portfolio-website/.github/workflows/deploy.yml@refs/heads/main")
    error_message = "The deploy account must be usable only by deploy.yml on main."
  }

  assert {
    condition     = endswith(google_service_account_iam_member.preview_from_repository.member, "/attribute.repository/rodrigopimenta10/portfolio-website")
    error_message = "The preview account must be usable only from the site repository."
  }
}

run "least_privilege" {
  command = apply

  assert {
    condition = toset(keys(google_project_iam_member.hosting_publisher)) == toset([
      "deploy:roles/firebasehosting.admin",
      "deploy:roles/run.viewer",
      "deploy:roles/serviceusage.apiKeysViewer",
      "preview:roles/firebasehosting.admin",
      "preview:roles/run.viewer",
      "preview:roles/serviceusage.apiKeysViewer",
    ])
    error_message = "Project-level roles changed. The runtime account must hold none, and nobody gets owner or editor."
  }

  assert {
    condition     = google_cloud_run_v2_service_iam_member.deploy_updates_service.role == "roles/run.developer"
    error_message = "The deploy account gets run.developer on the one service, not run.admin on the project."
  }
}

run "the_budget_alert_is_ten_dollars_on_this_project" {
  command = apply

  assert {
    condition     = google_billing_budget.monthly.amount[0].specified_amount[0].units == "10"
    error_message = "The budget alert must be at 10 US dollars a month."
  }

  assert {
    condition     = google_billing_budget.monthly.budget_filter[0].projects == toset(["projects/805279368733"])
    error_message = "The budget must watch this project only."
  }
}

run "the_registry_cleans_up_after_itself" {
  command = apply

  assert {
    condition     = length(google_artifact_registry_repository.portfolio.cleanup_policies) == 2
    error_message = "The registry must keep the latest images and delete the rest, to stay in the free 0.5 GB."
  }
}
