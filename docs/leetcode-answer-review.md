# 热题 100 答案代码审核

审核日期：2026-09-28。逐份阅读本地库中 100 道题的 118 份原有 Python 代码，包括主答案、替代解法和独立示例。5 道只有替代解法的题目补齐主答案，另保留两份最小堆学习对照，最终共 125 份展示代码。另审核 1 份已保存的“移动零”AI 讲解，其中 4 个代码块也补齐了注释。

所有代码都带代码块内部的基础中文注释；已有较完整注释的版本保留并核对。注释解释关键变量、判断依据、状态/指针更新和易错边界，不机械复述每一行。

16 份实现调整了边界或算法（含独立示例）：深递归改为显式栈，移除破坏常数空间的切片，恢复回文链表的输入连接，清理右视图空分支，并让第 K 大与前 K 高频主答案满足题面的时间要求。复杂度按具体 Python 实现核算。

## 验证

- 100 道题、125 份展示代码全部检查 Python 语法和基础注释。
- 本地保存的官方示例核对：311 次，覆盖每一道题和每个代码版本；处理答案顺序、合法回文/BST 多解、原地修改、节点身份与深复制。
- 专项边界：8 项，包括 10000 节点深树、3000 节点构树、1000 节点零值路径及 300×300 连通岛屿。
- 固定随机种子 20260928 的交叉核对：400 次，覆盖第 K 大、轮转、最大子数组和、连续序列和回文链表；链表同时检查连接恢复。
- 结果：0 个失败。验证在本地完成，未提交在线评测，也未执行用户作答。

已保存的 AI 讲解补齐交换/覆盖代码的注释，修正半开区间不变量、覆盖不影响未读数据的原因，以及“一趟遍历不代表数组写入更少”的操作次数说明。原始作答与评分保留。

审核后的精确版本保存在 [reviewed-leetcode-code.json](../src/data/reviewed-leetcode-code.json)，读取和再次导入已知原笔记时自动应用。用户后来改写过的未知实现保留。

AI 后续生成的参考答案/修正版要求基础中文注释；力扣答案保存时检查真实代码注释，字符串中的注释符号、代码外说明和 lint 指令不算注释。

## 逐题记录

“示例核对”次数包括同题不同代码版本。学习对照版的效率限制已注明，主答案按题面要求选择。

