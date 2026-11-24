output "role_arn" {
  description = "ARN of the GitHub Actions role."
  value       = aws_iam_role.this.arn
}

output "role_name" {
  description = "Name of the GitHub Actions role."
  value       = aws_iam_role.this.name
}

output "oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider in use."
  value       = local.provider_arn
}
