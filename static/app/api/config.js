/**
 * API配置文件
 * 统一管理API的基础URL和密钥
 */

/**
 * API基础配置
 */
export const API_CONFIG = {
    baseURL: 'http://192.168.79.122:8083/v1',
    apiKey: 'app-GpJXezVwZC2uD3urb50X4kVm'
};

/**
 * 获取API配置
 * @returns {Object} API配置对象
 */
export const getApiConfig = () => {
    return API_CONFIG;
}; 