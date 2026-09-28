import review from '../data/reviewed-leetcode-code.json' with { type: 'json' }

const entriesBySlug = new Map()
const byId = new Map(review.entries.map((entry) => [entry.id, entry]))
for (const entry of review.entries) {
  if (!entriesBySlug.has(entry.slug)) entriesBySlug.set(entry.slug, [])
  entriesBySlug.get(entry.slug).push(entry)
}

const normalized = (code) => typeof code === 'string' ? code.replace(/\r\n/g, '\n').trim() : ''
const matches = (entry, code) => [entry.original, entry.code, entry.annotatedOriginal].some((known) => normalized(known) === normalized(code))

const STEPS = Object.freeze({
  'code-034': '1. 用第一个数初始化当前结尾最大和与全局最大和。\n2. 逐个比较“重新开始”和“接上前段”两种选择。\n3. 每次更新全局最大值；按下标遍历，不复制切片。',
  'code-055': '1. 用显式栈一路压入左侧节点。\n2. 按中序弹出节点，检查当前值严格大于上一个值。\n3. 转向右子树，直到所有节点检查完。',
  'code-058': '1. 根节点以第 1 层入栈。\n2. 弹出节点时更新最大层数。\n3. 非空孩子以“父层数+1”入栈。',
  'code-060': '1. 前序第一个值创建根节点，维护祖先栈和中序游标。\n2. 栈顶还未到其中序位置时，下一值接为左孩子。\n3. 否则按中序回退已完成的祖先，把下一值接为最后回退节点的右孩子。',
  'code-066': '1. 用进入/结算两种状态完成后序遍历。\n2. 负的孩子贡献视为 0，更新左右链同时经过当前节点的路径和。\n3. 向父节点只保留较大的一条链，使用完的孩子临时值删除。',
  'code-083': '1. k 对数组长度取余。\n2. 用双指针原地反转整个数组。\n3. 分别原地反转前 k 个元素和剩余元素。',
  'code-085': '1. 队列按先左后右保存每层节点。\n2. 固定本层节点数，将孩子留到下一层。\n3. 每层最后取出的节点加入右视图。',
  'code-086': '1. 扫描网格，每个未访问陆地开始一座新岛。\n2. 将陆地入栈时立即标记为已访问。\n3. 用循环探索上下左右相连陆地，避免深递归。',
  'code-092': '1. 用最小值作下标偏移，统计有界值域中的出现次数。\n2. 从最大值向最小值遍历计数，逐次扣减 k。\n3. k 首次不大于 0 的数值即为第 k 大，重复数字分别占名次。',
  'code-095': '1. 快慢指针定位前半段末尾。\n2. 迭代反转后半段，与前半段逐一比较。\n3. 记录比较结果，重新反转并接回后半段后返回。',
  'code-096': '1. 显式遍历，记录每个节点的父节点。\n2. 收集 p 本身与全部祖先。\n3. 从 q 向上找第一个在集合中的节点。',
  'code-108': '1. 用 Counter 统计每个数字的出现次数。\n2. 把数字放入对应频率下标的桶。\n3. 从高频到低频收集数字，到 k 个立即返回。',
  'code-111': '1. 空前缀计数初始化为 1。\n2. 进入节点时先查询“当前前缀-目标值”，再记录当前前缀。\n3. 离开节点时撤销计数，保证其他分支不会混入当前路径。',
  'code-113': '1. 显式后序遍历，先取得左右子树高度。\n2. 用左右高度之和更新最长路径的边数。\n3. 当前高度取较大子树高度加 1，并删除孩子的临时结果。',
})

export const referenceCodeReview = Object.freeze({
  reviewedAt: review.reviewedAt,
  problemCount: entriesBySlug.size,
  originalVersions: review.entries.length,
})

// 只应用逐份审核过的精确版本。用户后来改过的实现不会被旧题解强行覆盖。
export function reviewReferenceCode(reference) {
  const entries = entriesBySlug.get(reference.slug) || []
  if (!entries.length) return reference
  const find = (code) => normalized(code) ? entries.find((entry) => matches(entry, code)) : null
  const originalVariants = reference.variants || []
  const variants = originalVariants.map((variant) => {
    const entry = find(variant.code)
    if (!entry) return variant
    const preserve = entry.preserveAlternative === true
    return { ...variant, code: preserve ? entry.annotatedOriginal : entry.code,
      ...(!preserve && entry.complexity ? { complexity: entry.complexity } : {}) }
  })
  const main = find(reference.code)
  const result = { ...reference, variants }
  if (main) {
    if (main.preserveAlternative && !variants.some((variant) => normalized(variant.code) === normalized(main.annotatedOriginal))) {
      variants.push({ kind: '最小堆（学习版）', idea: '便于理解的替代方案；时间界不满足本题全部要求，正式作答使用上面的主答案。',
        code: main.annotatedOriginal, complexity: main.originalComplexity })
    }
    result.code = main.code
    if (main.complexity) result.complexity = main.complexity
    if (main.idea) result.idea = main.idea
    if (main.changedAlgorithm && STEPS[main.id]) result.steps = STEPS[main.id]
  } else if (!normalized(reference.code)) {
    const preferred = byId.get(review.defaults[reference.slug])
    const fromVariant = preferred && variants.find((variant) => matches(preferred, variant.code))
    if (fromVariant) {
      result.code = preferred.code
      result.idea = fromVariant.idea || result.idea
      result.complexity = preferred.complexity || fromVariant.complexity
    }
  }
  const hardcode = reference.hardcode
  const standalone = hardcode && find(hardcode.code)
  if (standalone) {
    result.hardcode = { ...hardcode, code: standalone.code }
    if (standalone.id === 'code-059') result.hardcode.pseudocode = '空树返回 0\n把 (根, 1) 压入栈\n循环取出节点和层数，更新最大层数，并把孩子以层数+1压入栈\n返回最大层数'
    if (standalone.id === 'code-087') result.hardcode.pseudocode = '扫描每个格子\n遇到未访问陆地时，岛屿数量+1\n把陆地压入栈并立即标记\n循环处理栈内格子，把上下左右的未访问陆地也标记并压入栈\n返回岛屿数量'
  }
  return result
}
