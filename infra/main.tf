# Murmur lab infrastructure. Nothing here receives, stores or logs anything a person
# writes or records in the app. The eval runner sends synthetic test cases to Bedrock and
# keeps the model outputs; the optional static site serves the same public files that
# GitHub Pages serves.

data "aws_caller_identity" "current" {}

locals {
  name = "${var.project}-${var.environment}"

  tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = var.github_repository
      DataClass   = "test-cases-and-model-outputs-only"
    },
    var.tags,
  )
}

module "eval_runner" {
  source = "./modules/eval-runner"

  name                    = "${local.name}-eval"
  image_tag               = var.eval_image_tag
  command                 = var.eval_command
  output_dir              = var.eval_output_dir
  environment             = var.eval_environment
  bedrock_model_arns      = var.bedrock_model_arns
  schedule_expression     = var.eval_schedule_expression
  schedule_timezone       = var.eval_schedule_timezone
  schedule_enabled        = var.eval_schedule_enabled
  cpu                     = var.eval_cpu
  memory                  = var.eval_memory
  timeout_seconds         = var.eval_timeout_seconds
  log_retention_days      = var.log_retention_days
  results_expiration_days = var.results_expiration_days
  kms_key_arn             = var.kms_key_arn
  force_destroy           = var.force_destroy
}

module "static_site" {
  source = "./modules/static-site"
  count  = var.enable_static_site ? 1 : 0

  name                    = "${local.name}-site"
  aliases                 = var.site_aliases
  acm_certificate_arn     = var.site_acm_certificate_arn
  content_security_policy = var.site_content_security_policy
  force_destroy           = var.force_destroy
}

module "github_oidc" {
  source = "./modules/github-oidc"

  name                  = "${local.name}-github-actions"
  repository            = var.github_repository
  subjects              = var.github_oidc_subjects
  create_oidc_provider  = var.create_github_oidc_provider
  oidc_provider_arn     = var.existing_github_oidc_provider_arn
  ecr_repository_arn    = module.eval_runner.ecr_repository_arn
  site_bucket_arn       = one(module.static_site[*].bucket_arn)
  site_distribution_arn = one(module.static_site[*].distribution_arn)
  enable_site_deploy    = var.enable_static_site
}

# Cost alarm for the whole account. A personal account running one small scheduled job is
# easier to watch as a whole than through tag filters, which need cost allocation tags to be
# activated first.
resource "aws_budgets_budget" "monthly" {
  count = var.monthly_budget_usd > 0 ? 1 : 0

  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_emails
  }

  lifecycle {
    precondition {
      condition     = length(var.budget_emails) > 0
      error_message = "Set budget_emails, or set monthly_budget_usd to 0 to skip the budget."
    }
  }
}
