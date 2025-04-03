# AntDesignX - 基于Vue 3和Ant Design的AI聊天应用

## 项目概述

AntDesignX是一个基于Vue 3和Ant Design Vue构建的现代化AI聊天应用程序。该应用使用Dify API作为后端，提供了流畅的聊天体验，支持多会话管理、消息历史记录查看、实时流式响应等功能。项目采用了最新的前端技术栈，具有响应式布局设计，适合各种设备使用。

## 技术栈

- **前端框架**：Vue 3.5.13 + TypeScript 5.7.2
- **构建工具**：Vite 6.1.0
- **UI组件库**：
  - Ant Design Vue 4.2.6
  - Ant Design X Vue 1.0.7
  - TDesign Vue Next 1.11.4
  - TDesign Mobile Vue 1.8.3
  - TDesign Chat 0.2.3
- **HTTP客户端**：Axios 1.8.4
- **路由管理**：Vue Router 4.5.0
- **标记语言解析**：Marked 15.0.7
- **数据处理**：ExcelJS 4.4.0（Excel文件解析和处理）
- **AI集成**：OpenAI API 4.86.1 + Dify API

## 项目结构

```
├── public/              # 静态资源
├── src/                 # 源代码
│   ├── app/             # 应用相关组件
│   │   ├── index/       # 主要应用页面
│   │   │   ├── comps/   # 页面组件
│   │   │   │   ├── ChatAction.vue  # 聊天操作组件
│   │   │   │   ├── ChatItem.vue    # 聊天消息项组件
│   │   │   │   ├── ChatSender.vue  # 消息发送组件
│   │   │   │   ├── ConversationDrawer.vue # 会话抽屉组件
│   │   │   │   └── HeaderNav.vue   # 头部导航组件
│   │   │   └── index.vue # 主应用页面
│   │   └── test/        # 测试功能组件
│   │       └── index.vue # Excel文件上传与展示组件
│   ├── assets/          # 资源文件(图片、字体等)
│   ├── components/      # 公共组件
│   ├── router/          # 路由配置
│   ├── web/             # Web端相关组件
│   ├── App.vue          # 根组件
│   ├── main.ts          # 入口文件
│   ├── style.css        # 全局样式
│   └── vite-env.d.ts    # Vite环境类型声明
├── static/              # 静态资源
│   └── app/api/         # API接口
│       ├── chat.js      # 聊天相关API和消息处理
│       ├── model.js     # 模型配置和请求处理
│       ├── request.js   # 请求管理和错误处理
│       └── theme.js     # 主题管理
├── index.html           # HTML入口
├── package.json         # 项目依赖
├── tsconfig.json        # TypeScript配置
├── tsconfig.app.json    # 应用TypeScript配置
├── tsconfig.node.json   # Node环境TypeScript配置
└── vite.config.ts       # Vite配置
```

## 主要功能

### 1. 智能对话系统
- 集成Dify API进行AI对话
- 支持流式响应，实时显示AI回复
- 展示AI思考过程（reasoning模式）
- 建议问题提示

### 2. 会话管理
- 创建新会话
- 查看历史会话列表
- 按时间分组显示会话（今天、昨天、过去7天、更早）
- 重命名会话
- 删除会话
- 固定重要会话
- 自动会话命名

### 3. 消息历史
- 查看历史消息记录
- 滚动加载更多历史消息
- 清除对话历史
- 支持分页加载会话历史

### 4. 用户界面
- 响应式设计，适配不同设备
- 支持亮色/暗色主题切换
- 侧边会话抽屉
- 消息评价功能（点赞/点踩）
- 流式加载动画效果

### 5. 数据管理
- 本地和服务器双重存储
- 自动保存会话历史
- 用户ID管理
- 安全的API请求和响应处理

### 6. Excel文件处理
- 使用TDesign上传组件支持拖拽或点击上传Excel文件（.xlsx, .xls格式）
- 独立的Excel处理工具模块，使用ExcelJS库支持：
  - Promise风格的文件解析
  - 支持读取多个工作表
  - 直接在控制台输出Excel数据
  - 支持复杂Excel格式（富文本、公式、日期等）
- 高效的数据分块处理功能：
  - 最多分100块，最小块大小500条
  - 每块包含相邻块的上下10行重叠数据
  - 自动计算最佳分块大小和数量
  - 支持大数据量Excel文件处理
