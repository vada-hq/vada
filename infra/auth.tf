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

  # 아무나 계정을 만들지 못한다. 호스팅 UI를 붙이는 순간 가입 화면이 같이
  # 생기는데, 공개된 주소에 열린 가입은 그대로 열린 문이다.
  #
  # 사람이 들어오는 길은 초대다. 그 흐름(ONB-01·ORG-01)이 생기기 전까지는
  # 계정을 만드는 길이 관리자 명령뿐이어야 한다.
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

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

# 사람이 로그인하는 화면. Cognito가 호스팅한다.
#
# 로그인 폼을 우리가 만들지 않는 이유는 비밀번호 때문이다. 우리 코드가 비밀번호를
# 손에 쥐지 않으면 그것을 흘릴 방법도 없다. 비밀번호 재설정·잠금·이메일 확인도
# 전부 저쪽이 들고 있다.
resource "aws_cognito_user_pool_domain" "login" {
  # 접두사는 전 세계에서 유일해야 한다. 버킷과 같은 방식으로 짓는다.
  domain       = "${var.project}-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.people.id
}

locals {
  login_base_url     = "https://${aws_cognito_user_pool_domain.login.domain}.auth.${var.region}.amazoncognito.com"
  login_callback_url = "https://${aws_cloudfront_distribution.web.domain_name}/auth/callback"
}

# 비밀 없는 클라이언트다. 브라우저에서 도는 SPA는 비밀을 지킬 수 없다 —
# 넣어 두면 누구나 개발자 도구로 꺼낸다.
#
# 그래서 인가 코드 흐름에 **PKCE**를 얹는다. 클라이언트 비밀이 없으면 코드를
# 가로챈 쪽이 그대로 토큰으로 바꿀 수 있는데, PKCE는 코드를 시작한 브라우저만
# 아는 값을 교환 때 같이 요구해 그것을 막는다.
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project}-web"
  user_pool_id = aws_cognito_user_pool.people.id

  # USER_PASSWORD_AUTH는 배포 후 검사가 토큰을 받는 통로다. 사람은 이 길로
  # 오지 않는다 — 사람은 아래 호스팅 UI로 온다.
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  supported_identity_providers         = ["COGNITO"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]

  # **여기 적힌 주소로만 되돌려 보낸다.** 이 목록이 없으면 로그인한 사람을
  # 아무 주소로나 보낼 수 있고, 코드가 그 주소로 따라간다.
  #
  # 로컬 주소는 넣지 않는다. 로컬 개발에는 Cognito가 없고, 넣어 두면 코드를
  # 손에 넣은 쪽이 자기 기계로 되돌려 받을 자리가 생긴다.
  callback_urls = [local.login_callback_url]
  logout_urls   = ["https://${aws_cloudfront_distribution.web.domain_name}/"]

  # 없는 계정과 틀린 비밀번호를 같은 말로 거절한다. 다르게 답하면 그것만으로
  # 누가 가입했는지 알아낼 수 있다.
  prevent_user_existence_errors = "ENABLED"

  access_token_validity = 60
  token_validity_units {
    access_token = "minutes"
  }

  # OAuth 설정은 로그인 화면이 있어야 뜻이 있다. 순서를 못 박아 두지 않으면
  # 처음 만들 때 둘의 순서가 실행마다 달라진다.
  depends_on = [aws_cognito_user_pool_domain.login]
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
    # 확인된 것으로 둔다. 받을 사람이 없는 주소라 확인 메일이 갈 곳이 없고,
    # 확인되지 않은 채로 두면 호스팅 UI가 로그인 도중 확인을 요구한다.
    email_verified = "true"
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
