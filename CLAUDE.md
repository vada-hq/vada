@AGENTS.md

## Claude Code 전용 메모

- 다른 에이전트(Codex 등)와 병렬 작업 시 브랜치·워크트리를 분리하라. 같은 워킹트리 동시 수정 금지.
- Figma 구현: Figma MCP로 프레임·디자인 변수를 읽어 shadcn 컴포넌트로 매핑해 구현한다. Figma Make가 생성한 코드를 이식하지 마라(프로토타입 등급).
- shadcn 컴포넌트 추가는 shadcn MCP/CLI를 사용하라.
