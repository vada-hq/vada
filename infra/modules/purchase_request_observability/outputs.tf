output "lambda_observability" {
  description = "Inputs that the API Lambda caller must apply to its function resource."
  value = {
    tracing_mode = "Active"
    environment_variables = {
      VADA_ENVIRONMENT             = var.environment
      POWERTOOLS_SERVICE_NAME      = "vada-purchase-requests"
      POWERTOOLS_METRICS_NAMESPACE = "VADA/PurchaseRequests"
      POWERTOOLS_LOG_LEVEL         = "INFO"
    }
    required_iam_actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
    ]
  }
}

output "persistence_failure_topic_arn" {
  value = aws_sns_topic.persistence_failure.arn
}
