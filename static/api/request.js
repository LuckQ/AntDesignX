/**
 * 请求状态管理和中断处理的公共函数
 */

// 导入API配置
import { API_CONFIG } from './config.js';

/**
 * 创建请求控制器
 * @returns {Object} 请求控制对象，包含控制器和中断函数
 */
export const createRequestController = () => {
    const controller = new AbortController();
    const signal = controller.signal;
    
    // 创建中断函数
    const abortRequest = () => {
        // 只有在未中断的情况下才执行中断操作
        if (!controller.signal.aborted) {
            try {
                console.log('执行请求中断操作');
                controller.abort();
                console.log('请求中断完成');
            } catch (error) {
                console.error('中断请求时出错:', error);
            }
        } else {
            console.log('请求已经被中断，不再重复执行');
        }
    };
    
    return {
        controller,
        signal,
        abortRequest
    };
};

/**
 * 创建超时保护
 * @param {Function} abortFunction - 中断函数
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {number} 超时计时器ID
 */
export const createTimeoutProtection = (abortFunction, timeout = 30000) => {
    return setTimeout(() => {
        if (typeof abortFunction === 'function') {
            abortFunction();
        }
    }, timeout);
};

/**
 * 处理请求中断后的UI状态更新
 * @param {Object} lastMessage - 最后一条助手消息
 * @param {Object} stateControls - 状态控制对象，包含loading和isStreamLoad
 */
export const handleRequestAbort = (lastMessage, stateControls) => {
    const { loading, isStreamLoad } = stateControls;
    
    // 重置加载状态
    if (loading && typeof loading.value !== 'undefined') {
        loading.value = false;
    }
    
    if (isStreamLoad && typeof isStreamLoad.value !== 'undefined') {
        isStreamLoad.value = false;
    }
    
    // 处理消息状态
    if (lastMessage && lastMessage.role === 'assistant') {
        // 如果消息为空，添加一个提示
        if (!lastMessage.content || lastMessage.content === '') {
            lastMessage.content = '回复已中断';
        } else if (!lastMessage.content.includes('[已中断]')) {
            lastMessage.content += ' [已中断]';
        }

        // 如果有思考内容并且是"思考中..."，则更新为已中断
        if (lastMessage.reasoning === '思考中...') {
            lastMessage.reasoning = '思考过程已中断';
        } else if (lastMessage.reasoning && !lastMessage.reasoning.includes('已中断')) {
            lastMessage.reasoning += ' [已中断]';
        }
    }
};

/**
 * 处理请求错误
 * @param {Object} error - 错误对象
 * @param {Object} lastMessage - 最后一条助手消息
 * @param {Object} stateControls - 状态控制对象
 * @returns {boolean} 是否为中断错误
 */
export const handleRequestError = (error, lastMessage, stateControls) => {
    const { loading, isStreamLoad } = stateControls;
    const errorMessage = error?.message || error || '请求失败';
    
    console.log('处理请求错误:', errorMessage);
    
    // 重置加载状态
    if (loading && typeof loading.value !== 'undefined') {
        loading.value = false;
    }
    
    if (isStreamLoad && typeof isStreamLoad.value !== 'undefined') {
        isStreamLoad.value = false;
    }
    
    // 检查是否是中断导致的错误或消息通道关闭错误
    const isAborted = 
        errorMessage.includes('abort') || 
        errorMessage.includes('中断') || 
        errorMessage.includes('cancel') ||
        errorMessage.includes('BodyStreamBuffer was aborted') ||
        errorMessage.includes('message channel closed') ||
        errorMessage.includes('listener indicated an asynchronous response') ||
        error?.name === 'AbortError';
    
    if (isAborted) {
        // 处理中断状态
        if (lastMessage) {
            if (!lastMessage.content || lastMessage.content === '') {
                lastMessage.content = '回复已中断';
            } else if (!lastMessage.content.includes('[已中断]')) {
                lastMessage.content += ' [已中断]';
            }
            
            // 处理思考状态
            if (lastMessage.reasoning === '思考中...') {
                lastMessage.reasoning = '思考过程已中断';
            } else if (lastMessage.reasoning && !lastMessage.reasoning.includes('已中断')) {
                lastMessage.reasoning += ' [已中断]';
            }
        }
    } else if (lastMessage) {
        // 处理错误状态
        lastMessage.role = 'error';
        lastMessage.content = errorMessage;
    }
    
    return isAborted;
};

/**
 * 处理请求完成
 * @param {boolean} isOk - 请求是否成功
 * @param {string} msg - 完成消息
 * @param {Object} lastMessage - 最后一条助手消息
 * @param {Object} stateControls - 状态控制对象
 * @param {Object} controllers - 控制器对象
 */
export const handleRequestComplete = (isOk, msg, lastMessage, stateControls, controllers) => {
    const { loading, isStreamLoad } = stateControls || {};
    const { timeoutId, fetchCancel } = controllers || {};
    
    // 清除超时保护
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    
    // 检查是否是中断导致的完成
    const isAborted = !isOk && (msg && (
        msg.includes('abort') || 
        msg.includes('中断') || 
        msg.includes('cancel') ||
        msg.includes('BodyStreamBuffer was aborted') ||
        msg.includes('message channel closed') ||
        msg.includes('listener indicated an asynchronous response')
    ));
    
    // 确保lastMessage存在再进行操作
    if (lastMessage) {
        if (isAborted) {
            if (!lastMessage.content || lastMessage.content === '') {
                lastMessage.content = '回复已中断';
            } else if (!lastMessage.content.includes('[已中断]')) {
                lastMessage.content += ' [已中断]';
            }
        } else if (!isOk || !lastMessage.content) {
            lastMessage.role = 'error';
            lastMessage.content = msg || '请求失败';
        }
    }
    
    // 重置状态
    if (isStreamLoad && typeof isStreamLoad?.value !== 'undefined') {
        isStreamLoad.value = false;
    }
    
    if (loading && typeof loading?.value !== 'undefined') {
        loading.value = false;
    }
    
    // 清空中断函数，防止内存泄漏
    if (fetchCancel && typeof fetchCancel?.value !== 'undefined') {
        // 确保中断函数存在且未执行过时再尝试设置为null
        try {
            fetchCancel.value = null;
        } catch (error) {
            console.warn('清空中断函数时出错:', error);
        }
    }
};

/**
 * 向服务器发送停止流式响应的请求
 * @param {String} taskId - 任务ID
 * @param {String} userId - 用户ID
 * @returns {Promise<boolean>} 是否成功停止
 */
export const stopStreamResponse = async (taskId, userId) => {
    if (!taskId || !userId) {
        console.error('[Stream Stop] 停止响应失败: taskId或userId不能为空', { taskId, userId });
        return false;
    }

    console.log('[Stream Stop] 尝试停止流式响应', { taskId, userId });

    try {
        // 使用统一的API配置
        const baseURL = API_CONFIG.baseURL;
        const apiKey = API_CONFIG.apiKey;
        
        console.log('[Stream Stop] 发送停止请求到:', `${baseURL}/chat-messages/${taskId}/stop`);
        
        const response = await fetch(`${baseURL}/chat-messages/${taskId}/stop`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                user: userId
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('[Stream Stop] 流式响应已成功停止', { 
                status: response.status,
                result: result 
            });
            return true;
        } else {
            console.error('[Stream Stop] 停止响应请求失败:', { 
                status: response.status, 
                result: result 
            });
            return false;
        }
    } catch (error) {
        console.error('[Stream Stop] 停止响应请求错误:', error);
        return false;
    }
};