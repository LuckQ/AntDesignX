/**
 * API配置文件
 * 统一管理API的基础URL和密钥
 */

/**
 * API基础配置
 */
export const API_CONFIG = {
  baseURL: '/api/v1', // 使用相对路径，通过Vite代理转发

  workflowApiKey: 'app-6aRhLAp4zAppCJus5ViMgOsh', // 工作流API密钥（用于标题生成）
  datasetApiKey: 'dataset-DbREngpTedxnPe5ZM0gV7Et7', // 知识库API密钥
  models: [
    {
      id: 'DeepSeek-R1-671B',
      name: 'DeepSeek-R1-671B（百年金钟，智启未来）',
      apiKey: 'app-UOyWvnDuuApOkMflgwWwuGYV',
    },
    {
      id: 'ds-v3',
      name: '金钟 dify 智能体',
      apiKey: 'app-g3VTn0kdurDWk5M2ehgsmmS9',
    },
  ],
  defaultModel: 'DeepSeek-R1-671B', // 默认选择的模型id
  apiKey: 'app-g3VTn0kdurDWk5M2ehgsmmS9',

  //122
  // workflowApiKey: 'app-6aRhLAp4zAppCJus5ViMgOsh', // 工作流API密钥（用于标题生成）
  // datasetApiKey: 'dataset-NU4Kg7Wtm1616AOnxnRAeFct', // 知识库API密钥
  // models: [
  //   {
  //     id: 'DeepSeek-R1-671B',
  //     name: 'DeepSeek-R1-671B（百年金钟，智启未来）',
  //     apiKey: 'app-wlt051T4z5RUTJcekOy9SrCZ',
  //   },
  //   {
  //     id: 'ds-v3',
  //     name: '金钟 dify 智能体',
  //     apiKey: 'app-fMRuKogGZJGDJ3c25RXD4r01',
  //   },
  // ],
  // defaultModel: 'DeepSeek-R1-671B', // 默认选择的模型
  // apiKey: 'app-wlt051T4z5RUTJcekOy9SrCZ',

};

/**
 * 创建API URL
 * @param {String} path - API路径
 * @param {String} customBaseUrl - 可选的自定义基础URL，默认使用API_CONFIG.baseURL
 * @returns {URL} 创建的URL对象
 */
export const createApiUrl = (path, customBaseUrl) => {
  const baseUrl = customBaseUrl || API_CONFIG.baseURL;
  const urlString = `${baseUrl}${path}`;
  const isAbsoluteUrl = urlString.startsWith('http://') || urlString.startsWith('https://');
  return isAbsoluteUrl ? new URL(urlString) : new URL(urlString, window.location.origin);
};

/**
 * 获取API配置
 * @returns {Object} API配置对象
 */
export const getApiConfig = () => {
  return API_CONFIG;
};

/**
 * 重设API配置
 * @param {Object} newConfig - 新的配置对象
 */
export const updateAPIConfig = newConfig => {
  if (newConfig.baseURL) {
    API_CONFIG.baseURL = newConfig.baseURL;
  }

  if (newConfig.apiKey) {
    API_CONFIG.apiKey = newConfig.apiKey;
  }

  if (newConfig.workflowApiKey) {
    API_CONFIG.workflowApiKey = newConfig.workflowApiKey;
  }

  if (newConfig.datasetBaseURL) {
    API_CONFIG.datasetBaseURL = newConfig.datasetBaseURL;
  }

  if (newConfig.datasetApiKey) {
    API_CONFIG.datasetApiKey = newConfig.datasetApiKey;
  }

  if (newConfig.currentModel) {
    const model = API_CONFIG.models.find(m => m.id === newConfig.currentModel);
    if (model) {
      API_CONFIG.currentModel = newConfig.currentModel;
      // 自动更新API密钥
      API_CONFIG.apiKey = model.apiKey;
    }
  }

  console.log('API配置已更新:', API_CONFIG);
  return API_CONFIG;
};

/**
 * 切换当前模型
 * @param {String} modelId - 模型ID
 * @returns {Object|null} 成功返回更新后的配置，失败返回null
 */
export const switchModel = modelId => {
  const model = API_CONFIG.models.find(m => m.id === modelId);
  if (!model) {
    console.error('未找到指定的模型:', modelId);
    return null;
  }

  // 更新当前模型和对应的API密钥
  API_CONFIG.currentModel = modelId;
  API_CONFIG.apiKey = model.apiKey;

  console.log('已切换模型:', model.name);
  return API_CONFIG;
};
