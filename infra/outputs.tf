output "account_id" {
  description = "Account these resources live in."
  value       = data.aws_caller_identity.current.account_id
}

output "eval_ecr_repository_url" {
  description = "Push the eval image here."
  value       = module.eval_runner.ecr_repository_url
}

output "eval_results_bucket" {
  description = "Bucket that receives eval results."
  value       = module.eval_runner.results_bucket
}

output "eval_log_group" {
  description = "CloudWatch log group of the eval task."
  value       = module.eval_runner.log_group_name
}

output "eval_run_task_command" {
  description = "Start one run by hand."
  value       = module.eval_runner.run_task_command
}

output "github_actions_role_arn" {
  description = "Role for GitHub Actions to assume through OIDC. Put it in the repository variable AWS_ROLE_ARN."
  value       = module.github_oidc.role_arn
}

output "site_url" {
  description = "CloudFront URL of the static site, when enabled."
  value       = one(module.static_site[*].url)
}

output "site_bucket" {
  description = "Bucket to sync the PWA files to, when the static site is enabled."
  value       = one(module.static_site[*].bucket_name)
}

output "site_distribution_id" {
  description = "CloudFront distribution id, when the static site is enabled."
  value       = one(module.static_site[*].distribution_id)
}
