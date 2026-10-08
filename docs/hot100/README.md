# Hot100 随插件分发的题解资料

本目录保存 16 个专题的原始题解 Markdown、专题速记总览、简单题独立练习笔记，以及 100 道题的 LeetCode 题面 CSV 快照。题面来源：[LeetCode 热题 100](https://leetcode.cn/studyplan/top-100-liked/)，各题笔记内保留原题链接。它们是离线快照，不代表官方题面永远不变。

插件实际读取的是 [`src/data/hot100-reference-library.json`](../../src/data/hot100-reference-library.json)：包含完整题面、示例、约束、解析、步骤、复杂度、经过审核并补注释的 Python 答案、替代解法及 17 组专题知识。它在原始笔记基础上应用了[题解代码审核](../leetcode-answer-review.md)中的修正。原始笔记保留用于阅读、追溯和重新导入；正式参考答案以发行快照中的审核版为准。

新电脑安装本分支后，插件首次启动会自动把缺失的题解和专题写入本机数据库，无需复制作者的 SQLite、指定个人磁盘路径或联网抓题。重复启动只补缺失记录，已有个人题解不会被覆盖。

如需手动用原始资料重建题解库，在仓库目录运行：

```powershell
node scripts/import-leetcode-reference.mjs --notes docs/hot100 --official csv
```

此命令会覆盖同题已有题解，请在明确需要重新导入时使用。分发数据仅包含公共题目与题解；个人练习、作答、简历、完成状态和 AI 会话/缓存不随包分发。
