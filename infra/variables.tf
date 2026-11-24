variable "aws_region" {
  description = "Region for everything except CloudFront, which is global. Pick one where the Bedrock models you name are available."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Short name used as a prefix for resource names."
  type        = string
  default     = "murmur"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.project))
    error_message = "Use 2 to 21 lowercase letters, digits or hyphens, starting with a letter."
  }
}

variable "environment" {
  description = "Environment name, used in names and tags."
  type        = string
  default     = "lab"
}

variable "tags" {
  description = "Extra tags for every resource."
  type        = map(string)
  default     = {}
}

variable "github_repository" {
  description = "GitHub repository allowed to assume the CI role, as owner/name."
  type        = string
  default     = "jen900704/murmur-voice-journal"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Use the form owner/name, with no wildcards."
  }
}

variable "github_oidc_subjects" {
  description = "Which workflows of the repository may assume the role, as the part of the OIDC subject after repo:owner/name:. The default is pushes to main only."
  type        = list(string)
  default     = ["ref:refs/heads/main"]
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub OIDC provider. An account can have only one, so set this to false and give existing_github_oidc_provider_arn if it already exists."
  type        = bool
  default     = true
}

variable "existing_github_oidc_provider_arn" {
  description = "ARN of an existing GitHub OIDC provider, used when create_github_oidc_provider is false."
  type        = string
  default     = null
}

variable "force_destroy" {
  description = "Let terraform destroy delete buckets and the image repository even when they are not empty. Set to true only right before tearing down."
  type        = bool
  default     = false
}

# ---------- eval runner ----------

variable "bedrock_model_arns" {
  description = "Exact ARNs the eval task may invoke: foundation models and, if you call through one, the inference profile plus the foundation model in each region it routes to. No wildcards for the model name."
  type        = list(string)

  validation {
    condition     = length(var.bedrock_model_arns) > 0 && alltrue([for a in var.bedrock_model_arns : can(regex("^arn:aws[a-z-]*:bedrock:[a-z0-9-]+:[0-9]*:(foundation-model|inference-profile|application-inference-profile)/[A-Za-z0-9._:-]+$", a))])
    error_message = "Give at least one full Bedrock model or inference profile ARN. Wildcards in the model name are not accepted."
  }
}

variable "eval_image_tag" {
  description = "Tag of the image in ECR that the task runs. Tags are immutable, so push a new tag and change this to roll forward."
  type        = string
  default     = "v1"
}

variable "eval_command" {
  description = "Command the container runs. The entrypoint uploads the output folder to S3 afterwards."
  type        = list(string)
  default     = ["python3", "-m", "lab.eval.run", "--provider", "bedrock", "--cases", "lab/eval/cases"]
}

variable "eval_output_dir" {
  description = "Folder inside the container that the harness writes results to."
  type        = string
  default     = "lab/eval/runs"
}

variable "eval_environment" {
  description = "Extra plain environment variables for the eval container. Do not put secrets here."
  type        = map(string)
  default     = {}
}

variable "eval_schedule_expression" {
  description = "EventBridge Scheduler expression for the run."
  type        = string
  default     = "cron(0 9 ? * MON *)"
}

variable "eval_schedule_timezone" {
  description = "Time zone for the schedule."
  type        = string
  default     = "UTC"
}

variable "eval_schedule_enabled" {
  description = "Turn the schedule on. Leave off until an image has been pushed and one manual run has worked."
  type        = bool
  default     = false
}

variable "eval_cpu" {
  description = "Fargate CPU units for the task."
  type        = number
  default     = 512
}

variable "eval_memory" {
  description = "Fargate memory in MiB for the task."
  type        = number
  default     = 1024
}

variable "eval_timeout_seconds" {
  description = "Hard stop for one run."
  type        = number
  default     = 3600
}

variable "log_retention_days" {
  description = "CloudWatch log retention for the eval task."
  type        = number
  default     = 30
}

variable "results_expiration_days" {
  description = "Delete result objects after this many days. 0 keeps them."
  type        = number
  default     = 365
}

variable "kms_key_arn" {
  description = "Optional customer managed KMS key for the results bucket and the log group. With null, S3 managed keys and the CloudWatch default encryption are used."
  type        = string
  default     = null
}

variable "monthly_budget_usd" {
  description = "Monthly cost budget for the whole account. 0 creates no budget."
  type        = number
  default     = 10
}

variable "budget_emails" {
  description = "Addresses that get the budget alerts. Required when monthly_budget_usd is above 0."
  type        = list(string)
  default     = []
}

# ---------- static site (optional) ----------

variable "enable_static_site" {
  description = "Create the S3 and CloudFront hosting for the PWA. GitHub Pages already hosts it, so this is off by default."
  type        = bool
  default     = false
}

variable "site_aliases" {
  description = "Custom domain names for the site. Leave empty to use the cloudfront.net name."
  type        = list(string)
  default     = []
}

variable "site_acm_certificate_arn" {
  description = "ACM certificate in us-east-1 covering site_aliases. Required when site_aliases is not empty."
  type        = string
  default     = null
}

variable "site_content_security_policy" {
  description = "Content-Security-Policy header. Null uses the module default, which mirrors the meta tag in index.html (scripts/check-csp.sh checks they still match)."
  type        = string
  default     = null
}
