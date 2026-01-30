# 详细设计说明书 (SDS) - 智能审查助手

## 1. 架构设计
系统采用 **Client-Side SPA (单页应用)** 架构，逻辑重心位于浏览器端，通过适配器模式直接与 AI Provider 交互。

### 1.1 技术栈
- **核心框架**: React 19 (Hooks) + TypeScript
- **构建工具**: Vite (高性能开发服务器)
- **样式引擎**: Tailwind CSS (Utility-first)
- **文档解析器**:
    - `pdfjs-dist`: 实现浏览器端 PDF 渲染与文本提取。
    - `mammoth`: 实现二进制 DOCX 到 HTML/纯文本的转换。
- **AI 交互**:
    - `@google/genai`: 处理 Gemini SDK 协议。
    - `Native Fetch`: 实现对 OpenAI 兼容格式（DeepSeek）的调用。

## 2. 核心模块设计

### 2.1 AI Service 适配器 (services/geminiService.ts)
设计模式：**适配器模式 (Adapter Pattern)**。
- **统一接口**: 暴露 `extractKeyInformation`, `generateSummary`, `draftReviewOpinion` 三大核心方法。
- **内部封装**: 
    - `buildGeminiPromptParts`: 组装多模态 Parts 数组，支持 `inlineData`。
    - `buildDeepSeekMessages`: 组装标准 ChatML 格式的 `messages` 数组，使用 `extractedText` 作为 fallback。
- **结构化输出**: 利用 Gemini 的 `responseSchema` 强制模型输出 JSON，并对 DeepSeek 的输出进行正则表达式清洗。

### 2.2 文档处理流水线
1.  **File Input**: 获取 `File` 对象。
2.  **Type Routing**: 根据 MIME 类型分流。
3.  **Parallel Parsing**: 
    - `PDF`: 同时生成用于展示和多模态输入的 Base64，以及用于传统模型的纯文本提取。
    - `DOCX`: 将 XML 结构的 Office 文档扁平化为 Markdown 友好的文本。
4.  **State Sync**: 更新 `ReviewDocument` 实体至 React State。

## 3. 领域模型定义 (types.ts)
- `Rule`: 核心资产模型，包含规则原文与分类。
- `ReviewDocument`: 载荷模型，区分原文内容 (`content`) 与辅助提取内容 (`extractedText`)。
- `ExtractedInfo`: 结构化风险模型，定义了字段名、值、原文溯源及风险分级。

## 4. UI/UX 设计规范
- **Sidebar**: 全局状态控制中心（模型选择、语言选择）。
- **Workspace**: 左右分栏布局。左侧为资产管理（上传、列表），右侧为流式处理结果。
- **Focus Mode**: 采用绝对定位的全屏 Modal，用于处理密集型阅读和长篇审查意见的校对。
- **i18n**: 使用常量对象映射，避免复杂的 i18n 库引入，保持系统轻量化。
