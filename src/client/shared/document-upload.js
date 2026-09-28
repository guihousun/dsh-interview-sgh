import { DOCUMENT_LIMITS, DOCUMENT_TYPES } from '../../domain/practice-attachments.js'

export function readDocumentUpload(file) {
  const type = file.name.split('.').at(-1).toLowerCase()
  if (!DOCUMENT_TYPES.includes(type)) return Promise.reject(new Error('支持 PDF、DOCX、TXT 和 Markdown 文件'))
  if (file.size > DOCUMENT_LIMITS.fileBytes) return Promise.reject(new Error('单份资料不能超过 10 MB'))
  if (!file.size) return Promise.reject(new Error('文件为空，请重新选择'))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('无法读取文件，请重新选择'))
    reader.onabort = () => reject(new Error('文件读取已取消'))
    reader.onload = () => resolve({ name: file.name, data: String(reader.result).split(',')[1] })
    reader.readAsDataURL(file)
  })
}
