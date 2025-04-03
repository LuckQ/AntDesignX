# API模块说明

## 目录结构

- `config.js` - API配置文件，统一管理API的基础URL和密钥
- `chat.js` - 聊天历史管理和消息处理的公共函数
- `model.js` - 模型相关功能和请求函数
- `request.js` - 请求状态管理和中断处理的公共函数

## 配置文件使用说明

`config.js` 文件中包含了API的基础URL和API密钥，方便统一管理和修改。

### 基本用法

```javascript
// 导入API配置
import { API_CONFIG } from './config.js';

// 使用API配置
const url = new URL(`${API_CONFIG.baseURL}/endpoint`);
const headers = {
    'Authorization': `Bearer ${API_CONFIG.apiKey}`
};
```

### 修改配置

当需要更改API的基础URL或API密钥时，只需修改 `config.js` 文件中的配置即可，所有引用此配置的文件都会自动使用新的配置。

### 示例

```javascript
/**
 * API配置文件
 */
export const API_CONFIG = {
    baseURL: 'http://api.example.com/v1',
    apiKey: 'your-api-key'
};
``` 