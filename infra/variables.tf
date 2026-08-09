variable "region" {
  description = "Seoul. The wireframe canon and the observability module both assume it."
  type        = string
  default     = "ap-northeast-2"
}

variable "project" {
  description = "Name prefix for every resource, so one account can hold more later."
  type        = string
  default     = "vada"
}

variable "api_package" {
  description = "Zip built by the deploy workflow. Not committed; see .gitignore."
  type        = string
  default     = "../.artifacts/api.zip"
}

variable "database_url_parameter" {
  description = <<-TEXT
    SSM parameter holding the deployed database URL. Terraform never reads it —
    only names it — so the URL stays out of the state file. A human puts the
    value there once; see infra/README.md.
  TEXT
  type        = string
  default     = "/vada/skeleton/database-url"
}

variable "verification_email" {
  description = "Login for the post-deploy check. Not a person; .invalid never resolves."
  type        = string
  default     = "deployment-check@vada.invalid"
}

variable "log_retention_days" {
  description = "Logs cost money and nobody reads month-old skeleton logs."
  type        = number
  default     = 14
}
