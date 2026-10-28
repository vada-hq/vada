export interface ObjectPage {
  objects: { key: string; lastModified: Date }[]
  continuationToken?: string
}

type Element = { name: string; text: string; children: Element[] }
type XmlTree = { stack: Element[]; root?: Element }
const invalid = () => new Error('STORAGE_LIST_FAILED')
const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const HEX_RADIX = 16

function unescapeXml(text: string) {
  return text.replace(/&([^;]*);|&/g, (_, entity: string | undefined) => {
    if (entity && Object.hasOwn(entities, entity)) return entities[entity]!
    if (!entity || !/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(entity)) throw invalid()
    const code =
      entity[1]?.toLowerCase() === 'x'
        ? Number.parseInt(entity.slice('#x'.length), HEX_RADIX)
        : Number(entity.slice(1))
    const value = String.fromCodePoint(code)
    if (/[\uD800-\uDFFF]/u.test(value) || code === 0) throw invalid()
    return value
  })
}

function openElement(token: string): Element {
  const match = /^<([A-Za-z_][\w:.-]*)(?:\s+[^<>]*?)?\s*\/?>$/.exec(token)
  if (!match) throw invalid()
  return { name: match[1]!, text: '', children: [] }
}

function addElement(tree: XmlTree, token: string) {
  const node = openElement(token)
  const parent = tree.stack.at(-1)
  if (parent) parent.children.push(node)
  else if (tree.root) throw invalid()
  else tree.root = node
  if (!token.endsWith('/>')) tree.stack.push(node)
}

function readToken(tree: XmlTree, token: string) {
  if (token.startsWith('<?xml ') && !tree.root && !tree.stack.length) return
  if (token.startsWith('</')) {
    const closed = tree.stack.pop()
    if (!closed || token !== `</${closed.name}>`) throw invalid()
  } else if (token.startsWith('<')) {
    addElement(tree, token)
  } else {
    const parent = tree.stack.at(-1)
    if (parent) parent.text += token
    else if (token.trim()) throw invalid()
  }
}

// 응답 XML을 끝까지 검사한다. 깨진 200 응답을 빈 목록이나 삭제 후보로 받아들이지 않는다.
function treeOf(xml: string) {
  const tree: XmlTree = { stack: [] }
  const tokens = xml.match(/<[^>]*>|[^<]+/g) ?? []
  if (tokens.join('') !== xml) throw invalid()
  for (const token of tokens) readToken(tree, token)
  if (tree.stack.length || tree.root?.name !== 'ListBucketResult') throw invalid()
  return tree.root
}

function field(node: Element, name: string) {
  const found = node.children.filter(child => child.name === name)
  if (found.length !== 1 || found[0]!.children.length) throw invalid()
  return unescapeXml(found[0]!.text)
}

function objectDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw invalid()
  const date = new Date(value)
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z')
  // Date는 2월 30일을 3월로 넘겨 읽는다. 잘못된 나이로 객체를 지우지 않게 원문과 맞댄다.
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== normalized) throw invalid()
  return date
}

function readObjectPage(xml: string): ObjectPage {
  try {
    const root = treeOf(xml)
    if (field(root, 'EncodingType') !== 'url') throw invalid()
    const truncated = field(root, 'IsTruncated')
    if (truncated !== 'true' && truncated !== 'false') throw invalid()
    const objects = root.children
      .filter(node => node.name === 'Contents')
      .map(node => {
        const key = decodeURIComponent(field(node, 'Key'))
        const lastModified = objectDate(field(node, 'LastModified'))
        if (!key) throw invalid()
        return { key, lastModified }
      })
    if (truncated === 'false') return { objects }
    const continuationToken = field(root, 'NextContinuationToken')
    if (!continuationToken) throw invalid()
    return { objects, continuationToken }
  } catch {
    throw invalid()
  }
}

const LIST_PAGE_SIZE = 1000
export async function listObjects(
  send: (url: URL) => Promise<Response>,
  url: URL,
  prefix: string,
  continuationToken?: string,
): Promise<ObjectPage> {
  url.searchParams.set('list-type', '2')
  url.searchParams.set('prefix', prefix)
  url.searchParams.set('encoding-type', 'url')
  url.searchParams.set('max-keys', String(LIST_PAGE_SIZE))
  if (continuationToken) url.searchParams.set('continuation-token', continuationToken)
  const response = await send(url)
  if (!response.ok) throw new Error('STORAGE_LIST_FAILED')
  return readObjectPage(await response.text())
}
