variable "name" {
  description = "Role name."
  type        = string
}

variable "repository" {
  description = "GitHub repository as owner/name."
  type        = string
}

variable "subjects" {
  description = "Allowed OIDC subjects, as the part after repo:owner/name:."
  type        = list(string)

  validation {
    condition     = length(var.subjects) > 0 && alltrue([for s in var.subjects : s != "*" && length(s) > 0])
    error_message = "Name at least one subject, and do not use a bare wildcard: that would let any branch, tag or pull request of the repository assume the role."
  }
}

variable "create_oidc_provider" {
  description = "Create the account's GitHub OIDC provider."
  type        = bool
  default     = true
}

variable "oidc_provider_arn" {
  description = "Existing provider ARN, used when create_oidc_provider is false."
  type        = string
  default     = null
}

variable "ecr_repository_arn" {
  description = "ECR repository the role may push to."
  type        = string
}

variable "enable_site_deploy" {
  description = "Allow syncing the static site bucket and invalidating the distribution."
  type        = bool
  default     = false
}

variable "site_bucket_arn" {
  description = "Static site bucket ARN."
  type        = string
  default     = null
}

variable "site_distribution_arn" {
  description = "Static site CloudFront distribution ARN."
  type        = string
  default     = null
}
