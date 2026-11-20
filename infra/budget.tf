# A budget alert at $10 a month. The expected bill is about $0 to $2, so this fires long before a
# mistake becomes expensive. A budget only sends email; it does not stop anything.

resource "google_monitoring_notification_channel" "budget_email" {
  project      = var.project_id
  display_name = "Portfolio budget alert"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.this]
}

resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account_id
  display_name    = "portfolio: USD ${var.monthly_budget_usd} a month"

  budget_filter {
    projects = ["projects/${data.google_project.this.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }

  # Email at half, at 90% and at the full amount of real spend, and when the month is forecast to
  # end over it.
  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.9
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  all_updates_rule {
    monitoring_notification_channels = [google_monitoring_notification_channel.budget_email.id]
    # Billing account administrators are emailed as well.
    disable_default_iam_recipients = false
  }

  depends_on = [google_project_service.this]
}
