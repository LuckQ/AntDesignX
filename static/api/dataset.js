/**
 * 知识库管理API
 * 提供对知识库的创建、查询、更新和删除操作
 */

// 导入请求处理工具和API配置
import { createRequestController, handleRequestError, handleRequestComplete } from './request.js';
import { API_CONFIG, createApiUrl } from './config.js';

/**
 * 获取知识库API URL
 * @param {String} path - API路径
 * @returns {String} 完整的API URL
 */
const getDatasetApiUrl = (path) => {
    return createApiUrl(path, API_CONFIG.baseURL).toString();
};

/**
 * 获取知识库API请求头
 * @returns {Object} 请求头对象
 */
const getDatasetApiHeaders = () => {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.datasetApiKey}`
    };
};

/**
 * 获取知识库列表
 * @param {Object} options - 查询选项
 * @param {Number} options.page - 页码，从1开始
 * @param {Number} options.limit - 每页数量
 * @returns {Promise<Object>} 包含知识库列表的响应对象
 */
export const getDatasetList = async (options = {}) => {
    const { page = 1, limit = 20 } = options;
    const { signal } = createRequestController();

    try {
        const url = new URL(getDatasetApiUrl('/datasets'));
        url.searchParams.append('page', page);
        url.searchParams.append('limit', limit);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`获取知识库列表失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('获取知识库列表错误:', error);
        throw error;
    }
};

/**
 * 创建知识库
 * @param {Object} datasetData - 知识库数据
 * @param {String} datasetData.name - 知识库名称
 * @param {String} datasetData.description - 知识库描述
 * @param {String} datasetData.indexing_technique - 索引技术，支持"high_quality"或"economy"
 * @param {String} datasetData.permission - 权限，支持"only_me"或"all_team_members"或"partial_members"
 * @param {String} datasetData.provider - 数据提供者，支持"vendor"或"external"
 * @returns {Promise<Object>} 创建的知识库对象
 */
export const createDataset = async (datasetData) => {
    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl('/datasets'), {
            method: 'POST',
            headers: getDatasetApiHeaders(),
            body: JSON.stringify(datasetData),
            signal
        });

        if (!response.ok) {
            throw new Error(`创建知识库失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('创建知识库错误:', error);
        throw error;
    }
};

/**
 * 更新知识库
 * @param {String} datasetId - 知识库ID
 * @param {Object} datasetData - 要更新的知识库数据
 * @returns {Promise<Object>} 更新后的知识库对象
 */
export const updateDataset = async (datasetId, datasetData) => {
    if (!datasetId) {
        throw new Error('知识库ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}`), {
            method: 'PATCH',
            headers: getDatasetApiHeaders(),
            body: JSON.stringify(datasetData),
            signal
        });

        if (!response.ok) {
            throw new Error(`更新知识库失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('更新知识库错误:', error);
        throw error;
    }
};

/**
 * 删除知识库
 * @param {String} datasetId - 知识库ID
 * @returns {Promise<Object>} 删除结果
 */
export const deleteDataset = async (datasetId) => {
    if (!datasetId) {
        throw new Error('知识库ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}`), {
            method: 'DELETE',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`删除知识库失败: ${response.status}`);
        }

        // 检查响应内容类型和长度
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const text = await response.text();
            // 只有当响应文本不为空时才尝试解析JSON
            return text ? JSON.parse(text) : { success: true };
        } else {
            // 非JSON响应，返回成功状态
            return { success: true };
        }
    } catch (error) {
        console.error('删除知识库错误:', error);
        throw error;
    }
};

/**
 * 获取知识库文档列表
 * @param {String} datasetId - 知识库ID
 * @param {Object} options - 查询选项
 * @param {Number} options.page - 页码，从1开始
 * @param {Number} options.limit - 每页数量
 * @param {String} options.keyword - 搜索关键词(可选)
 * @returns {Promise<Object>} 包含文档列表的响应对象
 */
