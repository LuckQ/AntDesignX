/**
 * 工作流 API 模块
 * 实现与Dify工作流相关的API调用
 */
import axios from 'axios';

// API 配置
const API_CONFIG = {
  baseURL: 'http://192.168.79.122:8083/v1',
  apiKey: 'app-Kdfqs0niBpoSSMfQtDdTNCIb'
};

/**
 * 执行工作流
 * @param {Object} inputs - 输入参数对象
 * @param {string} responseMode - 响应模式（streaming或blocking）
 * @param {string} user - 用户标识
 * @returns {Promise} - API响应
 */
export const runWorkflow = async (inputs = {}, responseMode = 'blocking', user) => {
  try {
    const requestBody = {
      inputs,
      response_mode: responseMode,
      user: user || localStorage.getItem('dify_user_id') || 'user123'
    };

    const response = await axios.post(`${API_CONFIG.baseURL}/workflows/run`, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[工作流API] 执行工作流失败:', error);
    throw error;
  }
};

/**
 * 获取工作流执行情况
 * @param {string} workflowId - 工作流执行ID
 * @returns {Promise} - API响应
 */
export const getWorkflowRun = async (workflowId) => {
  try {
    const response = await axios.get(`${API_CONFIG.baseURL}/workflows/run/${workflowId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[工作流API] 获取工作流执行情况失败:', error);
    throw error;
  }
};

/**
 * 停止响应
 * @param {string} taskId - 任务ID
 * @param {string} user - 用户标识
 * @returns {Promise} - API响应
 */
export const stopWorkflowTask = async (taskId, user) => {
  try {
    const requestBody = {
      user: user || localStorage.getItem('dify_user_id') || 'user123'
    };

    const response = await axios.post(`${API_CONFIG.baseURL}/workflows/tasks/${taskId}/stop`, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[工作流API] 停止响应失败:', error);
    throw error;
  }
};

/**
 * 上传文件
 * @param {File} file - 要上传的文件
 * @param {string} user - 用户标识
 * @returns {Promise} - API响应
 */
export const uploadFile = async (file, user) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', user || localStorage.getItem('dify_user_id') || 'user123');

    const response = await axios.post(`${API_CONFIG.baseURL}/files/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${API_CONFIG.apiKey}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data;
  } catch (error) {
    console.error('[工作流API] 上传文件失败:', error);
    throw error;
  }
};

/**
 * 获取工作流日志
 * @param {Object} params - 查询参数
 * @returns {Promise} - API响应
 */
export const getWorkflowLogs = async (params = {}) => {
  try {
    const response = await axios.get(`${API_CONFIG.baseURL}/workflows/logs`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      },
      params
    });

    return response.data;
  } catch (error) {
    console.error('[工作流API] 获取工作流日志失败:', error);
    throw error;
  }
};

/**
 * 获取应用基本信息
 * @returns {Promise} - API响应
 */
