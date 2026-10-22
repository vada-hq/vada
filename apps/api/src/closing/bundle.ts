import { Zip, ZipPassThrough } from 'fflate'
import { EVIDENCE_TYPE_LABEL } from '@vada/contracts'
import type { FileStorage } from '../storage/storage.js'
import type { ExportPhoto } from './export-rows.js'

// 증빙 묶음: ZIP 하나에 감사용 엑셀과 `증빙/{증빙번호}-{순번}_{종류}.jpg`. 사용처·이름은 파일 이름에 넣지 않는다.
// 사진은 R2에서 한 장씩 읽어 압축 없이(JPEG는 이미 압축돼 있다) 흘려보낸다. 받는 쪽이 읽는 만큼만 다음 장을 읽는다.
// 못 읽은 사진은 `빠진 증빙.txt`에 적고 이어 간다. 로그와 응답에 저장소 키와 파일 이름을 넣지 않는다.

export const BUNDLE_LIMIT = { limit: 5, windowMs: 600_000 }
const MISSING_NAME = '빠진 증빙.txt'
const BOM = '﻿'

const photoNameOf = (photo: ExportPhoto) =>
  `증빙/${photo.number}-${photo.seq}_${EVIDENCE_TYPE_LABEL[photo.type]}.jpg`

async function readOne(storage: FileStorage, key: string) {
  try {
    return await storage.read(key)
  } catch {
    // 이 사진만 빠진다. 오류 원문에 키가 들 수 있어 남기지 않는다.
    return null
  }
}

function missingText(names: string[]) {
  const lines = [
    '저장소에서 읽지 못해 이 묶음에 넣지 못한 증빙 사진이에요. 다시 받거나 원본을 따로 모아 주세요.',
    ...names,
  ]
  return new TextEncoder().encode(`${BOM}${lines.join('\r\n')}\r\n`)
}

type BundleInput = {
  workbook: Uint8Array
  workbookName: string
  photos: readonly ExportPhoto[]
  storage: FileStorage
  // 끝나거나 끊기거나 실패하면 한 번 부른다(학생회마다 하나만 도는 자리를 돌려준다).
  onDone: () => void
}

// 압축 없이 담는 ZIP 쓰기. 한 파일을 다 넣고 나서 다음 파일을 넣는다(fflate는 같은 순간에 한 파일만 흘려보낸다).
function zipWriter(
  controller: ReadableStreamDefaultController<Uint8Array>,
  onError: (error: unknown) => void,
) {
  const zip = new Zip((error, chunk) => {
    if (error) {
      controller.error(error)
      onError(error)
    } else controller.enqueue(chunk)
  })
  return {
    add(name: string, body: Uint8Array) {
      const entry = new ZipPassThrough(name)
      zip.add(entry)
      entry.push(body, true)
    },
    end: () => zip.end(),
  }
}

export function bundleStream(input: BundleInput): ReadableStream<Uint8Array> {
  let writer: ReturnType<typeof zipWriter>
  let next = 0
  const missing: string[] = []
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    input.onDone()
  }
  return new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        writer = zipWriter(controller, finish)
        writer.add(input.workbookName, input.workbook)
      } catch (error) {
        controller.error(error)
        finish()
      }
    },
    // 받는 쪽이 읽는 만큼만 불린다. 한 번에 사진 한 장을 읽어 넣는다.
    async pull(controller) {
      try {
        const photo = input.photos[next]
        next += 1
        if (photo) {
          const body = await readOne(input.storage, photo.key)
          if (body) writer.add(photoNameOf(photo), body)
          else missing.push(photoNameOf(photo))
          return
        }
        if (missing.length > 0) writer.add(MISSING_NAME, missingText(missing))
        writer.end()
        controller.close()
        finish()
      } catch (error) {
        controller.error(error)
        finish()
      }
    },
    cancel: finish,
  })
}
