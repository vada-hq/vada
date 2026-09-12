import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import ts from 'typescript'

it('공통 라우터는 개별 화면 컴포넌트를 직접 가져오지 않는다', () => {
  const source = readFileSync(new URL('./ScreenRouter.tsx', import.meta.url), 'utf8')
  const file = ts.createSourceFile('ScreenRouter.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const directScreens = file.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => statement.moduleSpecifier)
    .filter(ts.isStringLiteral)
    .map((specifier) => specifier.text)
    .filter((path) => /\/[^/]+Screen$/.test(path))

  expect(directScreens, '화면 연결은 해당 업무의 등록부가 맡아야 합니다').toEqual([])
})
