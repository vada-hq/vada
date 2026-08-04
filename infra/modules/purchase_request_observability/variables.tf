variable "environment" {
  description = "VADA deployment environment."
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}

variable "lambda_function_name" {
  description = "Purchase request API Lambda function name."
  type        = string
}

variable "alarm_email" {
  description = "Human-approved email endpoint for persistence failure alarms."
  type        = string
}

variable "tags" {
  description = "Tags applied to observable resources."
  type        = map(string)
  default     = {}
}
