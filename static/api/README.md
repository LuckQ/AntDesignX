# API模块说明

## 目录结构

- `config.js` - API配置文件，统一管理API的基础URL和密钥
- `chat.js` - 聊天历史管理和消息处理的公共函数
- `model.js` - 模型相关功能和请求函数
- `request.js` - 请求状态管理和中断处理的公共函数
- `dataset.js` - 知识库管理API，提供对知识库的创建、查询、更新和删除操作

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
    apiKey: 'your-api-key',
    // 知识库API配置
    datasetBaseURL: 'http://dataset-api.example.com/v1',
    datasetApiKey: 'your-dataset-api-key'
};
```

## 知识库API使用说明

`dataset.js` 文件中包含了知识库管理的相关API，可以用于创建、查询、更新和删除知识库，以及管理知识库中的文档。

### 主要功能

- 知识库管理：创建、获取、更新、删除知识库
- 文档管理：上传文档、创建文本文档、删除文档、获取文档列表
- 文档分段：获取文档分段信息
- 知识库搜索：基于语义搜索知识库内容

### 基本用法

```javascript
// 导入知识库API
import { 
    getDatasetList, 
    createDataset, 
    getDocumentList, 
    createTextDocument,
    searchDataset 
} from './dataset.js';

// 获取知识库列表
const datasets = await getDatasetList();

// 创建知识库
const newDataset = await createDataset({
    name: '测试知识库',
    description: '这是一个测试用的知识库',
    indexing_technique: 'high_quality'
});

// 获取知识库中的文档列表
const documents = await getDocumentList(datasetId);

// 创建文本文档
const newDocument = await createTextDocument(datasetId, {
    name: '文档名称',
    text: '文档内容'
});

// 搜索知识库
const searchResults = await searchDataset(datasetId, {
    query: '搜索关键词',
    top_k: 5,
    reranking: true
});
```

## 文件操作相关API

### 文件上传API

**端点**: `/base_agent/upload-file`
**方法**: `POST`
**格式**: `multipart/form-data`

请求参数:
- `file`: 文件对象（必需）
- `user_id`: 用户ID（必需）

响应示例:
```json
{
  "file": {
    "file_id": "f1234567890abcdef",
    "user_id": "user123",
    "filename": "example.pdf",
    "file_path": "/storage/uploads/example.pdf",
    "file_size": 12345,
    "file_type": "application/pdf",
    "upload_time": "2023-11-15T10:30:00",
    "metadata": {}
  },
  "status": "success",
  "message": "文件上传成功"
}
```

### 文件列表API

**端点**: `/base_agent/list-files`
**方法**: `GET`

查询参数:
- `user_id`: 用户ID（必需）
- `page`: 页码，默认为1
- `page_size`: 每页数量，默认为10

响应示例:
```json
{
  "files": [
    {
      "file_id": "f1234567890abcdef",
      "user_id": "user123",
      "filename": "example.pdf",
      "file_size": 12345,
      "file_type": "application/pdf",
      "upload_time": "2023-11-15T10:30:00"
    }
  ],
  "total": 15,
  "page": 1,
  "page_size": 10,
  "status": "success"
}
```

### 文件详情API

**端点**: `/base_agent/file-detail/{file_id}`
**方法**: `GET`

查询参数:
- `user_id`: 用户ID（必需）

响应示例:
```json
{
  "file": {
    "file_id": "f1234567890abcdef",
    "user_id": "user123",
    "filename": "example.pdf",
    "file_path": "/storage/uploads/example.pdf",
    "file_size": 12345,
    "file_type": "application/pdf",
    "upload_time": "2023-11-15T10:30:00",
    "metadata": {
      "pages": 5,
      "author": "Test User"
    }
  },
  "status": "success"
}
```

### 文件下载API

**端点**: `/base_agent/download-file/{file_id}`
**方法**: `GET`

查询参数:
- `user_id`: 用户ID（必需）

响应: 文件内容（二进制流）

### 文件删除API

**端点**: `/base_agent/delete-file/{file_id}`
**方法**: `DELETE`

查询参数:
- `user_id`: 用户ID（必需）

响应示例:
```json
{
  "status": "success",
  "message": "文件删除成功",
  "file_id": "f1234567890abcdef"
}
```

### 附加文件到消息API

**端点**: `/base_agent/attach-files`
**方法**: `POST`
**格式**: `application/json`

请求体:
```json
{
  "file_ids": ["f1234567890abcdef", "f0987654321fedcba"],
  "message_id": "msg123456",
  "user_id": "user123"
}
```

响应示例:
```json
{
  "status": "success",
  "message": "文件已成功附加到消息",
  "message_id": "msg123456",
  "file_ids": ["f1234567890abcdef", "f0987654321fedcba"]
}
``` 