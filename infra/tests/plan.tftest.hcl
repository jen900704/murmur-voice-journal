# Plan-level checks that need no AWS account: the provider is mocked, nothing is created.
# Run with `terraform test` (Terraform 1.7 or later) from infra/.

mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }

  mock_data "aws_partition" {
    defaults = {
      partition = "aws"
    }
  }

  mock_data "aws_region" {
    defaults = {
      region = "us-east-1"
    }
  }

  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::123456789012:role/mock"
    }
  }

  mock_resource "aws_iam_openid_connect_provider" {
    defaults = {
      arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    }
  }

  mock_resource "aws_ecs_cluster" {
    defaults = {
      arn = "arn:aws:ecs:us-east-1:123456789012:cluster/mock"
    }
  }

  mock_resource "aws_ecs_task_definition" {
    defaults = {
      arn                  = "arn:aws:ecs:us-east-1:123456789012:task-definition/mock:1"
      arn_without_revision = "arn:aws:ecs:us-east-1:123456789012:task-definition/mock"
    }
  }

  mock_resource "aws_ecr_repository" {
    defaults = {
      arn = "arn:aws:ecr:us-east-1:123456789012:repository/mock"
    }
  }

  mock_resource "aws_s3_bucket" {
    defaults = {
      arn = "arn:aws:s3:::mock-bucket"
    }
  }

  mock_resource "aws_cloudwatch_log_group" {
    defaults = {
      arn = "arn:aws:logs:us-east-1:123456789012:log-group:/ecs/mock"
    }
  }

  mock_resource "aws_cloudfront_distribution" {
    defaults = {
      arn = "arn:aws:cloudfront::123456789012:distribution/MOCK"
    }
  }

  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

variables {
  bedrock_model_arns = [
    "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
  ]
  budget_emails = ["nobody@example.com"]
}

run "eval_task_role_is_least_privilege" {
  command = plan

  module {
    source = "./modules/eval-runner"
  }

  variables {
    name                = "murmur-lab-eval"
    image_tag           = "v1"
    command             = ["python3", "lab/eval/run_eval.py", "--counselor-provider", "bedrock", "--judge-provider", "bedrock", "--cases", "lab/eval/cases/cases.json"]
    output_dir          = "lab/eval/runs"
    schedule_expression = "cron(0 9 ? * MON *)"
  }

  assert {
    condition     = length(data.aws_iam_policy_document.task.statement) == 2
    error_message = "The task role should have exactly two statements: Bedrock and results."
  }

  assert {
    condition     = toset(data.aws_iam_policy_document.task.statement[0].actions) == toset(["bedrock:InvokeModel"])
    error_message = "The only Bedrock action allowed is bedrock:InvokeModel."
  }

  assert {
    condition     = toset(data.aws_iam_policy_document.task.statement[0].resources) == toset(var.bedrock_model_arns)
    error_message = "Bedrock access must be limited to the named model ARNs."
  }

  assert {
    condition     = alltrue([for a in data.aws_iam_policy_document.task.statement[1].actions : startswith(a, "s3:Put") || a == "s3:AbortMultipartUpload"])
    error_message = "The task may only write results; it must not read, list or delete."
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.results.block_public_acls && aws_s3_bucket_public_access_block.results.block_public_policy && aws_s3_bucket_public_access_block.results.ignore_public_acls && aws_s3_bucket_public_access_block.results.restrict_public_buckets
    error_message = "All four public access blocks must be on for the results bucket."
  }

  assert {
    condition     = aws_s3_bucket_versioning.results.versioning_configuration[0].status == "Enabled"
    error_message = "Results bucket versioning must be on."
  }

  assert {
    condition     = one(aws_s3_bucket_server_side_encryption_configuration.results.rule).apply_server_side_encryption_by_default[0].sse_algorithm == "AES256"
    error_message = "Results bucket must be encrypted by default."
  }

  assert {
    condition     = aws_cloudwatch_log_group.this.retention_in_days == 30
    error_message = "Logs must have a retention period."
  }

  assert {
    condition     = aws_scheduler_schedule.this.state == "DISABLED"
    error_message = "The schedule must start disabled."
  }

  assert {
    condition     = aws_ecr_repository.this.image_tag_mutability == "IMMUTABLE"
    error_message = "Image tags must be immutable."
  }
}

