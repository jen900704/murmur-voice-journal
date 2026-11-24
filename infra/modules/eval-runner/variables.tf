variable "name" {
  description = "Prefix for resource names."
  type        = string
}

variable "image_tag" {
  description = "Image tag to run."
  type        = string
}

variable "command" {
  description = "Container command."
  type        = list(string)
}

variable "output_dir" {
  description = "Folder in the container that is uploaded to S3 after the run."
  type        = string
}

variable "environment" {
  description = "Extra plain environment variables."
  type        = map(string)
  default     = {}
}

variable "bedrock_model_arns" {
  description = "Exact Bedrock model and inference profile ARNs the task may invoke."
  type        = list(string)
}

variable "schedule_expression" {
  description = "EventBridge Scheduler expression."
  type        = string
}

variable "schedule_timezone" {
  description = "Time zone of the schedule."
  type        = string
  default     = "UTC"
}

variable "schedule_enabled" {
  description = "Whether the schedule fires."
  type        = bool
  default     = false
}

variable "cpu" {
  description = "Fargate CPU units."
  type        = number
  default     = 512
}

variable "memory" {
  description = "Fargate memory in MiB."
  type        = number
  default     = 1024
}

variable "timeout_seconds" {
  description = "Hard stop for one run."
  type        = number
  default     = 3600
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 30
}

variable "results_prefix" {
  description = "Key prefix for results in the bucket."
  type        = string
  default     = "runs"
}

variable "results_expiration_days" {
  description = "Delete results after this many days. 0 keeps them."
  type        = number
  default     = 365
}

variable "kms_key_arn" {
  description = "Optional customer managed KMS key for the bucket and the log group."
  type        = string
  default     = null
}

variable "vpc_cidr" {
  description = "CIDR of the small VPC the task runs in."
  type        = string
  default     = "10.42.0.0/24"
}

variable "force_destroy" {
  description = "Let terraform destroy delete non-empty buckets and repositories. Set to true only right before tearing down."
  type        = bool
  default     = false
}
