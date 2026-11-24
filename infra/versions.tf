terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0, < 7.0"
    }
  }

  # Remote state. Local state is fine for one person trying this out. To share state or
  # run from CI, create the bucket once by hand, fill this in, and run
  # `terraform init -migrate-state`.
  #
  # backend "s3" {
  #   bucket       = "murmur-tfstate-<account-id>"
  #   key          = "murmur/infra.tfstate"
  #   region       = "us-east-1"
  #   encrypt      = true
  #   use_lockfile = true # S3 native locking, Terraform 1.10 or later; no DynamoDB table
  # }
}
