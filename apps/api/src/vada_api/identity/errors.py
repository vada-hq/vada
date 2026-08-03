from typing import ClassVar


class UnauthenticatedError(Exception):
    """Public authentication failure without token or account details."""

    http_status: ClassVar[int] = 401
    code: ClassVar[str] = "UNAUTHENTICATED"
    problem_type: ClassVar[str] = "https://vada.example/problems/unauthenticated"
    title: ClassVar[str] = "로그인이 필요합니다."

    def __init__(self) -> None:
        super().__init__(self.title)


class ResourceNotFoundError(Exception):
    """Public not-found result shared by absent and out-of-scope resources."""

    http_status: ClassVar[int] = 404
    code: ClassVar[str] = "RESOURCE_NOT_FOUND"
    problem_type: ClassVar[str] = "https://vada.example/problems/resource-not-found"
    title: ClassVar[str] = "요청한 정보를 찾을 수 없습니다."

    def __init__(self) -> None:
        super().__init__(self.title)
