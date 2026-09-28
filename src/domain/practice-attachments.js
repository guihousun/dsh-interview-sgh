import { assertDomain } from './errors.js'

export const DOCUMENT_LIMITS = Object.freeze({ fileBytes: 10 * 1024 * 1024, pages: 100, text: 60000, references: 8, referenceText: 180000 })
export const DOCUMENT_ACCEPT = '.pdf,.docx,.txt,.md,.markdown'
export const DOCUMENT_TYPES = Object.freeze(['pdf', 'docx', 'txt', 'md', 'markdown'])

export function documentName(value) {
  return String(value || '').split(/[\\/]/).at(-1).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 180)
}

export function normalizeDocumentInfo(value) {
  assertDomain(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_DOCUMENT', '资料信息格式不正确')
  const name = documentName(value.name)
  const type = name.split('.').at(-1).toLowerCase()
  assertDomain(name && DOCUMENT_TYPES.includes(type), 'UNSUPPORTED_DOCUMENT', '支持 PDF、DOCX、TXT 和 Markdown 文件')
  const size = Number(value.size || 0)
  assertDomain(Number.isSafeInteger(size) && size >= 0 && size <= DOCUMENT_LIMITS.fileBytes, 'DOCUMENT_TOO_LARGE', '单份资料不能超过 10 MB')
  const pages = value.pages === undefined ? undefined : Number(value.pages)
  assertDomain(pages === undefined || (Number.isSafeInteger(pages) && pages > 0 && pages <= DOCUMENT_LIMITS.pages), 'DOCUMENT_TOO_MANY_PAGES', 'PDF 不能超过 100 页')
  return { name, type, size, ...(pages === undefined ? {} : { pages }) }
}

export function normalizeReferenceMaterials(value) {
  if (value === undefined || value === null) return []
  assertDomain(Array.isArray(value), 'INVALID_REFERENCE_MATERIALS', '参考资料必须是列表')
  assertDomain(value.length <= DOCUMENT_LIMITS.references, 'TOO_MANY_REFERENCE_MATERIALS', '最多添加 8 份参考资料')
  const materials = value.map((item, index) => {
    const info = normalizeDocumentInfo(item)
    const text = typeof item.text === 'string' ? item.text.replace(/\r\n?/g, '\n').trim() : ''
    assertDomain(text, 'EMPTY_DOCUMENT_TEXT', `“${info.name}”没有可供面试使用的文字`)
    assertDomain(text.length <= DOCUMENT_LIMITS.text, 'DOCUMENT_TEXT_TOO_LONG', '单份资料文字不能超过 60000 字符')
    const id = typeof item.id === 'string' && /^[\w-]{1,100}$/.test(item.id) ? item.id : `reference-${index + 1}`
    return { id, ...info, text }
  })
  assertDomain(materials.reduce((sum, item) => sum + item.text.length, 0) <= DOCUMENT_LIMITS.referenceText, 'REFERENCE_TEXT_TOO_LONG', '参考资料合计不能超过 180000 字符，请精简后再添加')
  return materials
}

export function withPracticeAttachments(input, config) {
  const referenceMaterials = normalizeReferenceMaterials(input.referenceMaterials)
  assertDomain(!config.resume || config.resume.length <= DOCUMENT_LIMITS.text, 'RESUME_TOO_LONG', '简历文字不能超过 60000 字符')
  return {
    ...config,
    ...(config.resume && input.resumeFile ? { resumeFile: normalizeDocumentInfo(input.resumeFile) } : {}),
    ...(referenceMaterials.length ? { referenceMaterials } : {}),
  }
}
