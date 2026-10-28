import { AwsClient } from 'aws4fetch'
import { NOT_FOUND } from '../http/status.js'
import { listObjects, type ObjectPage } from './list-objects.js'

interface StoredObject {
  size: number
  contentType: string | null
  lastModified: Date | null
}
// 파일 저장소(영수증, 대화의 사진). 파일은 브라우저가 서명 주소로 바로 올리고 받는다.
export interface FileStorage {
  uploadUrl(
    key: string,
    contentType: string,
  ): Promise<{ url: string; headers: Record<string, string>; expiresAt: Date }>
  downloadUrl(key: string, fileName: string, contentType: string): Promise<string>
  head(key: string): Promise<StoredObject | null>
  list(prefix: string, continuationToken?: string): Promise<ObjectPage>
  // 객체 바이트를 한 번에 읽는다(증빙 묶음이 한 장씩). 없으면 null이고, 읽지 못하면 던진다.
  read(key: string): Promise<Uint8Array | null>
  // 저장소 안에서 객체를 새 키로 복사한다(서버가 바이트를 받지 않는다). 새 키는 새로 만든 것이어야 한다(조건부 쓰기 헤더는 복사에서 보장되지 않아 쓰지 않는다). 원본은 건드리지 않는다.
  copy(fromKey: string, toKey: string): Promise<void>
  remove(key: string): Promise<void>
}
export interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}
const UPLOAD_SECONDS = 600
const MS_PER_SECOND = 1000
const DOWNLOAD_SECONDS = 300
const READ_TIMEOUT_MS = 30_000

// 네 값이 모두 있어야 켠다. 하나라도 없으면 파일 올리기·보기만 막는다.
export function r2ConfigFrom(env: NodeJS.ProcessEnv): R2Config | null {
  const config = {
    accountId: env.R2_ACCOUNT_ID?.trim() ?? '',
    accessKeyId: env.R2_ACCESS_KEY_ID?.trim() ?? '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY?.trim() ?? '',
    bucket: env.R2_BUCKET?.trim() ?? '',
  }
  return Object.values(config).every(Boolean) ? config : null
}

type Call = (
  method: 'PUT',
  key: string,
  extra: { headers: Record<string, string> },
) => Promise<Response>
// 200 안에 오류가 담길 수 있어 상태만 믿지 않는다. 부른 쪽이 새 객체의 크기와 형식을 다시 확인한다.
async function copyObject(call: Call, source: string, toKey: string) {
  const response = await call('PUT', toKey, { headers: { 'x-amz-copy-source': source } })
  if (!response.ok) throw new Error('STORAGE_COPY_FAILED')
}

// Cloudflare R2의 S3 호환 주소에 SigV4로 서명한다. 버킷은 비공개다.
function r2Access(config: R2Config, fetcher: typeof fetch, now: () => Date) {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: 'auto',
  })
  const pathOf = (key: string) =>
    `/${encodeURIComponent(config.bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`
  const objectUrl = (key: string) =>
    new URL(`https://${config.accountId}.r2.cloudflarestorage.com${pathOf(key)}`)
  const stamp = () =>
    now()
      .toISOString()
      .replace(/[:-]|\.\d{3}/g, '')
  // 서명 주소. 올리기는 Content-Type과 If-None-Match까지 서명해 다른 형식으로 올리거나 덮어쓰지 못하게 한다.
  async function presign(
    method: 'PUT' | 'GET',
    url: URL,
    seconds: number,
    headers: Record<string, string> = {},
  ) {
    url.searchParams.set('X-Amz-Expires', String(seconds))
    const signed = await client.sign(url.toString(), {
      method,
      headers,
      aws: { signQuery: true, allHeaders: true, datetime: stamp() },
    })
    return signed.url
  }
  async function call(
    method: 'HEAD' | 'DELETE' | 'GET' | 'PUT',
    key: string | URL,
    extra: { signal?: AbortSignal; headers?: Record<string, string> } = {},
  ) {
    return fetcher(
      await client.sign((key instanceof URL ? key : objectUrl(key)).toString(), {
        method,
        signal: extra.signal ?? AbortSignal.timeout(READ_TIMEOUT_MS),
        ...(extra.headers ? { headers: extra.headers } : {}),
        aws: { datetime: stamp() },
      }),
    )
  }
  const copy = (fromKey: string, toKey: string) => copyObject(call, pathOf(fromKey).slice(1), toKey)
  const list = (prefix: string, token?: string) =>
    listObjects(url => call('GET', url), objectUrl(''), prefix, token)
  return { objectUrl, presign, call, copy, list }
}

function downloadOf(url: URL, fileName: string, contentType: string) {
  url.searchParams.set('response-content-type', contentType)
  // 공백이 +로 나가면 저장소가 서명할 때와 다른 값으로 읽을 수 있다.
  url.searchParams.set(
    'response-content-disposition',
    `inline;filename*=UTF-8''${encodeURIComponent(fileName)}`,
  )
  return url
}

function modifiedAt(value: string | null) {
  const date = value === null ? null : new Date(value)
  return date !== null && Number.isFinite(date.getTime()) ? date : null
}

export function createR2Storage(
  config: R2Config,
  fetcher: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): FileStorage {
  const { objectUrl, presign, call, copy, list } = r2Access(config, fetcher, now)
  return {
    async uploadUrl(key, contentType) {
      // If-None-Match: *를 서명해 이미 있는 키에는 올리지 못하게 한다(덮어쓰기 금지).
      const headers = { 'Content-Type': contentType, 'If-None-Match': '*' }
      return {
        url: await presign('PUT', objectUrl(key), UPLOAD_SECONDS, headers),
        headers,
        expiresAt: new Date(now().getTime() + UPLOAD_SECONDS * MS_PER_SECOND),
      }
    },
    downloadUrl: (key, fileName, contentType) =>
      presign('GET', downloadOf(objectUrl(key), fileName, contentType), DOWNLOAD_SECONDS),
    async head(key) {
      const response = await call('HEAD', key)
      if (response.status === NOT_FOUND) return null
      if (!response.ok) throw new Error('STORAGE_HEAD_FAILED')
      return {
        size: Number(response.headers.get('content-length') ?? '-1'),
        contentType: response.headers.get('content-type'),
        lastModified: modifiedAt(response.headers.get('last-modified')),
      }
    },
    async read(key) {
      // 저장소가 멈춰도 묶음 하나가 영원히 자리를 잡지 않게 시간을 제한한다.
      const response = await call('GET', key, { signal: AbortSignal.timeout(READ_TIMEOUT_MS) })
      if (response.status === NOT_FOUND) return null
      if (!response.ok) throw new Error('STORAGE_READ_FAILED')
      return new Uint8Array(await response.arrayBuffer())
    },
    copy,
    list,
    async remove(key) {
      const response = await call('DELETE', key)
      if (!response.ok && response.status !== NOT_FOUND) throw new Error('STORAGE_DELETE_FAILED')
    },
  }
}
