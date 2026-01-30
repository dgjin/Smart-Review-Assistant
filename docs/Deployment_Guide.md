# 本地部署与开发指南

## 1. 环境依赖
- **Node.js**: v18.0.0 或更高版本
- **包管理器**: npm 或 pnpm (推荐)
- **API Keys**: 
    - Google Gemini API Key (必选)
    - DeepSeek API Key (可选，用于模型对比)

## 2. 快速启动步骤

### 2.1 获取源码并安装
```bash
# 建议克隆项目后执行
npm install
```

### 2.2 环境变量配置
在项目根目录下创建 `.env` 文件，并填入以下内容：
```env
# Google Gemini 配置
API_KEY=你的_GEMINI_API_KEY

# DeepSeek 配置 (OpenAI 兼容接口)
DEEPSEEK_API_KEY=你的_DEEPSEEK_API_KEY
```

### 2.3 修正构建配置 (Vite)
由于本项目在源码中使用了 `process.env`，需要在 `vite.config.ts` 中进行 `define` 映射：
```typescript
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
    }
  };
});
```

### 2.4 启动开发服务器
```bash
npm run dev
```
访问 `http://localhost:5173` 即可进入系统。

## 3. 文档处理组件注意事项
- **PDF Worker**: 本系统使用的是 `pdfjs-dist` 的 CDN Worker。如果在隔离的内网环境部署，请将 `RuleBase.tsx` 和 `ReviewPanel.tsx` 中的 `workerSrc` 更改为本地路径：
  ```typescript
  // 示例
  lib.GlobalWorkerOptions.workerSrc = '/path/to/local/pdf.worker.min.js';
  ```

## 4. 生产构建
```bash
# 执行构建
npm run build

# 预览构建产物
npm run preview
```
构建产物位于 `dist` 目录，可直接部署至 Nginx、Vercel 或 S3 托管服务。

## 5. 常见问题排查 (FAQ)
- **跨域问题**: DeepSeek API 可能会有 CORS 限制。在本地开发时，Vite 的 `server.proxy` 配置可以解决此问题。
- **PDF 无法解析**: 请确保 PDF 文件非加密状态且包含可提取的文本层。扫描件需要 OCR 预处理（Gemini 多模态可部分解决此问题）。
