// 0.1.7 将当前视图所有权移入 retainedBy；兼容旧版 current，绝不猜测其他会话。
export function currentInterviewSession(state) {
  if (typeof state?.current === 'string' && state.current) return state.current
  const selected = Object.values(state?.byId || {}).filter((session) => session?.retainedBy?.mainView > 0)
  return selected.length === 1 ? selected[0].id : undefined
}