export const getDocumentList = async (datasetId, options = {}) => {
    if (!datasetId) {
        throw new Error('知识库ID不能为空');
    }

    const { page = 1, limit = 20, keyword } = options;
    const { signal } = createRequestController();

    try {
        const url = new URL(getDatasetApiUrl(`/datasets/${datasetId}/documents`));
        url.searchParams.append('page', page);
        url.searchParams.append('limit', limit);
        if (keyword) {
            url.searchParams.append('keyword', keyword);
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`获取文档列表失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('获取文档列表错误:', error);
        throw error;
    }
};

/**
 * 通过文本创建文档
 * @param {String} datasetId - 知识库ID
 * @param {Object} documentData - 文档数据
 * @param {String} documentData.name - 文档名称
 * @param {String} documentData.text - 文档文本内容
 * @param {String} documentData.indexing_technique - 索引方式
 * @param {String} documentData.doc_form - 索引内容的形式(可选)
 * @param {String} documentData.doc_language - 文档语言(Q&A模式下)
 * @param {Object} documentData.process_rule - 处理规则
 * @returns {Promise<Object>} 创建的文档对象
 */
export const createDocumentByText = async (datasetId, documentData) => {
    if (!datasetId) {
        throw new Error('知识库ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/document/create-by-text`), {
            method: 'POST',
            headers: getDatasetApiHeaders(),
            body: JSON.stringify(documentData),
            signal
        });

        if (!response.ok) {
            throw new Error(`通过文本创建文档失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('通过文本创建文档错误:', error);
        throw error;
    }
};

/**
 * 通过文件创建文档
 * @param {String} datasetId - 知识库ID
 * @param {FormData} formData - 包含文件和元数据的表单数据
 * @returns {Promise<Object>} 上传结果
 */
export const createDocumentByFile = async (datasetId, formData) => {
    if (!datasetId) {
        throw new Error('知识库ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/document/create-by-file`), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_CONFIG.datasetApiKey}`
            },
            body: formData,
            signal
        });

        if (!response.ok) {
            throw new Error(`通过文件创建文档失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('通过文件创建文档错误:', error);
        throw error;
    }
};

/**
 * 通过文本更新文档
 * @param {String} datasetId - 知识库ID
 * @param {String} documentId - 文档ID
 * @param {Object} documentData - 文档数据
 * @returns {Promise<Object>} 更新结果
 */
export const updateDocumentByText = async (datasetId, documentId, documentData) => {
    if (!datasetId || !documentId) {
        throw new Error('知识库ID和文档ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/documents/${documentId}/update-by-text`), {
            method: 'POST',
            headers: getDatasetApiHeaders(),
            body: JSON.stringify(documentData),
            signal
        });

        if (!response.ok) {
            throw new Error(`通过文本更新文档失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('通过文本更新文档错误:', error);
        throw error;
    }
};

/**
 * 通过文件更新文档
 * @param {String} datasetId - 知识库ID
 * @param {String} documentId - 文档ID
 * @param {FormData} formData - 包含文件和元数据的表单数据
 * @returns {Promise<Object>} 更新结果
 */
export const updateDocumentByFile = async (datasetId, documentId, formData) => {
    if (!datasetId || !documentId) {
        throw new Error('知识库ID和文档ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/documents/${documentId}/update-by-file`), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_CONFIG.datasetApiKey}`
            },
            body: formData,
            signal
        });

        if (!response.ok) {
            throw new Error(`通过文件更新文档失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('通过文件更新文档错误:', error);
        throw error;
    }
};

/**
 * 获取文档索引状态（上传进度）
 * @param {String} datasetId - 知识库ID
 * @param {String} batch - 上传文档的批次号
 * @returns {Promise<Object>} 包含索引状态的响应对象
 */
export const getDocumentIndexingStatus = async (datasetId, batch) => {
    if (!datasetId || !batch) {
        throw new Error('知识库ID和批次号不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/documents/${batch}/indexing-status`), {
            method: 'GET',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`获取文档索引状态失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('获取文档索引状态错误:', error);
        throw error;
    }
};

/**
 * 删除文档
 * @param {String} datasetId - 知识库ID
 * @param {String} documentId - 文档ID
 * @returns {Promise<Object>} 删除结果
 */
export const deleteDocument = async (datasetId, documentId) => {
    if (!datasetId || !documentId) {
        throw new Error('知识库ID和文档ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/documents/${documentId}`), {
            method: 'DELETE',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`删除文档失败: ${response.status}`);
        }

        // 检查响应内容类型和长度
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const text = await response.text();
            // 只有当响应文本不为空时才尝试解析JSON
            return text ? JSON.parse(text) : { success: true };
        } else {
            // 非JSON响应，返回成功状态
            return { success: true };
        }
    } catch (error) {
        console.error('删除文档错误:', error);
        throw error;
    }
};

