terraform {
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }

  # 버킷 이름에 계정 번호가 들어가 계정마다 다르다. 백엔드 블록은 변수를 받지
  # 않으므로 여기 못 박지 않고 init에서 넣는다:
  #   terraform init -backend-config="bucket=${TF_STATE_BUCKET}"
  #
  # use_lockfile은 상태 잠금을 S3가 직접 한다. DynamoDB 표가 필요 없다.
  backend "s3" {
    key          = "skeleton/terraform.tfstate"
    region       = "ap-northeast-2"
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}
