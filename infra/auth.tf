# 인증 경계. 걷는 뼈대의 2차다.
#
# 저장소의 모든 권한 판정이 "API Gateway의 JWT 권한 부여자가 검증한 청구항"을
# 전제하는데, 그 경계가 한 번도 실물로 돌아본 적이 없다. 개발에서는
# `LocalPrincipalMiddleware`가 그 출력을 흉내낼 뿐이다. 여기서 진짜를 세운다.

# ---------------------------------------------------------------------------
# 사용자 풀
# ---------------------------------------------------------------------------
# **스키마는 만든 뒤에 바꿀 수 없다.** 이메일로 로그인할지 말지도 그렇다.
# 학생회 구성원은 이메일로 들어온다. 지금 정해 두지 않으면 나중에 풀을 새로
# 만들어야 하고, 그때는 사용자를 옮겨야 하는데 비밀번호는 옮길 수 없다.
resource "aws_cognito_user_pool" "people" {
  name                = var.project
  username_attributes = ["email"]

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

# 비밀 없는 클라이언트다. 브라우저에서 도는 SPA는 비밀을 지킬 수 없다 —
# 넣어 두면 누구나 개발자 도구로 꺼낸다.
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project}-web"
  user_pool_id = aws_cognito_user_pool.people.id

  # USER_PASSWORD_AUTH는 배포 후 검사가 토큰을 받는 통로다. 사람이 브라우저에서
  # 로그인하는 통로(호스팅 UI)는 4차에서 붙인다.
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  access_token_validity = 60
  token_validity_units {
    access_token = "minutes"
  }
}

# ---------------------------------------------------------------------------
# 배포 후 검사가 쓸 사람
# ---------------------------------------------------------------------------
# 배포되었다는 것과 인증이 도는 것은 다른 사실이다. 확인하려면 진짜 토큰이
# 필요하고, 진짜 토큰을 받으려면 진짜 사람이 있어야 한다.
resource "random_password" "verification" {
  length           = 32
  min_lower        = 2
  min_upper        = 2
  min_numeric      = 2
  min_special      = 2
  override_special = "!#$%*-_"
}

resource "aws_cognito_user" "verification" {
  user_pool_id = aws_cognito_user_pool.people.id
  username     = var.verification_email
  password     = random_password.verification.result

  # 메일을 보내지 않는다. 받을 사람이 없는 주소다.
  message_action = "SUPPRESS"

  attributes = {
    email = var.verification_email
  }
}

# 비밀번호를 워크플로 변수나 로그에 두지 않는다. 저장소 규칙이 배포 시
# SSM Parameter Store를 쓰라고 정한다.
resource "aws_ssm_parameter" "verification_password" {
  name        = "/${var.project}/skeleton/verification-password"
  description = "Password for the deployment check user. Not a person."
  type        = "SecureString"
  value       = random_password.verification.result
}

# ---------------------------------------------------------------------------
# JWT 권한 부여자
# ---------------------------------------------------------------------------
# Cognito **액세스 토큰에는 `aud` 청구항이 없다.** 대신 `client_id`가 있고,
# API Gateway는 `aud`가 없을 때만 `client_id`를 검증한다. 그래서 audience에
# 앱 클라이언트 ID를 넣는다.
#
# 액세스 토큰이어야 하는 이유는 우리 코드에도 있다 —
# `principal_from_api_gateway_request_context`가 `token_use == "access"`를
# 요구한다. ID 토큰은 거절된다.
resource "aws_apigatewayv2_authorizer" "people" {
  api_id           = aws_apigatewayv2_api.api.id
  name             = "${var.project}-cognito"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://${aws_cognito_user_pool.people.endpoint}"
  }
}
