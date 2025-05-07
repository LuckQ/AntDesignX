/**
 * 文件操作相关API
 * 主要处理文件上传、下载、列表获取等功能
 */

import { API_CONFIG } from './config.js';
import { createRequestController } from './request.js';

/**
 * 上传文件到服务器
 * @param {File} file - 要上传的文件对象
 * @param {string} userId - 用户ID
 * @param {Object} options - 可选配置项
 * @returns {Promise<Object>} 包含文件信息的响应对象
 */
export const uploadFile = async(file, userId, options = {}) => {
    if (!file || !userId) {
        console.error('上传文件错误: 文件和用户ID不能为空');
        return { status: 'error', message: '文件和用户ID不能为空' };
    }

    try {
        // 创建请求控制器
        const { signal, abortRequest } = createRequestController();

        // 创建FormData对象
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', userId);

        console.log(`正在上传文件 "${file.name}" 到服务器...`);

        // 获取API配置
        const baseURL = API_CONFIG.langchainBaseURL || API_CONFIG.baseURL;

        // 发送请求
        const response = await fetch(`${baseURL}/base_agent/upload-file`, {
            method: 'POST',
            body: formData,
            signal
        });

        // 解析响应
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || `上传文件失败: ${response.status}`);
        }

        console.log('文件上传成功:', result);
        return result;
    } catch (error) {
        console.error('上传文件错误:', error);
        return {
            status: 'error',
            message: error.message || '上传文件失败'
        };
    }
};

/**
 * 获取用户的文件列表
 * @param {string} userId - 用户ID
 * @param {number} page - 当前页码，默认为1
 * @param {number} pageSize - 每页数量，默认为10
 * @returns {Promise<Object>} 文件列表数据
 */
export const getUserFiles = async(userId, page = 1, pageSize = 10) => {
    if (!userId) {
        console.error('获取文件列表错误: 用户ID不能为空');
        return { status: 'error', message: '用户ID不能为空' };
    }

    try {
        // 创建请求控制器
        const { signal } = createRequestController();

        // 获取API配置
        const baseURL = API_CONFIG.langchainBaseURL || API_CONFIG.baseURL;

        // 构建查询参数
        const params = new URLSearchParams({
            user_id: userId,
            page: page,
            page_size: pageSize
        });

        // 发送请求
        const response = await fetch(`${baseURL}/base_agent/list-files?${params}`, {
            method: 'GET',
            signal
        });

        // 解析响应
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || `获取文件列表失败: ${response.status}`);
        }

        return result;
    } catch (error) {
        console.error('获取文件列表错误:', error);
        return {
            status: 'error',
            message: error.message || '获取文件列表失败',
            files: []
        };
    }
};

/**
 * 获取文件详情
 * @param {string} fileId - 文件ID
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 文件详情数据
 */
export const getFileDetail = async(fileId, userId) => {
    if (!fileId || !userId) {
        console.error('获取文件详情错误: 文件ID和用户ID不能为空');
        return { status: 'error', message: '文件ID和用户ID不能为空' };
    }

    try {
        // 创建请求控制器
        const { signal } = createRequestController();

        // 获取API配置
        const baseURL = API_CONFIG.langchainBaseURL || API_CONFIG.baseURL;

        // 构建查询参数
        const params = new URLSearchParams({
            user_id: userId
        });

        // 发送请求
        const response = await fetch(`${baseURL}/base_agent/file-detail/${fileId}?${params}`, {
            method: 'GET',
            signal
        });

        // 解析响应
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || `获取文件详情失败: ${response.status}`);
        }

        return result;
    } catch (error) {
        console.error('获取文件详情错误:', error);
        return {
            status: 'error',
            message: error.message || '获取文件详情失败'
        };
    }
};

/**
 * 删除文件
 * @param {string} fileId - 文件ID
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 操作结果
 */
export const deleteFile = async(fileId, userId) => {
    if (!fileId || !userId) {
        console.error('删除文件错误: 文件ID和用户ID不能为空');
        return { status: 'error', message: '文件ID和用户ID不能为空' };
    }

    try {
        // 创建请求控制器
        const { signal } = createRequestController();

        // 获取API配置
        const baseURL = API_CONFIG.langchainBaseURL || API_CONFIG.baseURL;

        // 构建查询参数
        const params = new URLSearchParams({
            user_id: userId
        });

        // 发送请求
        const response = await fetch(`${baseURL}/base_agent/delete-file/${fileId}?${params}`, {
            method: 'DELETE',
            signal
        });

        // 解析响应
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || `删除文件失败: ${response.status}`);
        }

        return result;
    } catch (error) {
        console.error('删除文件错误:', error);
        return {
            status: 'error',
            message: error.message || '删除文件失败'
        };
    }
};

/**
 * 获取文件下载URL
 * @param {string} fileId - 文件ID
 * @param {string} userId - 用户ID
 * @returns {string} 文件下载URL
 */
export const getFileDownloadUrl = (fileId, userId) => {
    if (!fileId || !userId) {
        console.error('获取文件下载URL错误: 文件ID和用户ID不能为空');
        return null;
    }

    // 获取API配置
    const baseURL = API_CONFIG.langchainBaseURL || API_CONFIG.baseURL;

    // 构建下载URL
    return `${baseURL}/base_agent/download-file/${fileId}?user_id=${userId}`;
};

/**
 * 附加文件到消息中
 * @param {Array<string>} fileIds - 文件ID数组
 * @param {string} messageId - 消息ID
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} 操作结果
 */
export const attachFilesToMessage = async(fileIds, messageId, userId) => {
    if (!fileIds || !fileIds.length || !messageId || !userId) {
        console.error('附加文件错误: 文件ID、消息ID和用户ID不能为空');
        return { status: 'error', message: '文件ID、消息ID和用户ID不能为空' };
    }

    try {
        // 创建请求控制器
        const { signal } = createRequestController();

        // 获取API配置
        const baseURL = API_CONFIG.langchainBaseURL || API_CONFIG.baseURL;

        // 准备请求数据
        const data = {
            file_ids: fileIds,
            message_id: messageId,
            user_id: userId
        };

        // 发送请求
        const response = await fetch(`${baseURL}/base_agent/attach-files`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            signal
        });

        // 解析响应
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || `附加文件失败: ${response.status}`);
        }

        return result;
    } catch (error) {
        console.error('附加文件错误:', error);
        return {
            status: 'error',
            message: error.message || '附加文件失败'
        };
    }
};