/**
 * 获取文档分段
 * @param {String} datasetId - 知识库ID
 * @param {String} documentId - 文档ID
 * @param {Object} options - 查询选项
 * @param {String} options.keyword - 搜索关键词(可选)
 * @param {String} options.status - 分段状态(可选)
 * @returns {Promise<Object>} 包含分段列表的响应对象
 */
export const getDocumentSegments = async (datasetId, documentId, options = {}) => {
    if (!datasetId || !documentId) {
        throw new Error('知识库ID和文档ID不能为空');
    }

    const { keyword, status } = options;
    const { signal } = createRequestController();

    try {
        const url = new URL(getDatasetApiUrl(`/datasets/${datasetId}/documents/${documentId}/segments`));
        if (keyword) {
            url.searchParams.append('keyword', keyword);
        }
        if (status) {
            url.searchParams.append('status', status);
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`获取文档分段失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('获取文档分段错误:', error);
        throw error;
    }
};

/**
 * 新增文档分段
 * @param {String} datasetId - 知识库ID
 * @param {String} documentId - 文档ID
 * @param {Array} segments - 分段数据数组
 * @returns {Promise<Object>} 创建结果
 */
export const createDocumentSegments = async (datasetId, documentId, segments) => {
    if (!datasetId || !documentId) {
        throw new Error('知识库ID和文档ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/documents/${documentId}/segments`), {
            method: 'POST',
            headers: getDatasetApiHeaders(),
            body: JSON.stringify({ segments }),
            signal
        });

        if (!response.ok) {
            throw new Error(`创建文档分段失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('创建文档分段错误:', error);
        throw error;
    }
};

/**
 * 更新文档分段
 * @param {String} datasetId - 知识库ID
 * @param {String} documentId - 文档ID
 * @param {String} segmentId - 分段ID
 * @param {Object} segment - 分段数据
 * @returns {Promise<Object>} 更新结果
 */
export const updateDocumentSegment = async (datasetId, documentId, segmentId, segment) => {
    if (!datasetId || !documentId || !segmentId) {
        throw new Error('知识库ID、文档ID和分段ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/documents/${documentId}/segments/${segmentId}`), {
            method: 'POST',
            headers: getDatasetApiHeaders(),
            body: JSON.stringify({ segment }),
            signal
        });

        if (!response.ok) {
            throw new Error(`更新文档分段失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('更新文档分段错误:', error);
        throw error;
    }
};

/**
 * 删除文档分段
 * @param {String} datasetId - 知识库ID
 * @param {String} documentId - 文档ID
 * @param {String} segmentId - 分段ID
 * @returns {Promise<Object>} 删除结果
 */
export const deleteDocumentSegment = async (datasetId, documentId, segmentId) => {
    if (!datasetId || !documentId || !segmentId) {
        throw new Error('知识库ID、文档ID和分段ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/documents/${documentId}/segments/${segmentId}`), {
            method: 'DELETE',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`删除文档分段失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('删除文档分段错误:', error);
        throw error;
    }
};

/**
 * 获取上传文件
 * @param {String} datasetId - 知识库ID
 * @param {String} documentId - 文档ID
 * @returns {Promise<Object>} 文件信息
 */
export const getUploadFile = async (datasetId, documentId) => {
    if (!datasetId || !documentId) {
        throw new Error('知识库ID和文档ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/documents/${documentId}/upload-file`), {
            method: 'GET',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`获取上传文件失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('获取上传文件错误:', error);
        throw error;
    }
};

/**
 * 检索知识库
 * @param {String} datasetId - 知识库ID
 * @param {Object} retrievalParams - 检索参数
 * @returns {Promise<Object>} 检索结果
 */
export const retrieveDataset = async (datasetId, retrievalParams) => {
    if (!datasetId) {
        throw new Error('知识库ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/retrieve`), {
            method: 'POST',
            headers: getDatasetApiHeaders(),
            body: JSON.stringify(retrievalParams),
            signal
        });

        if (!response.ok) {
            throw new Error(`检索知识库失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('检索知识库错误:', error);
        throw error;
    }
};

/**
 * 获取知识库元数据列表
 * @param {String} datasetId - 知识库ID
 * @returns {Promise<Object>} 元数据列表
 */
export const getDatasetMetadata = async (datasetId) => {
    if (!datasetId) {
        throw new Error('知识库ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/metadata`), {
            method: 'GET',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`获取知识库元数据列表失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('获取知识库元数据列表错误:', error);
        throw error;
    }
};

/**
 * 添加元数据
 * @param {String} datasetId - 知识库ID
 * @param {Object} metadata - 元数据
 * @returns {Promise<Object>} 创建结果
 */
export const createDatasetMetadata = async (datasetId, metadata) => {
    if (!datasetId) {
        throw new Error('知识库ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/metadata`), {
            method: 'POST',
            headers: getDatasetApiHeaders(),
            body: JSON.stringify(metadata),
            signal
        });

        if (!response.ok) {
            throw new Error(`添加元数据失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('添加元数据错误:', error);
        throw error;
    }
};

/**
 * 更新元数据
 * @param {String} datasetId - 知识库ID
 * @param {String} metadataId - 元数据ID
 * @param {Object} metadata - 更新数据
 * @returns {Promise<Object>} 更新结果
 */
export const updateDatasetMetadata = async (datasetId, metadataId, metadata) => {
    if (!datasetId || !metadataId) {
        throw new Error('知识库ID和元数据ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/metadata/${metadataId}`), {
            method: 'PATCH',
            headers: getDatasetApiHeaders(),
            body: JSON.stringify(metadata),
            signal
        });

        if (!response.ok) {
            throw new Error(`更新元数据失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('更新元数据错误:', error);
        throw error;
    }
};

/**
 * 删除元数据
 * @param {String} datasetId - 知识库ID
 * @param {String} metadataId - 元数据ID
 * @returns {Promise<Object>} 删除结果
 */
export const deleteDatasetMetadata = async (datasetId, metadataId) => {
    if (!datasetId || !metadataId) {
        throw new Error('知识库ID和元数据ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/metadata/${metadataId}`), {
            method: 'DELETE',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`删除元数据失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('删除元数据错误:', error);
        throw error;
    }
};

/**
 * 启用/禁用内置元数据
 * @param {String} datasetId - 知识库ID
 * @param {String} action - 操作，enable或disable
 * @returns {Promise<Object>} 操作结果
 */
export const toggleBuiltInMetadata = async (datasetId, action) => {
    if (!datasetId || !action) {
        throw new Error('知识库ID和操作类型不能为空');
    }

    if (action !== 'enable' && action !== 'disable') {
        throw new Error('操作类型只能是enable或disable');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/metadata/built-in/${action}`), {
            method: 'POST',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`${action === 'enable' ? '启用' : '禁用'}内置元数据失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`${action === 'enable' ? '启用' : '禁用'}内置元数据错误:`, error);
        throw error;
    }
};

/**
 * 更新文档元数据
 * @param {String} datasetId - 知识库ID
 * @param {Array} operationData - 操作数据
 * @returns {Promise<Object>} 更新结果
 */
export const updateDocumentsMetadata = async (datasetId, operationData) => {
    if (!datasetId) {
        throw new Error('知识库ID不能为空');
    }

    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl(`/datasets/${datasetId}/documents/metadata`), {
            method: 'POST',
            headers: getDatasetApiHeaders(),
            body: JSON.stringify({ operation_data: operationData }),
            signal
        });

        if (!response.ok) {
            throw new Error(`更新文档元数据失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('更新文档元数据错误:', error);
        throw error;
    }
};

/**
 * 获取知识库配置选项
 * @returns {Promise<Object>} 配置选项
 */
export const getDatasetConfigOptions = async () => {
    const { signal } = createRequestController();

    try {
        const response = await fetch(getDatasetApiUrl('/datasets/config-options'), {
            method: 'GET',
            headers: getDatasetApiHeaders(),
            signal
        });

        if (!response.ok) {
            throw new Error(`获取知识库配置选项失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('获取知识库配置选项错误:', error);
        throw error;
    }
}; 