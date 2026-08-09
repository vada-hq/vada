output "api_base_url" {
  description = "배포된 API의 주소. 배포 후 검사가 이 주소에 대고 돈다."
  # `$default` 스테이지의 주소는 슬래시로 끝난다. 그대로 이어 붙이면
  # `.../\/health`가 되어 로그가 읽기 어려워진다.
  value = trimsuffix(aws_apigatewayv2_stage.api.invoke_url, "/")
}

output "user_pool_client_id" {
  description = "배포 후 검사가 토큰을 받을 때 쓴다. 비밀이 아니다 — 브라우저에도 실린다."
  value       = aws_cognito_user_pool_client.web.id
}

output "verification_email" {
  description = "배포 후 검사가 로그인할 계정. 사람이 아니다."
  value       = var.verification_email
}

output "verification_password_parameter" {
  description = "그 계정의 비밀번호가 든 SSM 자리. 값이 아니라 자리만 내보낸다."
  value       = aws_ssm_parameter.verification_password.name
}
