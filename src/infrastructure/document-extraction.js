import { createHash } from 'node:crypto'
import { Worker } from 'node:worker_threads'
import { DomainError } from '../domain/errors.js'
import { DOCUMENT_LIMITS, normalizeDocumentInfo } from '../domain/practice-attachments.js'

export const DOCUMENT_REQUEST_LIMIT = Math.ceil(DOCUMENT_LIMITS.fileBytes * 4 / 3) + 8192
let running = 0

export async function extractUploadedDocument(input) {
  if (typeof input?.data !== 'string' || !input.data || input.data.length > DOCUMENT_REQUEST_LIMIT || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data)) {
    throw new DomainError('INVALID_DOCUMENT_DATA', '上传内容不完整，请重新选择文件')
  }
  const bytes = Buffer.from(input.data, 'base64')
  const info = normalizeDocumentInfo({ name: input.name, size: bytes.length })
  if (!bytes.length) throw new DomainError('EMPTY_DOCUMENT', '文件为空，请重新选择')
  if (running >= 2) throw new DomainError('DOCUMENT_PROCESSOR_BUSY', '正在解析其他资料，请稍后重试')
  running += 1
  try {
    const content = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./document-extraction-worker.js', import.meta.url), {
        workerData: { bytes, info }, resourceLimits: { maxOldGenerationSizeMb: 192 },
      })
      let settled = false
      const finish = (error, result) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        void worker.terminate()
        if (error) reject(error); else resolve(result)
      }
      const timer = setTimeout(() => finish(new DomainError('DOCUMENT_TIMEOUT', '资料解析耗时过长，请拆分文件后重试')), 20000)
      worker.once('message', (message) => finish(message.error ? new DomainError(message.error.code, message.error.message) : null, message.result))
      worker.once('error', () => finish(new DomainError('DOCUMENT_PARSE_FAILED', '资料解析失败，请确认文件完好后重试')))
      worker.once('exit', () => finish(new DomainError('DOCUMENT_PARSE_FAILED', '资料解析中断，请重新选择文件')))
    })
    return { material: { id: `file-${createHash('sha256').update(bytes).digest('hex').slice(0, 24)}`, ...info, ...content } }
  } finally { running -= 1 }
}
