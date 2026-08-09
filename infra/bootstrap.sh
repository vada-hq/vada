#!/usr/bin/env bash
#
# Terraform이 스스로 만들 수 없는 것만 만든다. 한 번만 돌린다.
#
# 닭과 달걀 문제가 둘 있다.
#   1. Terraform 상태는 S3에 두는데, 그 버킷을 Terraform이 만들 수 없다
#   2. CI가 AWS에 붙으려면 역할이 있어야 하는데, 그 역할을 CI가 만들 수 없다
#
# 이 둘만 여기서 만들고, 나머지는 전부 Terraform이 만든다.
#
# **AWS CloudShell에서 돌린다.** 콘솔 세션의 자격 증명을 그대로 쓰므로
# 장기 액세스 키를 만들 필요가 없다. 액세스 키는 한 번 새면 되돌릴 수 없고,
# 새지 않았는지 확인할 방법도 없다.
#
#   실행:  bash infra/bootstrap.sh
#
# 몇 번을 돌려도 같은 상태가 된다. 이미 있는 것은 건드리지 않는다.

set -euo pipefail

REGION="ap-northeast-2"
GITHUB_REPOSITORY="vada-hq/vada"
ROLE_NAME="vada-github-actions"
OIDC_URL="token.actions.githubusercontent.com"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
# 버킷 이름은 전 세계에서 유일해야 한다. 계정 번호를 붙여 충돌을 피한다.
STATE_BUCKET="vada-tfstate-${ACCOUNT_ID}"

echo "계정 ${ACCOUNT_ID} · 리전 ${REGION}"
echo

# ---------------------------------------------------------------------------
# 1. Terraform 상태 버킷
# ---------------------------------------------------------------------------
if aws s3api head-bucket --bucket "${STATE_BUCKET}" 2>/dev/null; then
  echo "[건너뜀] 상태 버킷이 이미 있습니다: ${STATE_BUCKET}"
else
  echo "[생성] 상태 버킷 ${STATE_BUCKET}"
  aws s3api create-bucket \
    --bucket "${STATE_BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration "LocationConstraint=${REGION}" >/dev/null

  # 상태 파일은 실수로 지우면 인프라를 못 고친다. 버전을 남긴다.
  aws s3api put-bucket-versioning \
    --bucket "${STATE_BUCKET}" \
    --versioning-configuration Status=Enabled

  # 상태 파일에는 리소스 식별자와 때로는 비밀이 들어간다. 절대 공개되면 안 된다.
  aws s3api put-public-access-block \
    --bucket "${STATE_BUCKET}" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  aws s3api put-bucket-encryption \
    --bucket "${STATE_BUCKET}" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
fi

# ---------------------------------------------------------------------------
# 2. GitHub OIDC 공급자
# ---------------------------------------------------------------------------
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_URL}"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "${OIDC_ARN}" >/dev/null 2>&1; then
  echo "[건너뜀] OIDC 공급자가 이미 있습니다"
else
  echo "[생성] GitHub OIDC 공급자"
  # 지문(thumbprint)은 2024년 12월부터 실제로 쓰이지 않는다. AWS가 자체 루트
  # 인증 기관 목록으로 인증서 체인을 검증한다. 다만 API가 값을 요구하므로
  # 자리를 채운다.
  aws iam create-open-id-connect-provider \
    --url "https://${OIDC_URL}" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "ffffffffffffffffffffffffffffffffffffffff" >/dev/null
fi

# ---------------------------------------------------------------------------
# 3. GitHub Actions가 맡을 역할
# ---------------------------------------------------------------------------
# 이 저장소의 main 브랜치에서 도는 워크플로만 맡을 수 있다. 다른 저장소도,
# 포크의 풀 리퀘스트도 맡을 수 없다 — 그것이 없으면 누구나 이 계정을 쓴다.
TRUST_POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "${OIDC_ARN}" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "${OIDC_URL}:aud": "sts.amazonaws.com",
          "${OIDC_URL}:sub": "repo:${GITHUB_REPOSITORY}:ref:refs/heads/main"
        }
      }
    }
  ]
}
JSON
)

if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  echo "[갱신] 역할 ${ROLE_NAME}의 신뢰 정책"
  aws iam update-assume-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-document "${TRUST_POLICY}"
else
  echo "[생성] 역할 ${ROLE_NAME}"
  # 설명은 ASCII만 받는다. IAM이 [ -~¡-ÿ]로 제한하므로
  # 한글을 넣으면 ValidationError로 거절한다. AWS에 보내는 값은 영문으로 쓴다.
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --description "Deploy role assumed by GitHub Actions on vada-hq/vada main" \
    --assume-role-policy-document "${TRUST_POLICY}" >/dev/null
fi

# 처음에는 넓게 준다. 무엇이 필요한지는 Terraform을 써 봐야 안다.
# 좁히는 것은 이슈 #78의 "일부러 뺀 것"에 적혀 있다.
aws iam attach-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-arn "arn:aws:iam::aws:policy/AdministratorAccess"

# ---------------------------------------------------------------------------
echo
echo "끝났습니다. 아래 둘을 GitHub 저장소 변수로 등록하세요."
echo
echo "  AWS_ROLE_ARN     arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo "  TF_STATE_BUCKET  ${STATE_BUCKET}"
echo
echo "계정 번호는 비밀이 아닙니다. 역할을 맡으려면 GitHub의 신원 증명이 필요하고,"
echo "그 증명은 이 저장소의 main에서 도는 워크플로에만 발급됩니다."
