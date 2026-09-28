import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmdirSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createPractice } from '../../src/domain/practice.js'
import { SqliteInterviewRepository } from '../../src/infrastructure/sqlite-interview-repository.js'

test('SQLite 重新打开后完整保留简历文件信息和参考资料正文', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-interview-documents-'))
  const path = join(directory, 'interview.sqlite')
  let repository = new SqliteInterviewRepository(path)
  try {
    const practice = createPractice({ id: 'p1', mode: 'resume_drill', now: 1, config: {
      resume: '测试候选人：设计缓存服务。', targetRole: '开发', jobDescriptionProvided: false, focus: '项目难点', difficulty: 'intermediate',
      resumeFile: { name: 'Resume.pdf', size: 1000, pages: 1 },
      referenceMaterials: [{ id: 'file-project', name: '项目说明.md', size: 50, text: '# 项目说明\n缓存的一致性与失败恢复。' }],
    } })
    await repository.commit({ practice })
    repository.close()
    repository = new SqliteInterviewRepository(path)
    assert.deepEqual((await repository.getPractice('p1')).config, practice.config)
  } finally {
    repository.close()
    for (const suffix of ['', '-wal', '-shm']) if (existsSync(path + suffix)) unlinkSync(path + suffix)
    rmdirSync(directory)
  }
})
