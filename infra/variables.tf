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

variable "log_retention_days" {
  description = "Logs cost money and nobody reads month-old skeleton logs."
  type        = number
  default     = 14
}
