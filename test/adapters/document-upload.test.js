import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { registerApiRoutes, readJsonBody } from '../../src/adapters/http/api-routes.js'
import { textPdf, uploaded } from '../support/document-fixtures.js'

test('上传接口能解析真实 PDF，返回文字、文件信息和可识别的错误', async (t) => {
  const routes = new Map()
  registerApiRoutes({ effect: (effect) => effect(), webServer: { register: ({ path, handler }) => routes.set(path, handler) } }, { application: {}, exporter: {} })
  const server = createServer((request, response) => routes.get(new URL(request.url, 'http://local').pathname)(request, response))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/interview/api/materials/extract`
  const parsed = await fetch(url, { method: 'POST', body: JSON.stringify(uploaded('Resume.pdf', textPdf())) })
  assert.equal(parsed.status, 200)
  const { material } = await parsed.json()
  assert.match(material.text, /Backend engineer/)
  assert.equal(material.name, 'Resume.pdf')
  assert.equal(material.pages, 1)
  assert.equal((await fetch(url)).status, 405)
  const malformed = await fetch(url, { method: 'POST', body: '{broken json' })
  assert.equal((await malformed.json()).error.code, 'INVALID_JSON')
  const unsupported = await fetch(url, { method: 'POST', body: JSON.stringify(uploaded('file.exe', Buffer.from('fake executable'))) })
  assert.equal((await unsupported.json()).error.code, 'UNSUPPORTED_DOCUMENT')
})

test('请求体达到大小限制后返回明确错误，后续块不会继续累积或销毁响应连接', async () => {
  const request = Readable.from([Buffer.from('123456'), Buffer.from('789012'), Buffer.alloc(64)])
  await assert.rejects(readJsonBody(request, 10), { code: 'REQUEST_TOO_LARGE' })
  assert.equal(request.readableAborted, false)
})
