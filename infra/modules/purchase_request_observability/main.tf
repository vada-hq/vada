locals {
  log_retention_days = {
    dev  = 30
    prod = 90
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.lambda_function_name}"
  retention_in_days = local.log_retention_days[var.environment]

  tags = var.tags
}

resource "aws_cloudwatch_log_metric_filter" "persistence_failure" {
  name           = "${var.lambda_function_name}-purchase-request-persistence-failure"
  log_group_name = aws_cloudwatch_log_group.api.name
  pattern        = "{ $.error_code = \"PERSISTENCE_UNAVAILABLE\" }"

  metric_transformation {
    name          = "PurchaseRequestPersistenceFailureAlarmCount"
    namespace     = "VADA/PurchaseRequests"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_sns_topic" "persistence_failure" {
  name = "${var.lambda_function_name}-purchase-request-persistence-failure"
  tags = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.persistence_failure.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "persistence_failure" {
  alarm_name          = "${var.lambda_function_name}-purchase-request-persistence-failure"
  alarm_description   = "구매 요청 초안 또는 제출 영속 실패가 발생했습니다."
  namespace           = "VADA/PurchaseRequests"
  metric_name         = "PurchaseRequestPersistenceFailureAlarmCount"
  statistic           = "Sum"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  evaluation_periods  = 1
  period              = 60
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.persistence_failure.arn]

  depends_on = [aws_cloudwatch_log_metric_filter.persistence_failure]
  tags       = var.tags
}