export const getAppInfo = async () => {
  try {
    const response = await axios.get(`${API_CONFIG.baseURL}/info`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[工作流API] 获取应用基本信息失败:', error);
    throw error;
  }
};

/**
 * 获取应用参数
 * @returns {Promise} - API响应
 */
export const getParameters = async () => {
  try {
    const response = await axios.get(`${API_CONFIG.baseURL}/parameters`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[工作流API] 获取应用参数失败:', error);
    throw error;
  }
};

/**
 * 处理Excel文件上传并发送到工作流
 * @param {Object} blockData - 数据块信息
 * @param {string} user - 用户标识
 * @param {Function} onNodeUpdate - 节点更新回调函数
 * @returns {Promise} - 工作流执行结果
 */
export const processExcelBlock = async (blockData, user, onNodeUpdate) => {
  try {
    // 构建请求体
    const requestBody = {
      inputs: {
        username: user || localStorage.getItem('dify_user_id') || 'user123',
        // 必填字段
        text: JSON.stringify(blockData.data),                    // 必填：文本内容
        blockId: blockData.blockIndex?.toString() || "0",        // 必填：数据块ID
        blockSize: (blockData.data?.length || 0).toString(),     // 必填：数据块大小
        totalRows: (blockData.size || 0).toString(),             // 必填：数据总量
        startIndex: blockData.startIndex?.toString() || "0",     // 必填：数据块起始行
        endIndex: blockData.endIndex?.toString() || "0",         // 必填：数据块结束行
        totalBlocks: blockData.totalBlocks?.toString() || "1"    // 必填：数据块数量
      },
      query: `处理Excel文件"${blockData.fileName || '未命名'}"的第${(blockData.blockIndex || 0) + 1}块数据，共${blockData.totalBlocks || 1}块`,
      response_mode: "streaming", // 使用流式输出
      user: user || localStorage.getItem('dify_user_id') || 'user123'
    };

    console.log(`[工作流API] 发送Excel数据块请求:`, {
      blockIndex: blockData.blockIndex,
      blockId: requestBody.inputs.blockId,
      blockSize: requestBody.inputs.blockSize,
      totalRows: requestBody.inputs.totalRows,
      startIndex: requestBody.inputs.startIndex,
      endIndex: requestBody.inputs.endIndex,
      totalBlocks: requestBody.inputs.totalBlocks
    });

    // 使用流式响应处理
    const response = await fetch(`${API_CONFIG.baseURL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP错误 ${response.status}`);
    }

    // 用于存储所有事件数据
    const responseData = {
      events: [],
      workflowInfo: null,
      nodeInfos: [],
      finalResult: null,
      blockIndex: blockData.blockIndex,
      taskId: null
    };

    // 使用 ReadableStream 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let isProcessing = true;
    while (isProcessing) {
      const { value, done } = await reader.read();
      
      if (done) {
        isProcessing = false;
        if (buffer.length > 0) {
          // 处理剩余数据
          processEventData(buffer, responseData, onNodeUpdate);
        }
        break;
      }
      
      // 解码二进制数据
      const text = decoder.decode(value, { stream: true });
      buffer += text;
      
      // 处理获取到的事件数据
      buffer = processEventData(buffer, responseData, onNodeUpdate);
    }

    console.log(`[工作流API] 数据块#${blockData.blockIndex}处理完成`, responseData);
    return responseData;
  } catch (error) {
    console.error('[工作流API] 处理Excel数据块失败:', error);
    throw error;
  }
};

/**
 * 处理事件数据
 * @param {string} buffer - 数据缓冲区
 * @param {Object} responseData - 响应数据对象
 * @param {Function} onNodeUpdate - 节点更新回调函数
 * @returns {string} - 剩余缓冲区数据
 */
function processEventData(buffer, responseData, onNodeUpdate) {
  // 按行分割，每个事件都是由 "data: " 开头
  const lines = buffer.split('\n\n');
  
  // 最后一行可能不完整，保留到下一次处理
  const remainingBuffer = lines.pop() || '';
  
  for (const line of lines) {
    if (!line.trim() || !line.startsWith('data: ')) continue;
    
    try {
      const eventData = JSON.parse(line.substring(6).trim());
      responseData.events.push(eventData);
      
      // 根据事件类型处理不同数据
      if (eventData.event === 'workflow_started') {
        responseData.workflowInfo = eventData.data;
        responseData.taskId = eventData.task_id;
        if (onNodeUpdate) onNodeUpdate({
          type: 'workflow_started',
          data: eventData.data,
          blockIndex: responseData.blockIndex,
          taskId: eventData.task_id
        });
      } 
      else if (eventData.event === 'node_started') {
        responseData.nodeInfos.push({
          id: eventData.data.id,
          node_id: eventData.data.node_id,
          node_type: eventData.data.node_type,
          status: 'running',
          title: eventData.data.title,
          index: eventData.data.index,
          created_at: eventData.data.created_at
        });
        if (onNodeUpdate) onNodeUpdate({
          type: 'node_started',
          data: eventData.data,
          blockIndex: responseData.blockIndex,
          taskId: eventData.task_id
        });
      }
      else if (eventData.event === 'node_finished') {
        // 更新节点状态
        const nodeIndex = responseData.nodeInfos.findIndex(n => n.id === eventData.data.id);
        if (nodeIndex !== -1) {
          responseData.nodeInfos[nodeIndex] = {
            ...responseData.nodeInfos[nodeIndex],
            status: eventData.data.status,
            outputs: eventData.data.outputs,
            elapsed_time: eventData.data.elapsed_time,
            error: eventData.data.error
          };
        }
        if (onNodeUpdate) onNodeUpdate({
          type: 'node_finished',
          data: eventData.data,
          blockIndex: responseData.blockIndex,
          taskId: eventData.task_id
        });
      }
      else if (eventData.event === 'workflow_finished') {
        responseData.finalResult = eventData.data;
        if (onNodeUpdate) onNodeUpdate({
          type: 'workflow_finished',
          data: eventData.data,
          blockIndex: responseData.blockIndex,
          taskId: eventData.task_id
        });
      }
      
    //   console.log(`[工作流事件] ${eventData.event}`, eventData);
    } catch (e) {
      console.error('解析事件数据错误:', e, line);
    }
  }
  
  return remainingBuffer;
}

export default {
  runWorkflow,
  getWorkflowRun,
  stopWorkflowTask,
  uploadFile,
  getWorkflowLogs,
  getAppInfo,
  getParameters,
  processExcelBlock,
  API_CONFIG
}; 