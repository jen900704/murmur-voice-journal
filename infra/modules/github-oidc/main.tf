# A role GitHub Actions assumes with a short-lived OIDC token. There are no access keys to
# store or rotate. The trust policy names this repository and the listed refs only.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0, < 7.0"
    }
  }
}

locals {
  provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : var.oidc_provider_arn
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "trust" {
  statement {
    sid     = "GitHubActionsThisRepositoryOnly"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [for s in var.subjects : "repo:${var.repository}:${s}"]
    }
  }
}

resource "aws_iam_role" "this" {
  name                 = var.name
  description          = "GitHub Actions (${var.repository}) through OIDC: push the eval image, and deploy the static site if enabled."
  assume_role_policy   = data.aws_iam_policy_document.trust.json
  max_session_duration = 3600

  lifecycle {
    precondition {
      condition     = var.create_oidc_provider || var.oidc_provider_arn != null
      error_message = "Give oidc_provider_arn when create_oidc_provider is false."
    }
  }
}

data "aws_iam_policy_document" "ecr_push" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"] # this action does not support resource-level permissions
  }

  statement {
    sid = "PushEvalImage"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [var.ecr_repository_arn]
  }
}

resource "aws_iam_role_policy" "ecr_push" {
  name   = "push-eval-image"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.ecr_push.json
}

data "aws_iam_policy_document" "site_deploy" {
  count = var.enable_site_deploy ? 1 : 0

  statement {
    sid       = "ListSiteBucket"
    actions   = ["s3:ListBucket"]
    resources = [var.site_bucket_arn]
  }

  statement {
    sid       = "SyncSiteFiles"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${var.site_bucket_arn}/*"]
  }

  statement {
    sid       = "InvalidateSite"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [var.site_distribution_arn]
  }
}

resource "aws_iam_role_policy" "site_deploy" {
  count = var.enable_site_deploy ? 1 : 0

  name   = "deploy-static-site"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.site_deploy[0].json
}
