variable "name" {
  description = "Prefix for resource names."
  type        = string
}

variable "aliases" {
  description = "Custom domain names. Empty uses the cloudfront.net name."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM certificate in us-east-1 for the aliases."
  type        = string
  default     = null
}

variable "content_security_policy" {
  description = "Content-Security-Policy header value. Null uses the default below."
  type        = string
  default     = null
}

variable "price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_100"
}

variable "force_destroy" {
  description = "Let terraform destroy delete non-empty buckets and repositories. Set to true only right before tearing down."
  type        = bool
  default     = false
}
