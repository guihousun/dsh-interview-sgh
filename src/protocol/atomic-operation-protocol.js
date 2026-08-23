export const ATOMIC_OPERATION_PROTOCOL = 'dsh-interview/atomic-v1'

export function createAtomicOperationResult(operation, result) {
  return {
    protocol: ATOMIC_OPERATION_PROTOCOL,
    operation,
    success: true,
    revision: result.revision ?? 0,
    references: result.references || {},
    resource: result.resource || null,
    instruction: '这是业务操作结果，不会展示 UI。若用户需要查看内容，继续调用对应的 interview_show_* 工具；否则简短确认即可。',
  }
}
