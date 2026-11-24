output "ecr_repository_url" {
  description = "URL of the image repository."
  value       = aws_ecr_repository.this.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the image repository."
  value       = aws_ecr_repository.this.arn
}

output "results_bucket" {
  description = "Name of the results bucket."
  value       = aws_s3_bucket.results.bucket
}

output "results_bucket_arn" {
  description = "ARN of the results bucket."
  value       = aws_s3_bucket.results.arn
}

output "log_group_name" {
  description = "CloudWatch log group of the task."
  value       = aws_cloudwatch_log_group.this.name
}

output "cluster_arn" {
  description = "ECS cluster ARN."
  value       = aws_ecs_cluster.this.arn
}

output "task_definition_family" {
  description = "Task definition family."
  value       = aws_ecs_task_definition.this.family
}

output "task_role_arn" {
  description = "Role the eval container runs as."
  value       = aws_iam_role.task.arn
}

output "run_task_command" {
  description = "AWS CLI command that starts one run by hand."
  value       = "aws ecs run-task --region ${local.region} --cluster ${aws_ecs_cluster.this.name} --task-definition ${aws_ecs_task_definition.this.family} --launch-type FARGATE --network-configuration 'awsvpcConfiguration={subnets=[${join(",", aws_subnet.public[*].id)}],securityGroups=[${aws_security_group.task.id}],assignPublicIp=ENABLED}'"
}