run "wildcard_model_arn_is_rejected" {
  command = plan

  variables {
    bedrock_model_arns = ["arn:aws:bedrock:us-east-1::foundation-model/*"]
  }

  expect_failures = [var.bedrock_model_arns]
}

run "github_role_is_scoped_to_this_repository" {
  command = plan

  module {
    source = "./modules/github-oidc"
  }

  variables {
    name               = "murmur-lab-github-actions"
    repository         = "jen900704/murmur-voice-journal"
    subjects           = ["ref:refs/heads/main"]
    ecr_repository_arn = "arn:aws:ecr:us-east-1:123456789012:repository/murmur-lab-eval"
  }

  assert {
    condition     = toset(one([for c in data.aws_iam_policy_document.trust.statement[0].condition : c.values if endswith(c.variable, ":sub")])) == toset(["repo:jen900704/murmur-voice-journal:ref:refs/heads/main"])
    error_message = "The trust policy must name this repository and the main branch only."
  }

  assert {
    condition     = toset(one([for c in data.aws_iam_policy_document.trust.statement[0].condition : c.values if endswith(c.variable, ":aud")])) == toset(["sts.amazonaws.com"])
    error_message = "The trust policy must require the STS audience."
  }

  assert {
    condition     = toset(data.aws_iam_policy_document.trust.statement[0].actions) == toset(["sts:AssumeRoleWithWebIdentity"])
    error_message = "The role is assumed with a web identity token only."
  }
}

run "bare_wildcard_subject_is_rejected" {
  command = plan

  module {
    source = "./modules/github-oidc"
  }

  variables {
    name               = "murmur-lab-github-actions"
    repository         = "jen900704/murmur-voice-journal"
    subjects           = ["*"]
    ecr_repository_arn = "arn:aws:ecr:us-east-1:123456789012:repository/murmur-lab-eval"
  }

  expect_failures = [var.subjects]
}

run "static_site_is_private_and_logs_nothing" {
  command = plan

  module {
    source = "./modules/static-site"
  }

  variables {
    name = "murmur-lab-site"
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.site.block_public_acls && aws_s3_bucket_public_access_block.site.block_public_policy && aws_s3_bucket_public_access_block.site.ignore_public_acls && aws_s3_bucket_public_access_block.site.restrict_public_buckets
    error_message = "The site bucket must not be public."
  }

  assert {
    condition     = length(aws_cloudfront_distribution.site.logging_config) == 0
    error_message = "CloudFront access logging must stay off: its logs include query strings."
  }

  assert {
    condition     = aws_cloudfront_cache_policy.site.parameters_in_cache_key_and_forwarded_to_origin[0].query_strings_config[0].query_string_behavior == "none"
    error_message = "Query strings must not be forwarded or cached."
  }

  assert {
    condition     = aws_cloudfront_distribution.site.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "The site must be HTTPS only."
  }

  assert {
    condition     = strcontains(aws_cloudfront_response_headers_policy.site.security_headers_config[0].content_security_policy[0].content_security_policy, "default-src 'self'") && strcontains(aws_cloudfront_response_headers_policy.site.security_headers_config[0].content_security_policy[0].content_security_policy, "frame-ancestors 'none'")
    error_message = "The CSP header must be set."
  }
}

run "root_plans_with_defaults" {
  command = plan

  assert {
    condition     = length(module.static_site) == 0
    error_message = "The static site is off by default."
  }

  assert {
    condition     = aws_budgets_budget.monthly[0].limit_amount == "10"
    error_message = "A monthly budget is created by default."
  }
}

run "root_plans_with_static_site" {
  command = plan

  variables {
    enable_static_site = true
  }

  assert {
    condition     = length(module.static_site) == 1
    error_message = "The static site is created when enabled."
  }
}
