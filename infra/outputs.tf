output "api_base_url" {
  description = "배포된 API의 주소. 배포 후 검사가 이 주소에 대고 돈다."
  value       = aws_apigatewayv2_stage.api.invoke_url
}
