import { parentPort, workerData } from 'node:worker_threads'
import { DOCUMENT_LIMITS } from '../domain/practice-attachments.js'
import { DomainError } from '../domain/errors.js'

function checkDocxArchive(bytes) {
  // 在解压前检查 ZIP 目录中的展开大小，资料提取只接收完整的普通 DOCX。
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end -= 1
  if (end < 0 || end < bytes.length - 65557) throw new DomainError('INVALID_DOCX', 'DOCX 文件损坏或格式不正确')
  const count = bytes.readUInt16LE(end + 10)
  let offset = bytes.readUInt32LE(end + 16)
  if (count > 512) throw new DomainError('DOCUMENT_TOO_COMPLEX', 'Word 文件内容过多，请精简后上传')
  let expanded = 0
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw new DomainError('INVALID_DOCX', 'DOCX 文件损坏或格式不正确')
    expanded += bytes.readUInt32LE(offset + 24)
    if (expanded > 32 * 1024 * 1024) throw new DomainError('DOCUMENT_TOO_COMPLEX', 'Word 文件展开后过大，请精简后上传')
    offset += 46 + bytes.readUInt16LE(offset + 28) + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32)
  }
}

async function extract(bytes, info) {
  let text = ''
  let pages
  const warnings = []
  if (info.type === 'pdf') {
    if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new DomainError('INVALID_PDF', '文件不是有效的 PDF')
    const { getDocumentProxy, extractText } = await import('unpdf')
    let pdf
    try {
      pdf = await getDocumentProxy(new Uint8Array(bytes), { isEvalSupported: false, useWorkerFetch: false, verbosity: 0 })
      pages = pdf.numPages
      if (pages > DOCUMENT_LIMITS.pages) throw new DomainError('DOCUMENT_TOO_MANY_PAGES', 'PDF 不能超过 100 页，请拆分后上传')
      const extracted = await extractText(pdf, { mergePages: false })
      text = extracted.text.join('\n\n')
      const emptyPages = extracted.text.filter((page) => !page.trim()).length
      if (emptyPages === pages) throw new DomainError('PDF_OCR_REQUIRED', '这个 PDF 没有可提取的文字，可能是扫描版。请先做 OCR，或直接粘贴简历文字。')
      if (emptyPages) warnings.push(`${emptyPages} 页未提取到文字，可能是图片或空白页，请核对内容。`)
    } catch (error) {
      if (error?.name === 'PasswordException') throw new DomainError('PDF_PASSWORD_REQUIRED', 'PDF 有密码保护，请先解密后再上传')
      throw error
    } finally { await pdf?.loadingTask?.destroy() }
  } else if (info.type === 'docx') {
    checkDocxArchive(bytes)
    const { default: mammoth } = await import('mammoth')
    text = (await mammoth.extractRawText({ buffer: bytes }, { externalFileAccess: false })).value
  } else {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder('utf-16le').decode(bytes)
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder('utf-16be').decode(bytes)
    else {
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { text = new TextDecoder('gb18030', { fatal: true }).decode(bytes) }
    }
    if (text.includes('\u0000')) throw new DomainError('INVALID_TEXT_DOCUMENT', '这个文件不像纯文本资料，请使用 PDF、DOCX、TXT 或 Markdown')
  }
  text = text.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim()
  if (!text) throw new DomainError('EMPTY_DOCUMENT_TEXT', '没有提取到文字，请检查文件内容或直接粘贴文字')
  if (text.length > DOCUMENT_LIMITS.text) throw new DomainError('DOCUMENT_TEXT_TOO_LONG', '单份资料文字超过 60000 字符，请拆分或精简后上传')
  return { text, ...(pages ? { pages } : {}), warnings }
}

try {
  const result = await extract(Buffer.from(workerData.bytes), workerData.info)
  parentPort.postMessage({ result })
} catch (error) {
  parentPort.postMessage({ error: error instanceof DomainError ? { code: error.code, message: error.message } : { code: 'DOCUMENT_PARSE_FAILED', message: '资料解析失败，请确认文件完好、格式正确后重试' } })
}
