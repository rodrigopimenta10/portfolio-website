# Infrastructure (Terraform)

Terraform for the Google Cloud side of rodrigopimenta.com: Firebase Hosting, one Cloud Run
service that scales to zero, a container registry, keyless sign-in for GitHub Actions, and a
budget alert.

**Status: applied on 18 November 2026; rodrigopimenta.com has run on it since.** `terraform fmt`,
`terraform validate` and `terraform test` (against mocked providers) run on every pull request
that touches this folder (`.github/workflows/infra.yml`). The project is `portfolio-prod-0p1ht`
(display name portfolio-prod). Until 20 November 2026 this code was kept in a separate,
unpublished repository; it was moved here unchanged.

The site and its deploy workflow are in the rest of this repository. Run every command below
from this folder (`infra/`).

## What it creates

35 resources. Expected cost of all of it together: about $0 to $2 a month.

| Resource | What it is | Cost |
|---|---|---|
| `google_project_service.this` (11) | Turns on the APIs used here: Artifact Registry, Billing Budgets, Resource Manager, Firebase, Firebase Hosting, IAM, IAM Credentials, Monitoring, Cloud Run, Service Usage, STS | Free |
| `google_firebase_project.this` | Adds Firebase to the project, which Hosting needs | Free |
| `google_firebase_hosting_site.portfolio` | The Hosting site for the portfolio (`rodrigopimenta-portfolio`) | Free up to 10 GB stored and 360 MB transferred a day, then $0.026 per GB stored and $0.15 per GB transferred |
| `google_firebase_hosting_site.orbital_watch` | A second site, reserved for Orbital Watch, unused for now | Free while empty |
| `google_artifact_registry_repository.portfolio` | Docker repository for the status service's image, with cleanup rules: keep the latest five, delete anything else after a week | First 0.5 GB free, then about $0.10 per GB a month |
| `google_service_account.status` | The identity the service runs as. It holds no roles | Free |
| `google_cloud_run_v2_service.status` | `portfolio-status` in `us-east4`: 1 vCPU, 256 MiB, zero to two instances, CPU billed only during requests | $0 when idle. The free tier (2 million requests, 180,000 vCPU-seconds, 360,000 GiB-seconds a month) is shared by the whole billing account; past it, $0.000024 per vCPU-second |
| `google_cloud_run_v2_service_iam_member.public` | Lets anyone call the service (it is a public read-only endpoint, reached through Hosting's rewrite) | Free |
| `google_iam_workload_identity_pool.github` | The pool GitHub's tokens are exchanged in | Free |
| `google_iam_workload_identity_pool_provider.portfolio_website` | Accepts tokens only from `rodrigopimenta10/portfolio-website`, checked by owner ID as well as name | Free |
| `google_service_account.deploy` | Production deploys. Usable only by `deploy.yml` on `main` | Free |
| `google_service_account_iam_member.deploy_from_main` | That restriction | Free |
| `google_artifact_registry_repository_iam_member.deploy_pushes_images` | Deploy may push images to the one repository | Free |
| `google_cloud_run_v2_service_iam_member.deploy_updates_service` | Deploy may update the one service (`run.developer`) | Free |
| `google_service_account_iam_member.deploy_acts_as_runtime` | Deploy may give new revisions the runtime identity, and only that one | Free |
| `google_service_account.preview` | Pull-request previews. Hosting only | Free |
| `google_service_account_iam_member.preview_from_repository` | Usable from any workflow run of the repository | Free |
| `google_project_iam_member.hosting_publisher` (6) | For deploy and preview each: Hosting admin, Cloud Run viewer (to resolve the `/api/**` rewrite), API keys viewer (the Firebase CLI reads the project's web configuration) | Free |
| `google_monitoring_notification_channel.budget_email` | The email address the alert goes to | Free |
| `google_billing_budget.monthly` | Emails at 50%, 90% and 100% of $10 of real spend in a month, and when the month is forecast to pass $10. It only sends email; it stops nothing | Free |

Not created by Terraform: the state bucket (bootstrap, below; a few kilobytes, a fraction of a
cent a month) and the custom domain (a manual step at go-live, because it involves DNS at
Cloudflare).

Prices were read from Google's pricing pages on 18 November 2026.

### Left out on purpose

- **No load balancer.** It is billed by the hour whether or not anyone visits. Firebase Hosting
  already provides the CDN, the certificate and the `/api/**` rewrite.
- **No `min_instance_count` above 0.** A warm instance is billed around the clock. A cold start
  takes a few seconds and the site's panel says so while it waits.
- **No secrets and no Secret Manager.** The service reads public URLs only.
- **No service account keys.** GitHub Actions signs in through Workload Identity Federation.

`tests/invariants.tftest.hcl` checks these properties: scale to zero, at most two instances, one
repository allowed to sign in, the exact list of project-level roles, the $10 budget.

## Variables

| Variable | Default | Notes |
|---|---|---|
| `project_id` | `portfolio-prod-0p1ht` | Exists already. Terraform does not create the project |
| `region` | `us-east4` | Must match `firebase.json` at the repository root |
| `billing_account_id` | none | **Never write it to a file.** Pass as `TF_VAR_billing_account_id` |
| `alert_email` | none | **Never write it to a file.** Pass as `TF_VAR_alert_email` |
| `monthly_budget_usd` | `10` | |
| `github_repository` | `rodrigopimenta10/portfolio-website` | |
| `github_owner_id` | `11894505` | The account's numeric ID (`gh api users/rodrigopimenta10 --jq .id`) |
| `hosting_site_id` | `rodrigopimenta-portfolio` | Site IDs are global. If it is taken, pick another and put the same value in `.firebaserc` at the repository root |
| `orbital_watch_site_id` | `rodrigopimenta-orbital-watch` | |
| `status_image` | Google's sample "hello" image | Only for the first apply; the deploy workflow replaces it |

`.gitignore` refuses `*.tfvars`, so the two values without a default cannot be committed by
accident. They do end up in the Terraform state, which is why the state lives in a private
bucket and not on disk.

## Check it without touching Google Cloud

```sh
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
terraform test          # applies to mocked providers: no credentials, no network, nothing created
```

## Bootstrap and first apply

This was run once, on 18 November 2026. It needs your own Google account with Owner on the project and
permission to create budgets on the billing account (Billing Account Administrator, or Billing
Account Costs Manager).

```sh
PROJECT=portfolio-prod-0p1ht

# 1. Sign in as yourself. Terraform uses these credentials; no key file is created.
gcloud auth application-default login
gcloud auth application-default set-quota-project "$PROJECT"

# 2. Two APIs must be on before Terraform can turn on the rest.
gcloud services enable serviceusage.googleapis.com cloudresourcemanager.googleapis.com --project "$PROJECT"

# 3. The state bucket: private, versioned, in the same region.
gcloud storage buckets create "gs://$PROJECT-tfstate" --project "$PROJECT" --location us-east4 \
  --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update "gs://$PROJECT-tfstate" --versioning

# 4. The two values that are never written down. `read -s` keeps them out of shell history.
read -rs "TF_VAR_billing_account_id?Billing account ID: " && export TF_VAR_billing_account_id
read -rs "TF_VAR_alert_email?Alert email: " && export TF_VAR_alert_email

# 5. Plan, read the plan, apply exactly that plan.
terraform init -backend-config="bucket=$PROJECT-tfstate"
terraform plan -out plan.out      # expect: 35 to add, 0 to change, 0 to destroy
terraform apply plan.out
rm plan.out                       # a saved plan holds the sensitive values
```

(`read -rs "VAR?prompt"` is zsh. In bash: `read -rsp "Billing account ID: " TF_VAR_billing_account_id`.)

Things to watch on a first apply (written before it was run, kept for a rebuild from nothing):

- The budget needs the caller to have budget permissions on the **billing account**, which is
  separate from being Owner of the project.
- The email notification channel is created unverified if Google asks for verification; check the
  inbox.
- Hosting site IDs are global. If `rodrigopimenta-portfolio` is taken the apply says so; set
  `hosting_site_id`.
- The roles given to the two GitHub service accounts are three of the six the Firebase CLI's own
  GitHub setup grants (`firebase-tools`, `src/init/features/hosting/github.ts`): Hosting admin,
  Cloud Run viewer and API keys viewer. The three left out are for Firebase Auth preview domains
  (`roles/firebaseauth.admin`, `roles/serviceusage.serviceUsageConsumer`) and Cloud Functions
  (`roles/cloudfunctions.developer`), none of which this site uses. If the first deploy reports a
  missing permission, `serviceUsageConsumer` is the likeliest; add it in `github.tf`.

## After the apply

```sh
terraform output repository_variables
```

Set each of the five as an Actions variable on this repository, for example
`gh variable set GCP_PROJECT_ID --repo rodrigopimenta10/portfolio-website --body portfolio-prod-0p1ht`.
The deploy workflow does nothing until `GCP_PROJECT_ID` exists. The README at the repository root
has the rest of the go-live steps (Cloudflare Pages, the first deploy, the custom domain and DNS).

## Taking it down

`google_cloud_run_v2_service` has deletion protection on by default. To destroy, first set
`deletion_protection = false` on it and apply, then `terraform destroy`. The APIs stay enabled and
the state bucket stays; delete the bucket by hand if the project is being retired.
