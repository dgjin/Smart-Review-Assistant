
# 详细设计说明书 (SDS) - 智能审查助手

## 1. 架构设计
系统采用 **Client-Side SPA (单页应用)** 架构，通过适配器模式直接与 Gemini 多模型 API 交互。

### 1.1 三模型协同策略
- **推理引擎 (Gemini 3 Pro)**：负责“审查意见拟定”，提供深度合规逻辑。
- **效率引擎 (Gemini 3 Flash)**：负责“极速 OCR”、“内容摘要”与“知识检索”。
- **创意引擎 (Gemini 2.5 Flash Image)**：负责“创意隐喻视觉”与“海报生成”。

## 2. 核心模块详细设计

### 2.1 内容提炼引擎 (ContentDistiller.tsx)
- **紧凑布局设计**：采用 24-32px 宽度的超薄侧边栏，仅保留核心维度图标（Book, Bolt, Map, Sparkles, Presentation, Photo），释放屏幕中心区域进行沉浸式分析。
- **双模渲染器**：
    - **文本模式 (Text Mode)**：标准的 Markdown 渲染，适用于快速校对。
    - **创意模式 (Visual Mode)**：动态信息流渲染，包含背景毛玻璃效果、AI 生成的抽象隐喻图。
- **SWOT 矩阵算法**：前端通过正则表达式 (`/\[Strengths\]/i` 等) 解析 AI 输出的结构化文本，并将其映射至 2x2 的可视化看板中。

### 2.2 视觉生成流水线 (services/geminiService.ts)
`generateCreativeVisual` 采用了 **“语义桥接”** 技术：
1.  **关键词提取**：Gemini 3 Flash 解析原始分析文本，提取出核心战略意图（如“增长”、“稳健”、“突破”）。
2.  **Prompt 工程**：自动构建专业的 3D 艺术风格提示词（如 *“Minimalist abstract 3D, soft studio lighting, high contrast”*）。
3.  **多模态生成**：调用 Gemini 2.5 Flash Image 输出 Base64 图片流。
4.  **缓存机制**：前端 React State 使用 `visualData` 字典缓存已生成的图片，避免重复调用 API 导致延迟。

### 2.3 知识召回增强 (RAG-Lite)
- **Top-N 过滤**：`getRelevantContext` 函数实现了轻量级语义得分机制。
- **权重策略**：标题匹配权重 (10x) 高于内容匹配 (2x)，显著提升在大规模规则库下的检索精准度与上下文填充效率。

## 3. UI/UX 设计规范
- **色彩规范**：
    - 主色：深蓝色 (`bg-slate-900`) 与 科技蓝 (`text-blue-600`)。
    - 状态色：风险高 (Red), 中 (Amber), 低 (Emerald)。
- **交互规范**：
    - **抽屉式管理**：历史审查记录采用侧滑抽屉或折叠菜单，节省主操作空间。
    - **沉浸式预览**：全屏模态框 (`fixed inset-0`) 采用 `backdrop-blur-md` 效果，强化视觉重心。

## 4. 数据模型更新 (types.ts)
- `DistillSession`: 新增了 `type` 字段以支持不同维度的提炼。
- `ReviewDocument`: 支持 `extractedText` 可选字段，作为 PDF 多模态解析的 Fallback 方案。

## 5. 导出与存储
- **导出逻辑**：针对 PPT 模式，支持逐页图片的合成下载（当前版本支持单页 Canvas 转 PNG 下载）。
- **本地化存储**：利用 `localStorage` 实现规则库与审查会话的离线持久化，容量限制约 5MB。
