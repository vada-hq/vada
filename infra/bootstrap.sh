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

# 없는 도구는 스크립트 중간이 아니라 여기서 걸린다. 중간에서 걸리면 절반만
# 만들어진 상태로 끝나고, 그게 무슨 상태인지 다음 사람이 알 수 없다.
for tool in aws jq openssl curl; do
  command -v "${tool}" >/dev/null 2>&1 || {
    echo "${tool}가 없습니다. AWS CloudShell에서 실행하세요." >&2
    exit 1
  }
done

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

# 지문은 대개 쓰이지 않는다. AWS가 자체 루트 인증 기관 목록으로 인증서를
# 검증하기 때문이다. 하지만 문서가 조건을 달아 둔다 — **인증서를 가져오지
# 못하거나 TLS 1.3이 요구되면 지문 검증으로 되돌아간다.** 그때 자리만 채운
# 값이면 실패한다. 실제 값을 계산해 둔다.
#
# AWS가 보는 것은 체인의 마지막(최상위 중간 CA) 인증서의 SHA-1 지문이다.
oidc_thumbprint() {
  local work
  work="$(mktemp -d)"
  echo \
    | openssl s_client -servername "${OIDC_URL}" -showcerts \
      -connect "${OIDC_URL}:443" 2>/dev/null \
    | awk -v dir="${work}" '
        /-----BEGIN CERTIFICATE-----/ { n++ }
        n { print > (dir "/cert-" n ".pem") }
      '
  local last
  last="$(find "${work}" -name 'cert-*.pem' | sort -V | tail -1)"
  openssl x509 -in "${last}" -fingerprint -sha1 -noout \
    | cut -d= -f2 | tr -d ':' | tr '[:upper:]' '[:lower:]'
}

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "${OIDC_ARN}" >/dev/null 2>&1; then
  echo "[갱신] OIDC 공급자의 지문"
  aws iam update-open-id-connect-provider-thumbprint \
    --open-id-connect-provider-arn "${OIDC_ARN}" \
    --thumbprint-list "$(oidc_thumbprint)"
else
  echo "[생성] GitHub OIDC 공급자"
  aws iam create-open-id-connect-provider \
    --url "https://${OIDC_URL}" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "$(oidc_thumbprint)" >/dev/null
fi

# ---------------------------------------------------------------------------
# 3. GitHub Actions가 맡을 역할
# ---------------------------------------------------------------------------
# 이 저장소의 main 브랜치에서 도는 워크플로만 맡을 수 있다. 다른 저장소도,
# 포크의 풀 리퀘스트도 맡을 수 없다 — 그것이 없으면 누구나 이 계정을 쓴다.
#
# 주체(sub)에 **번호**가 들어간다. GitHub이 보내는 실제 값이 그렇다:
#
#   repo:vada-hq@306677743/vada@1305432774:ref:refs/heads/main
#
# 이름이 아니라 조직·저장소의 불변 번호다. 저장소 이름을 바꾸거나 조직을
# 옮겨도 신뢰가 조용히 다른 곳으로 따라가지 않는다. 이름으로 적으면
# `repo:vada-hq/vada`가 되는데, 그 형식은 이 저장소에서 쓰이지 않는다 —
# 실제로 그렇게 적어 뒀다가 "Not authorized"로 막혔다.
#
# 번호를 손으로 베끼지 않는다. 손으로 베낀 번호는 저장소를 옮겼을 때 아무도
# 안 고친다. 공개 API에서 읽는다 — 인증이 필요 없다.
read -r OWNER_ID REPO_ID <<<"$(
  curl -fsS "https://api.github.com/repos/${GITHUB_REPOSITORY}" \
    | jq -r '"\(.owner.id) \(.id)"'
)"

if [ -z "${OWNER_ID}" ] || [ -z "${REPO_ID}" ]; then
  echo "GitHub에서 조직·저장소 번호를 읽지 못했습니다." >&2
  exit 1
fi

SUBJECT="repo:${GITHUB_REPOSITORY%%/*}@${OWNER_ID}/${GITHUB_REPOSITORY##*/}@${REPO_ID}:ref:refs/heads/main"
echo "믿을 주체: ${SUBJECT}"

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
          "${OIDC_URL}:sub": "${SUBJECT}"
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
