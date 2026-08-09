# FastAPI를 Lambda에 올리고 HTTP API로 연다.
#
# 이 파일은 걷는 뼈대의 1차다. 인증과 데이터베이스는 아직 없다 — `/health` 하나가
# 배포된 주소에서 응답하는 것까지가 이번 목표다. 경로가 뚫린 뒤에 인증을 붙인다.

locals {
  name = "${var.project}-api"
}

# ---------------------------------------------------------------------------
# Lambda
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "api_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = local.name
  assume_role_policy = data.aws_iam_policy_document.api_assume.json
}

# 로그를 쓸 권한만 준다. 데이터베이스도 비밀도 아직 없다 —
# 필요해질 때 그때 붙인다.
resource "aws_iam_role_policy_attachment" "api_logs" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 로그 그룹을 Terraform이 소유한다. Lambda가 스스로 만들게 두면 보존 기간이
# 무한이 되고, 아무도 안 읽는 로그에 계속 돈이 든다.
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "api" {
  function_name = local.name
  role          = aws_iam_role.api.arn
  runtime       = "python3.13"
  handler       = "vada_api.main.handler"
  architectures = ["x86_64"]

  filename         = var.api_package
  source_code_hash = filebase64sha256(var.api_package)

  # 콜드 스타트에 FastAPI와 OpenAPI 정규화가 함께 돈다. 128MB로는 모자란다.
  memory_size = 512
  timeout     = 15

  depends_on = [
    aws_iam_role_policy_attachment.api_logs,
    aws_cloudwatch_log_group.api,
  ]
}

# ---------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------
# REST API가 아니라 HTTP API다. JWT 권한 부여자가 내장이라 Cognito를 붙일 때
# Lambda 권한 부여자를 따로 쓸 필요가 없고, 요청당 비용도 더 싸다.
resource "aws_apigatewayv2_api" "api" {
  name          = local.name
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

# 경로를 게이트웨이에 다시 적지 않는다. FastAPI가 이미 라우터를 갖고 있고,
# 두 곳에 적으면 반드시 어긋난다.
#
# **기본은 인증이다.** 새 화면을 만들 때 게이트웨이에 무언가를 더 적어야만
# 보호되는 구조라면, 언젠가 잊는다. 잊은 자리는 공개된다.
resource "aws_apigatewayv2_route" "api" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "$default"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.people.id
}

# 열려 있는 자리는 여기 하나뿐이고, 그래서 눈에 띈다. 배포 후 검사가 토큰
# 없이 부를 수 있어야 하고, 이 응답은 누구에게도 아무것도 알려주지 않는다.
# 더 구체적인 경로가 `$default`를 이긴다.
resource "aws_apigatewayv2_route" "health" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "GET /health"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  # 무엇이 몇 번 오고 어떻게 끝났는지. 뼈대가 실패했을 때 이게 없으면
  # 왜 실패했는지 알 방법이 없다.
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      httpMethod     = "$context.httpMethod"
      path           = "$context.path"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      integrationErr = "$context.integrationErrorMessage"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowInvokeFromHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
