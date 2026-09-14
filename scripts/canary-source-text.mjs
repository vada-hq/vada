import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

export function textOf(dir, keep) {
  let text = ''
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) text += textOf(path, keep)
    else if (keep(name, path)) text += readFileSync(path, 'utf8')
  }
  return text
}

export function fixtureText(web) {
  const development = join(web, 'development')
  const modules = join(development, 'fixtures')
  return (
    readFileSync(join(development, 'data-fixtures.ts'), 'utf8') +
    readFileSync(join(development, 'option-fixtures.ts'), 'utf8') +
    textOf(modules, (name) => name.endsWith('.ts'))
  )
}

export function nonFixtureWebText(web) {
  const modules = join(web, 'development', 'fixtures')
  return textOf(
    web,
    (name, path) =>
      /\.(ts|tsx)$/.test(name) &&
      !name.includes('fixtures') &&
      !name.includes('.test.') &&
      !path.startsWith(`${modules}${sep}`),
  )
}
