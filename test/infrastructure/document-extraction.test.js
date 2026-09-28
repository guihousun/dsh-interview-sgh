import test from 'node:test'
import assert from 'node:assert/strict'
import { extractUploadedDocument } from '../../src/infrastructure/document-extraction.js'
import { DOCUMENT_LIMITS } from '../../src/domain/practice-attachments.js'
import { textDocx, textPdf, uploaded } from '../support/document-fixtures.js'

test('真实 PDF 提取完整文字与页数，保留段落，空白页明确提示', async () => {
  const result = await extractUploadedDocument(uploaded('简历.PDF', textPdf(['Resume validation\nBackend engineer', 'Cache service\nRedis and Python', ''])))
  assert.equal(result.material.type, 'pdf')
  assert.equal(result.material.pages, 3)
  assert.match(result.material.text, /Resume validation/)
  assert.match(result.material.text, /Redis and Python/)
  assert.equal(result.material.warnings.length, 1)
  assert.match(result.material.warnings[0], /1 页/)
  assert.match(result.material.id, /^file-/)
})

test('真实 DOCX 提取中文正文与段落，而不是上传文件名或空占位', async () => {
  const { material } = await extractUploadedDocument(uploaded('项目介绍.docx', textDocx()))
  assert.match(material.text, /项目说明/)
  assert.match(material.text, /设计缓存服务，使用 Python 与 Redis。/)
  assert.equal(material.type, 'docx')
})

test('TXT、Markdown 支持中文、换行和常见 Windows 文本编码', async () => {
  const utf8 = await extractUploadedDocument(uploaded('notes.md', Buffer.from('# 面试笔记\r\n\r\n不要忽略边界条件。')))
  assert.equal(utf8.material.text, '# 面试笔记\n\n不要忽略边界条件。')
  const utf16 = await extractUploadedDocument(uploaded('resume.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('中文简历', 'utf16le')])))
  assert.equal(utf16.material.text, '中文简历')
  const gb = await extractUploadedDocument(uploaded('notes.txt', Buffer.from([0xd6, 0xd0, 0xce, 0xc4])))
  assert.equal(gb.material.text, '中文')
})

test('纯扫描 PDF、空文件和损坏文件给出可执行的错误', async () => {
  await assert.rejects(extractUploadedDocument(uploaded('scan.pdf', textPdf(['']))), { code: 'PDF_OCR_REQUIRED' })
  await assert.rejects(extractUploadedDocument(uploaded('bad.pdf', Buffer.from('not a PDF'))), { code: 'INVALID_PDF' })
  await assert.rejects(extractUploadedDocument(uploaded('bad.docx', Buffer.from('not a ZIP archive'))), { code: 'INVALID_DOCX' })
  await assert.rejects(extractUploadedDocument(uploaded('empty.txt', Buffer.from('   '))), { code: 'EMPTY_DOCUMENT_TEXT' })
})

test('拒绝不支持的格式、超限文件和过长文本；文件名不变成本地路径', async () => {
  await assert.rejects(extractUploadedDocument(uploaded('script.exe', Buffer.from('fake executable'))), { code: 'UNSUPPORTED_DOCUMENT' })
  await assert.rejects(extractUploadedDocument(uploaded('large.pdf', Buffer.alloc(DOCUMENT_LIMITS.fileBytes + 1))), { code: 'DOCUMENT_TOO_LARGE' })
  await assert.rejects(extractUploadedDocument(uploaded('long.txt', Buffer.from('a'.repeat(DOCUMENT_LIMITS.text + 1)))), { code: 'DOCUMENT_TEXT_TOO_LONG' })
  const result = await extractUploadedDocument(uploaded('../../秘密/参考.md', Buffer.from('项目资料')))
  assert.equal(result.material.name, '参考.md')
  assert.equal(result.material.text, '项目资料')
})

test('DOCX 目录中声明的异常展开大小会在解压前被拒绝', async () => {
  const bytes = textDocx()
  const offset = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  bytes.writeUInt32LE(40 * 1024 * 1024, offset + 24)
  await assert.rejects(extractUploadedDocument(uploaded('oversized.docx', bytes)), { code: 'DOCUMENT_TOO_COMPLEX' })
})