- **大型Excel文件处理优化**：
  - 利用Web Worker在后台线程处理大型文件（>10MB）
  - 支持ES模块方式的Web Worker
  - 使用ExcelJS进行线程安全处理
  - 实时进度显示和阶段提示
  - 内存管理功能，允许手动释放内存
  - 自动检测大文件并给予用户警告
  - 根据文件大小智能选择处理策略
- 在页面上直观展示分块统计信息
- 在控制台格式化输出每个数据块内容和统计信息

### 7. 数据管理
- 本地和服务器双重存储
- 自动保存会话历史
- 用户ID管理
- 安全的API请求和响应处理

### 8. 用户界面
- 响应式设计，适配不同设备
- 支持亮色/暗色主题切换
- 侧边会话抽屉
- 消息评价功能（点赞/点踩）
- 流式加载动画效果

### 9. Excel文件处理
- 访问 `/test/index` 路径进入Excel处理页面
- 点击或拖拽Excel文件到上传区域
- 系统会自动解析Excel文件并分块处理
- 对于大型Excel文件（>10MB）：
  - 使用Web Worker在后台线程处理，避免页面卡死
  - 显示实时进度条和处理阶段信息
  - 处理完成后可通过"清理内存"按钮释放资源
- 页面上显示文件基本信息和分块统计数据
- 控制台输出各数据块的详细内容
- 分块处理支持大型Excel文件，避免浏览器性能问题

## 安装与运行

### 前提条件
- Node.js 18.x或更高版本
- npm 9.x或更高版本

### 安装步骤

1. 克隆项目仓库
```bash
git clone https://github.com/your-username/AntDesignX.git
cd AntDesignX
```

2. 安装依赖
```bash
npm install
```

3. 配置API密钥
修改`static/app/api/model.js`文件中的API配置：
```javascript
export const modelConfig = {
    'dify-api': {
        instance: {
            baseURL: 'YOUR_DIFY_API_URL',
            apiKey: 'YOUR_DIFY_API_KEY',
            dangerouslyAllowBrowser: true
        },
        description: 'Dify API 模型'
    }
};
```

4. 启动开发服务器
```bash
npm run dev
```

5. 构建生产版本
```bash
npm run build
```

6. 预览生产版本
```bash
npm run preview
```

## 使用说明

1. 打开应用后，默认会加载最近的对话或创建新对话
2. 在输入框中输入问题并发送
3. AI会实时流式生成回复，同时可显示思考过程
4. 使用左上角菜单可以查看和管理所有对话
5. 可以重命名、删除、固定或创建新对话
6. 可以通过主题设置切换亮色/暗色模式
7. 消息发送后可进行评价（点赞/点踩）
8. 滚动到聊天记录顶部可加载更多历史消息
9. Excel文件处理：
   - 访问 `/test/index` 路径进入Excel处理页面
   - 点击或拖拽Excel文件到上传区域
   - 系统会自动解析Excel文件并分块处理
   - 对于大型Excel文件（>10MB）：
     - 使用Web Worker在后台线程处理，避免页面卡死
     - 显示实时进度条和处理阶段信息
     - 处理完成后可通过"清理内存"按钮释放资源
   - 页面上显示文件基本信息和分块统计数据
   - 控制台输出各数据块的详细内容
   - 分块处理支持大型Excel文件，避免浏览器性能问题

## 开发者说明

- 项目使用Vue 3的组合式API和`<script setup>`语法
- 使用TypeScript提供类型检查
- API接口集成在static/app/api目录下
- 工具类定义在src/utils目录下
  - excelHandler.js提供Excel文件处理功能和数据分块算法
  - excelWorker.js实现ES模块方式的Web Worker，使用ExcelJS库后台处理大型Excel文件
- 核心性能优化：
  - 多线程处理：将耗时任务转移到Web Worker线程
  - 增量处理：先读取文件结构，再读取完整内容
  - ES模块Worker：支持更现代的模块导入方式
  - 内存管理：提供手动释放内存机制
  - 使用ExcelJS高效处理Excel文件，支持复杂格式
- 主要应用逻辑在src/app/index/index.vue文件中
- 使用AbortController管理请求取消
- 聊天消息采用自定义格式，支持思考过程和建议问题

## 许可证

[MIT License](LICENSE)
