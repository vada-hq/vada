# 화면을 인터넷 주소에 올린다. 걷는 뼈대의 4차다.
#
# **브라우저가 보는 출처는 하나다.** CloudFront가 화면(`/`)도 API(`/api/v1/*`)도
# 준다. 두 출처로 가르면 CORS가 필요하고, CORS는 브라우저에서만 드러나는
# 실패다 — 사전 요청, 자격 증명 포함 여부, 캐시가 전부 서버 검사에 안 걸린다.
#
# 한 출처의 두 번째 이득은 웹이 **배포 주소를 모른다**는 것이다. `apiPath()`가
# 만드는 상대 경로가 로컬에서도 배포에서도 그대로 돈다. 빌드에 주소를 구우면
# 언젠가 스테이징 빌드가 프로덕션에 올라간다.

locals {
  # 버킷 이름은 전 세계에서 유일해야 한다. 상태 버킷과 같은 방식으로 짓는다.
  web_bucket = "${var.project}-web-${data.aws_caller_identity.current.account_id}"

  # CloudFront 오리진은 호스트 이름만 받는다. `api_endpoint`에는 스킴이 붙어 있다.
  api_origin_host = replace(aws_apigatewayv2_api.api.api_endpoint, "https://", "")
}

# ---------------------------------------------------------------------------
# 빌드 결과가 사는 곳
# ---------------------------------------------------------------------------
# 버킷은 공개하지 않는다. CloudFront만 읽는다(OAC). 공개 버킷으로 열면 누구나
# 배포 주소를 우회해 원본을 직접 읽을 수 있고, 그러면 HTTPS도 캐시도 없다.
resource "aws_s3_bucket" "web" {
  bucket = local.web_bucket
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${var.project}-web"
  description                       = "CloudFront reads the SPA bucket; nobody else can."
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ---------------------------------------------------------------------------
# 가장자리에서 도는 두 조각
# ---------------------------------------------------------------------------
# Lambda@Edge가 아니라 CloudFront Function이다. 주소 한 줄을 고치는 일에는
# 이쪽이 맞다 — 콜드 스타트가 없고, 무료 한도가 월 200만 호출이다.
resource "aws_cloudfront_function" "spa_fallback" {
  name    = "${var.project}-spa-fallback"
  runtime = "cloudfront-js-2.0"
  publish = true
  comment = "Deep links belong to the app, not to S3."
  code    = file("${path.module}/cloudfront/spa-fallback.js")
}

resource "aws_cloudfront_function" "api_prefix" {
  name    = "${var.project}-api-prefix"
  runtime = "cloudfront-js-2.0"
  publish = true
  comment = "Strip the routing prefix; the server never knew about it."
  code    = file("${path.module}/cloudfront/api-prefix.js")
}

# ---------------------------------------------------------------------------
# 배포 주소
# ---------------------------------------------------------------------------
# 이름은 AWS가 준다(`d....cloudfront.net`). 도메인과 Route 53은 첫 배포에서
# 일부러 뺐다 — 나중에 붙여도 이 구조는 바뀌지 않는다(이슈 #78).
data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

# 호스트 헤더만 빼고 전부 오리진에 넘긴다. `Authorization`이 이 길로 간다.
# 호스트를 그대로 넘기면 API Gateway가 자기 이름이 아닌 값을 보고 거절한다.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  comment             = "${var.project} web"
  default_root_object = "index.html"

  # 아시아를 포함하는 가장 싼 등급. PriceClass_100은 북미·유럽뿐이라 한국
  # 사용자가 먼 가장자리로 돌아간다.
  price_class = "PriceClass_200"

  origin {
    origin_id                = "spa"
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  origin {
    origin_id   = "api"
    domain_name = local.api_origin_host

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "spa"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_fallback.arn
    }
  }

  # 더 구체적인 규칙이 기본을 이긴다. 이 자리가 없으면 `/api/v1/health`가
  # 화면 되돌림에 걸려 **200과 HTML**로 답한다 — 실패인데 성공처럼 보인다.
  # 그래서 배포 후 검사가 상태 코드가 아니라 본문을 맞춰 본다.
  ordered_cache_behavior {
    path_pattern           = "/api/v1/*"
    target_origin_id       = "api"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # API 응답은 캐시하지 않는다. 사용자마다 다르고, 권한마다 다르다.
    # 한 사람의 응답이 가장자리에 남으면 다음 사람이 그것을 받는다.
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.api_prefix.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# 이 배포 하나만 읽을 수 있다. 계정의 다른 배포도 못 읽는다.
data "aws_iam_policy_document" "web_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.web]
}