| 题号 | 题目 | 展示代码份数 | 示例核对 | 处理 |
| --- | --- | ---: | ---: | --- |
| 1 | [两数之和](https://leetcode.cn/problems/two-sum/) | 2 | 6 | 补齐变量作用、关键判断与更新/边界注释 |
| 2 | [两数相加](https://leetcode.cn/problems/add-two-numbers/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 3 | [无重复字符的最长子串](https://leetcode.cn/problems/longest-substring-without-repeating-characters/) | 2 | 6 | 补齐变量作用、关键判断与更新/边界注释 |
| 4 | [寻找两个正序数组的中位数](https://leetcode.cn/problems/median-of-two-sorted-arrays/) | 3 | 6 | 补齐二分主答案，解释切分计数与空侧哨兵 |
| 5 | [最长回文子串](https://leetcode.cn/problems/longest-palindromic-substring/) | 2 | 4 | 补齐主答案，修正字符串切片额外空间说明 |
| 11 | [盛最多水的容器](https://leetcode.cn/problems/container-with-most-water/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 15 | [三数之和](https://leetcode.cn/problems/3sum/) | 1 | 3 | 补齐指针/去重注释，修正 Python 排序辅助空间 |
| 17 | [电话号码的字母组合](https://leetcode.cn/problems/letter-combinations-of-a-phone-number/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 19 | [删除链表的倒数第 N 个结点](https://leetcode.cn/problems/remove-nth-node-from-end-of-list/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 20 | [有效的括号](https://leetcode.cn/problems/valid-parentheses/) | 2 | 8 | 保留并核对已有注释、状态含义与边界 |
| 21 | [合并两个有序链表](https://leetcode.cn/problems/merge-two-sorted-lists/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 22 | [括号生成](https://leetcode.cn/problems/generate-parentheses/) | 1 | 2 | 解释状态和路径副本，计入构造输出字符串的时间 |
| 23 | [合并 K 个升序链表](https://leetcode.cn/problems/merge-k-sorted-lists/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 24 | [两两交换链表中的节点](https://leetcode.cn/problems/swap-nodes-in-pairs/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 25 | [K 个一组翻转链表](https://leetcode.cn/problems/reverse-nodes-in-k-group/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 31 | [下一个排列](https://leetcode.cn/problems/next-permutation/) | 1 | 3 | 保留并核对已有注释、状态含义与边界 |
| 32 | [最长有效括号](https://leetcode.cn/problems/longest-valid-parentheses/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 33 | [搜索旋转排序数组](https://leetcode.cn/problems/search-in-rotated-sorted-array/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 34 | [在排序数组中查找元素的第一个和最后一个位置](https://leetcode.cn/problems/find-first-and-last-position-of-element-in-sorted-array/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 35 | [搜索插入位置](https://leetcode.cn/problems/search-insert-position/) | 2 | 6 | 补齐变量作用、关键判断与更新/边界注释 |
| 39 | [组合总和](https://leetcode.cn/problems/combination-sum/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 41 | [缺失的第一个正数](https://leetcode.cn/problems/first-missing-positive/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 42 | [接雨水](https://leetcode.cn/problems/trapping-rain-water/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 45 | [跳跃游戏 II](https://leetcode.cn/problems/jump-game-ii/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 46 | [全排列](https://leetcode.cn/problems/permutations/) | 1 | 3 | 保留并核对已有注释、状态含义与边界 |
| 48 | [旋转图像](https://leetcode.cn/problems/rotate-image/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 49 | [字母异位词分组](https://leetcode.cn/problems/group-anagrams/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 51 | [N 皇后](https://leetcode.cn/problems/n-queens/) | 1 | 2 | 核对对角线标识，修正棋盘 O(n²) 空间与输出构造开销 |
| 53 | [最大子数组和](https://leetcode.cn/problems/maximum-subarray/) | 2 | 6 | 按下标遍历，去掉切片辅助空间 |
| 54 | [螺旋矩阵](https://leetcode.cn/problems/spiral-matrix/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 55 | [跳跃游戏](https://leetcode.cn/problems/jump-game/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 56 | [合并区间](https://leetcode.cn/problems/merge-intervals/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 62 | [不同路径](https://leetcode.cn/problems/unique-paths/) | 2 | 8 | 保留并核对已有注释、状态含义与边界 |
| 64 | [最小路径和](https://leetcode.cn/problems/minimum-path-sum/) | 1 | 2 | 保留并核对已有注释、状态含义与边界 |
| 70 | [爬楼梯](https://leetcode.cn/problems/climbing-stairs/) | 2 | 4 | 保留并核对已有注释、状态含义与边界 |
| 72 | [编辑距离](https://leetcode.cn/problems/edit-distance/) | 1 | 2 | 保留并核对已有注释、状态含义与边界 |
| 73 | [矩阵置零](https://leetcode.cn/problems/set-matrix-zeroes/) | 2 | 4 | 补齐变量作用、关键判断与更新/边界注释 |
| 74 | [搜索二维矩阵](https://leetcode.cn/problems/search-a-2d-matrix/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 75 | [颜色分类](https://leetcode.cn/problems/sort-colors/) | 1 | 2 | 保留并核对已有注释、状态含义与边界 |
| 76 | [最小覆盖子串](https://leetcode.cn/problems/minimum-window-substring/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 78 | [子集](https://leetcode.cn/problems/subsets/) | 2 | 4 | 保留并核对已有注释、状态含义与边界 |
| 79 | [单词搜索](https://leetcode.cn/problems/word-search/) | 1 | 3 | 保留并核对已有注释、状态含义与边界 |
| 84 | [柱状图中最大的矩形](https://leetcode.cn/problems/largest-rectangle-in-histogram/) | 1 | 2 | 修正等高柱的栈与左边界注释 |
| 94 | [二叉树的中序遍历](https://leetcode.cn/problems/binary-tree-inorder-traversal/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 98 | [验证二叉搜索树](https://leetcode.cn/problems/validate-binary-search-tree/) | 1 | 2 | 显式中序栈，修复深树递归超限 |
| 101 | [对称二叉树](https://leetcode.cn/problems/symmetric-tree/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 102 | [二叉树的层序遍历](https://leetcode.cn/problems/binary-tree-level-order-traversal/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 104 | [二叉树的最大深度](https://leetcode.cn/problems/maximum-depth-of-binary-tree/) | 2 | 4 | 主答案及示例改为显式栈，修复深树递归超限 |
| 105 | [从前序与中序遍历序列构造二叉树](https://leetcode.cn/problems/construct-binary-tree-from-preorder-and-inorder-traversal/) | 1 | 2 | 显式祖先栈构树，修复长链树递归超限 |
| 108 | [将有序数组转换为二叉搜索树](https://leetcode.cn/problems/convert-sorted-array-to-binary-search-tree/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 114 | [二叉树展开为链表](https://leetcode.cn/problems/flatten-binary-tree-to-linked-list/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 118 | [杨辉三角](https://leetcode.cn/problems/pascals-triangle/) | 1 | 2 | 保留并核对已有注释、状态含义与边界 |
| 121 | [买卖股票的最佳时机](https://leetcode.cn/problems/best-time-to-buy-and-sell-stock/) | 2 | 4 | 补齐变量作用、关键判断与更新/边界注释 |
| 124 | [二叉树中的最大路径和](https://leetcode.cn/problems/binary-tree-maximum-path-sum/) | 1 | 2 | 显式后序遍历，及时清理孩子贡献 |
| 128 | [最长连续序列](https://leetcode.cn/problems/longest-consecutive-sequence/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 131 | [分割回文串](https://leetcode.cn/problems/palindrome-partitioning/) | 1 | 2 | 保留并核对已有注释、状态含义与边界 |
| 136 | [只出现一次的数字](https://leetcode.cn/problems/single-number/) | 2 | 6 | 补齐变量作用、关键判断与更新/边界注释 |
| 138 | [随机链表的复制](https://leetcode.cn/problems/copy-list-with-random-pointer/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 139 | [单词拆分](https://leetcode.cn/problems/word-break/) | 1 | 3 | 计入 Python 字符串切片/哈希的最坏时间 |
| 141 | [环形链表](https://leetcode.cn/problems/linked-list-cycle/) | 1 | 3 | 保留并核对已有注释、状态含义与边界 |
| 142 | [环形链表 II](https://leetcode.cn/problems/linked-list-cycle-ii/) | 1 | 3 | 保留并核对已有注释、状态含义与边界 |
| 146 | [LRU 缓存](https://leetcode.cn/problems/lru-cache/) | 1 | 1 | 保留并核对已有注释、状态含义与边界 |
| 148 | [排序链表](https://leetcode.cn/problems/sort-list/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 152 | [乘积最大子数组](https://leetcode.cn/problems/maximum-product-subarray/) | 1 | 2 | 保留并核对已有注释、状态含义与边界 |
| 153 | [寻找旋转排序数组中的最小值](https://leetcode.cn/problems/find-minimum-in-rotated-sorted-array/) | 1 | 3 | 保留并核对已有注释、状态含义与边界 |
| 155 | [最小栈](https://leetcode.cn/problems/min-stack/) | 1 | 1 | 保留并核对已有注释、状态含义与边界 |
| 160 | [相交链表](https://leetcode.cn/problems/intersection-of-two-linked-lists/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 169 | [多数元素](https://leetcode.cn/problems/majority-element/) | 3 | 6 | 补齐投票主答案，注明题目保证多数元素存在 |
| 189 | [轮转数组](https://leetcode.cn/problems/rotate-array/) | 1 | 2 | 双指针反转，去掉切片以满足 O(1) 额外空间 |
| 198 | [打家劫舍](https://leetcode.cn/problems/house-robber/) | 1 | 2 | 保留并核对已有注释、状态含义与边界 |
| 199 | [二叉树的右视图](https://leetcode.cn/problems/binary-tree-right-side-view/) | 1 | 4 | 移除空 pass 分支，在每层最后节点直接收集答案 |
| 200 | [岛屿数量](https://leetcode.cn/problems/number-of-islands/) | 2 | 4 | 主答案及示例改为显式栈，修复大岛屿递归超限 |
| 206 | [反转链表](https://leetcode.cn/problems/reverse-linked-list/) | 2 | 6 | 保留并核对已有注释、状态含义与边界 |
| 207 | [课程表](https://leetcode.cn/problems/course-schedule/) | 1 | 2 | 保留并核对已有注释、状态含义与边界 |
| 208 | [实现 Trie (前缀树)](https://leetcode.cn/problems/implement-trie-prefix-tree/) | 1 | 1 | 保留并核对已有注释、状态含义与边界 |
| 215 | [数组中的第K个最大元素](https://leetcode.cn/problems/kth-largest-element-in-an-array/) | 2 | 4 | 利用固定有界值域计数，满足线性时间；保留最小堆学习版 |
| 226 | [翻转二叉树](https://leetcode.cn/problems/invert-binary-tree/) | 1 | 3 | 补齐变量作用、关键判断与更新/边界注释 |
| 230 | [二叉搜索树中第 K 小的元素](https://leetcode.cn/problems/kth-smallest-element-in-a-bst/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 234 | [回文链表](https://leetcode.cn/problems/palindrome-linked-list/) | 1 | 2 | 比较后恢复输入链表，包括不匹配分支 |
| 236 | [二叉树的最近公共祖先](https://leetcode.cn/problems/lowest-common-ancestor-of-a-binary-tree/) | 1 | 3 | 父节点表，修复深树递归超限，额外空间明确为 O(n) |
| 238 | [除了自身以外数组的乘积](https://leetcode.cn/problems/product-of-array-except-self/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 239 | [滑动窗口最大值](https://leetcode.cn/problems/sliding-window-maximum/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 240 | [搜索二维矩阵 II](https://leetcode.cn/problems/search-a-2d-matrix-ii/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 279 | [完全平方数](https://leetcode.cn/problems/perfect-squares/) | 1 | 2 | 保留并核对已有注释、状态含义与边界 |
| 283 | [移动零](https://leetcode.cn/problems/move-zeroes/) | 2 | 4 | 补齐变量作用、关键判断与更新/边界注释 |
| 287 | [寻找重复数](https://leetcode.cn/problems/find-the-duplicate-number/) | 3 | 9 | 补齐 O(1) 额外空间的快慢指针主答案 |
| 295 | [数据流的中位数](https://leetcode.cn/problems/find-median-from-data-stream/) | 1 | 1 | 保留并核对已有注释、状态含义与边界 |
| 300 | [最长递增子序列](https://leetcode.cn/problems/longest-increasing-subsequence/) | 2 | 6 | 补齐已有动态规划主答案，核对严格递增与结束位置 |
| 322 | [零钱兑换](https://leetcode.cn/problems/coin-change/) | 1 | 3 | 保留并核对已有注释、状态含义与边界 |
| 347 | [前 K 个高频元素](https://leetcode.cn/problems/top-k-frequent-elements/) | 2 | 6 | 改用 O(n) 频率桶；保留最小堆学习版 |
| 394 | [字符串解码](https://leetcode.cn/problems/decode-string/) | 1 | 4 | 说明重复/拼接成本，复杂度计入中间字符串和展开长度 |
| 416 | [分割等和子集](https://leetcode.cn/problems/partition-equal-subset-sum/) | 1 | 2 | 保留并核对已有注释、状态含义与边界 |
| 437 | [路径总和 III](https://leetcode.cn/problems/path-sum-iii/) | 1 | 2 | 进入/离开事件回溯，修复深树超限和无用前缀计数残留 |
| 438 | [找到字符串中所有字母异位词](https://leetcode.cn/problems/find-all-anagrams-in-a-string/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 543 | [二叉树的直径](https://leetcode.cn/problems/diameter-of-binary-tree/) | 1 | 2 | 显式后序遍历，修复深树递归超限 |
| 560 | [和为 K 的子数组](https://leetcode.cn/problems/subarray-sum-equals-k/) | 1 | 2 | 补齐变量作用、关键判断与更新/边界注释 |
| 739 | [每日温度](https://leetcode.cn/problems/daily-temperatures/) | 1 | 3 | 保留并核对已有注释、状态含义与边界 |
| 763 | [划分字母区间](https://leetcode.cn/problems/partition-labels/) | 1 | 2 | 保留并核对已有注释、状态含义与边界 |
| 994 | [腐烂的橘子](https://leetcode.cn/problems/rotting-oranges/) | 1 | 3 | 保留并核对已有注释、状态含义与边界 |
| 1143 | [最长公共子序列](https://leetcode.cn/problems/longest-common-subsequence/) | 1 | 3 | 保留并核对已有注释、状态含义与边界 |

## 复核与应用

可用 `node scripts/apply-reviewed-reference.mjs --database <数据库> --backup-directory <备份目录>` 应用精确审核版本；脚本先备份，只更新题解字段，不修改练习、作答、题面或刷题进度。

完整题库 JSON 可通过 `python scripts/verify-reviewed-answers.py --references <审核后题库.json> --report <验证报告.json>` 复核。验证脚本以保存的官方示例为依据，额外包含深输入和随机交叉检查。
