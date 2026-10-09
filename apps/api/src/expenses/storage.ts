import { AwsClient } from 'aws4fetch'

export interface StoredObject { size: number; contentType: string | null }
// 영수증 파일 저장소. 파일은 브라우저가 서명 주소로 바로 올리고 받는다.
export interface ReceiptStorage {
  uploadUrl(key: string, contentType: string): Promise<{ url: string; headers: Record<string, string>; expiresAt: Date }>
  downloadUrl(key: string, fileName: string, contentType: string): Promise<string>
  head(key: string): Promise<StoredObject | null>
  remove(key: string): Promise<void>
}
export interface R2Config { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }
export const UPLOAD_SECONDS = 600
export const DOWNLOAD_SECONDS = 300

// 네 값이 모두 있어야 켠다. 하나라도 없으면 영수증 올리기·보기만 막는다.
export function r2ConfigFrom(env: NodeJS.ProcessEnv): R2Config | null {
  const config = { accountId: env.R2_ACCOUNT_ID?.trim() ?? '', accessKeyId: env.R2_ACCESS_KEY_ID?.trim() ?? '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY?.trim() ?? '', bucket: env.R2_BUCKET?.trim() ?? '' }
  return Object.values(config).every(Boolean) ? config : null
}

// Cloudflare R2의 S3 호환 주소에 SigV4로 서명한다. 버킷은 비공개다.
export function createR2Storage(config: R2Config, fetcher: typeof fetch = fetch, now: () => Date = () => new Date()): ReceiptStorage {
  const client = new AwsClient({ accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, service: 's3', region: 'auto' })
  const objectUrl = (key: string) => new URL(`https://${config.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(config.bucket)}/${
    key.split('/').map(encodeURIComponent).join('/')}`)
  const stamp = () => now().toISOString().replace(/[:-]|\.\d{3}/g, '')
  // 서명 주소. 올리기는 Content-Type까지 서명해 다른 형식으로 올리지 못하게 한다.
  async function presign(method: 'PUT' | 'GET', url: URL, seconds: number, headers: Record<string, string> = {}) {
    url.searchParams.set('X-Amz-Expires', String(seconds))
    const signed = await client.sign(url.toString(), { method, headers, aws: { signQuery: true, allHeaders: true, datetime: stamp() } })
    return signed.url
  }
  async function call(method: 'HEAD' | 'DELETE', key: string) {
    return fetcher(await client.sign(objectUrl(key).toString(), { method, aws: { datetime: stamp() } }))
  }
  return {
    async uploadUrl(key, contentType) {
      const headers = { 'Content-Type': contentType }
      return { url: await presign('PUT', objectUrl(key), UPLOAD_SECONDS, headers), headers,
        expiresAt: new Date(now().getTime() + UPLOAD_SECONDS * 1000) }
    },
    async downloadUrl(key, fileName, contentType) {
      const url = objectUrl(key)
      url.searchParams.set('response-content-type', contentType)
      // 공백을 넣지 않는다. 주소에서 +로 나가면 저장소가 서명할 때와 다른 값으로 읽을 수 있다.
      url.searchParams.set('response-content-disposition', `inline;filename*=UTF-8''${encodeURIComponent(fileName)}`)
      return presign('GET', url, DOWNLOAD_SECONDS)
    },
    async head(key) {
      const response = await call('HEAD', key)
      if (response.status === 404) return null
      if (!response.ok) throw new Error('STORAGE_HEAD_FAILED')
      return { size: Number(response.headers.get('content-length') ?? '-1'), contentType: response.headers.get('content-type') }
    },
    async remove(key) {
      const response = await call('DELETE', key)
      if (!response.ok && response.status !== 404) throw new Error('STORAGE_DELETE_FAILED')
    },
  }
}
