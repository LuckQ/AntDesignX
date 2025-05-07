// 导入chat.js中的函数
import {
    ensureUserId,
    getServerConversations as getConversationList,
    getServerConversationHistory as getConversationHistory,
    createChat
} from './chat.js';

// 导入API配置
import { API_CONFIG, createApiUrl } from './config.js';

/**
 * 模型配置
 */
export const modelConfig = {
    'dify-api': {
        instance: {
            baseURL: API_CONFIG.baseURL,
            apiKey: API_CONFIG.apiKey,
            dangerouslyAllowBrowser: true
        },
        description: 'Dify API 模型'
    }
};

/**
 * 获取模型实例
 * @returns {Object} 模型实例
 */
export const getModelInstance = () => {
    return modelConfig['dify-api'].instance;
};

/**
 * 发送聊天请求
 * @param {string} api - API类型
 * @param {Object} requestData - 请求数据
 * @param {Object} callbacks - 回调函数对象
 * @returns {Promise} - Promise对象
 */
export const sendChatRequest = async(api, requestData, callbacks = {}) => {
    const { message, files = [], conversationId, userId, onConversationIdChange } = requestData;
    const { onMessage, onReasoning, onComplete, onFileEvent, onError, onWorkflowSteps, onMessageIdChange } = callbacks;

    // 检查是否有必要的参数
    if (!message && !files.length) {
        console.error('发送聊天请求失败: 消息内容和文件都为空');
        return Promise.reject({ error: '消息内容和文件不能同时为空' });
    }

    try {
        // 准备请求数据
        const user_id = userId;
        let session_id = conversationId;

        // 如果没有会话ID，先创建会话
        if (!session_id) {
            console.log('没有会话ID，创建新会话');
            try {
                // 导入createChat函数
                const { createChat } = await
                import ('./chat.js');
                const result = await createChat(user_id);
                if (result && result.session_id) {
                    session_id = result.session_id;
                    console.log('成功创建会话，ID:', session_id);
                    // 通知会话ID变更
                    if (onConversationIdChange) {
                        onConversationIdChange(session_id);
                    }
                } else {
                    throw new Error('创建会话失败: ' + (result.error || '未知错误'));
                }
            } catch (error) {
                console.error('创建会话出错:', error);
                throw error;
            }
        }

        // 构建流式消息API的URL
        const apiUrl = `${API_CONFIG.langchainBaseURL}/base_agent/stream-message`;

        // 构建请求体
        const body = {
            session_id,
            user_id,
            message,
        };

        // 添加文件IDs (如果有)
        if (files && files.length > 0) {
            // 修复：正确提取文件ID，支持多种格式的文件对象
            body.file_ids = files.map(file => {
                // 优先使用file_id，其次是upload_file_id，最后是id
                return file.file_id || file.upload_file_id || file.id || null;
            }).filter(id => id !== null); // 过滤掉无效的ID

            console.log('文件ID列表:', body.file_ids);
        }

        console.log('发送聊天请求到:', apiUrl);
        console.log('请求数据:', body);

        // 创建中断控制器
        const controller = new AbortController();
        const { signal } = controller;

        // 设置超时
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.error('请求超时，已中断');
            if (onError) onError('请求超时，请稍后重试');
        }, 60000); // 60秒超时

        // 创建响应Promise
        const responsePromise = fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal
        });

        // 在Promise对象上添加signal和abort方法，以便外部可以中断
        responsePromise.signal = signal;
        responsePromise.abort = () => controller.abort();

        // 清除超时定时器
        responsePromise.finally(() => clearTimeout(timeoutId));

        // 处理流式响应
        await handleStreamResponse(responsePromise, {
            onMessage,
            onReasoning,
            onComplete,
            onFileEvent,
            onError,
            onWorkflowSteps,
            onMessageIdChange,
            onConversationIdChange
        });

        return responsePromise;
    } catch (error) {
        console.error('发送聊天请求时出错:', error);
        if (onError) onError(error.message || '发送请求失败');
        if (onComplete) onComplete(false, error.message || '发送请求失败');
        return Promise.reject(error);
    }
};

/**
 * 处理流式响应
 * @param {Promise} responsePromise - 响应Promise
 * @param {Object} callbacks - 回调函数对象
 */
export const handleStreamResponse = async(responsePromise, callbacks = {}) => {
    const { onMessage, onError, onComplete, onReasoning, onWorkflowSteps, onConversationIdChange, onMessageIdChange, onTaskIdChange, onFileEvent } = callbacks;

    try {
        // 检查responsePromise是否已经被中断
        if (responsePromise.signal && responsePromise.signal.aborted) {
            console.log('[Stream] 请求已中断');
            onComplete && onComplete(false, '请求已中断');
            return;
        }

        const response = await responsePromise;

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Stream] API请求失败:', response.status, errorText);
            throw new Error(`API请求失败: ${response.status} ${errorText}`);
        }

        console.log('[Stream] 开始处理流式响应');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let isInThinkingMode = false; // 追踪是否在思考模式中
        let session_id = null; // 存储会话ID
        let workflowSteps = []; // 初始化工作流步骤数组
        let currentLoadingNodeId = null; // 追踪当前正在加载的节点ID
        let isFirstToken = true; // 是否是第一个令牌
        let finalResponse = ""; // 最终响应内容

        // 添加错误捕获包装
        try {
            while (true) {
                // 检查是否请求已被中断（AbortController信号）
                if (responsePromise.signal && responsePromise.signal.aborted) {
                    console.log('[Stream] 检测到请求中断信号，停止处理流');
                    break;
                }

                const { done, value } = await reader.read();

                if (done) {
                    console.log('[Stream] 流读取完成');
                    break;
                }

                // 解码接收到的数据
                buffer += decoder.decode(value, { stream: true });

                // 处理缓冲区中的数据行
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 最后一行可能不完整，保留到下一次

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(line.substring(6));
                        console.log('[Stream] 收到数据:', data);

                        // 保存会话ID
                        if ((data.session_id || data.conversation_id) && !session_id) {
                            session_id = data.session_id || data.conversation_id;
                            console.log(`%c[Stream] 获取会话ID: ${session_id}`, 'color: #9C27B0; font-weight: bold;');
                            // 使用回调通知上层组件
                            if (onConversationIdChange) {
                                onConversationIdChange(session_id);
                            }
                        }

                        // 处理不同类型的事件
                        if (data.error) {
                            // 处理错误情况
                            console.error('%c[Stream] 收到错误:', 'color: #F44336; font-weight: bold;', data.error);
                            if (onError) {
                                onError(data.error_message || data.error);
                            }
                        } else if (data.event === 'message') {
                            // 旧格式的消息事件
                            const answer = data.answer || '';
                            handleStreamContent(answer);
                        } else if (data.event === 'message_end') {
                            // 消息结束事件
                            console.log('%c[Stream] 收到消息结束事件: message_end', 'color: #4CAF50; font-weight: bold;');

                            // 消息结束时，保存消息ID
                            if (data.message_id && onMessageIdChange) {
                                onMessageIdChange(data.message_id);
                            }

                            // 保存任务ID
                            if (data.task_id && onTaskIdChange) {
                                onTaskIdChange(data.task_id);
                            }
                        } else if (data.event === 'message_file') {
                            // 文件事件处理
                            handleFileEvent(data);
                        } else if (data.event === 'complete' || data.type === 'complete') {
                            // 完成事件
                            console.log('%c[Stream] 收到完成事件', 'color: #4CAF50; font-weight: bold;');
                        } else if (data.type === 'thinking' || data.type === 'thinking_start') {
                            // 思考开始
                            isInThinkingMode = true;
                            const thought = data.content || data.thought || '';
                            if (onReasoning) {
                                onReasoning(thought);
                            }
                        } else if (data.type === 'thinking_end') {
                            // 思考结束
                            isInThinkingMode = false;
                        } else if (data.type === 'token_stream') {
                            // 令牌流
                            if (isFirstToken) {
                                isFirstToken = false;
                            }

                            if (data.content) {
                                finalResponse += data.content;
                                if (onMessage) {
                                    onMessage(finalResponse);
                                }
                            }
                        } else if (data.type === 'action_decision' || data.event === 'action_decision') {
                            // 工具调用决策
                            console.log('%c[Stream] 工具调用决策:', 'color: #2196F3; font-weight: bold;', data);

                            // 如果有工作流步骤回调，构建并触发回调
                            if (onWorkflowSteps) {
                                const newStep = {
                                    id: `tool-${workflowSteps.length}`,
                                    node_type: 'action_decision',
                                    title: `调用工具: ${data.actiontool || '未知工具'}`,
                                    status: 'loading',
                                    startTime: new Date().getTime(),
                                    thought: data.thought,
                                    action: data.action
                                };

                                workflowSteps.push(newStep);
                                currentLoadingNodeId = newStep.id;
                                onWorkflowSteps([...workflowSteps]);
                            }

                            // 如果有思考内容，通过思考回调展示
                            if (data.thought && onReasoning) {
                                onReasoning(data.thought);
                            }
                        } else if (data.type === 'tool_execution' || data.event === 'tool_result') {
                            // 工具执行结果
                            console.log('%c[Stream] 工具执行结果:', 'color: #4CAF50; font-weight: bold;', data);

                            // 更新步骤状态
                            if (onWorkflowSteps && currentLoadingNodeId) {
                                const stepIndex = workflowSteps.findIndex(s => s.id === currentLoadingNodeId);
                                if (stepIndex !== -1) {
                                    workflowSteps[stepIndex].status = 'completed';
                                    workflowSteps[stepIndex].endTime = new Date().getTime();
                                    workflowSteps[stepIndex].result = data.observation || data.result;

                                    // 添加结果步骤
                                    const resultStep = {
                                        id: `result-${workflowSteps.length}`,
                                        node_type: 'tool_result',
                                        title: `工具执行结果`,
                                        status: 'completed',
                                        tool: data.tool || workflowSteps[stepIndex].action.tool,
                                        result: data.observation || data.result,
                                        is_error: data.is_error || false
                                    };

                                    workflowSteps.push(resultStep);
                                    onWorkflowSteps([...workflowSteps]);

                                    // 重置当前工具ID
                                    currentLoadingNodeId = null;
                                }
                            }
                        } else if (data.type === 'final_answer' || data.event === 'final_answer') {
                            // 最终答案
                            finalResponse = data.final_answer || data.content || '';

                            if (onMessage) {
                                onMessage(finalResponse);
                            }

                            // 如果有工作流步骤，添加最终答案步骤
                            if (onWorkflowSteps && workflowSteps.length > 0) {
                                const finalStep = {
                                    id: `final-${workflowSteps.length}`,
                                    node_type: 'final_answer',
                                    title: `最终回答`,
                                    status: 'completed',
                                    thought: data.thought || '',
                                    content: finalResponse
                                };

                                workflowSteps.push(finalStep);
                                onWorkflowSteps([...workflowSteps]);
                            }
                        }
                    } catch (error) {
                        console.error('[Stream] 解析数据行时出错:', error, 'Line:', line);
                    }
                }
            }

            // 流处理完成后的清理工作
            if (onComplete) {
                onComplete(true, '流处理完成');
            }
        } catch (error) {
            console.error('[Stream] 处理流时出错:', error);
            if (onError) onError(error.message);
            if (onComplete) onComplete(false, error.message);
        }
    } catch (error) {
        console.error('[Stream] 创建响应读取器时出错:', error);
        if (onError) onError(error.message);
        if (onComplete) onComplete(false, error.message);
    }

    // 内部函数: 处理流式内容
    function handleStreamContent(content) {
        if (!content) return;

        // 检查是否包含思考过程标签
        if (content.includes('<think>')) {
            isInThinkingMode = true;
            const thinkContent = content.replace('<think>', '');
            console.log('%c[Stream] 进入思考模式', 'color: #FF9800; font-weight: bold;');
            if (onReasoning) onReasoning(thinkContent);
        } else if (content.includes('</think>')) {
            const parts = content.split('</think>');
            console.log('%c[Stream] 结束思考模式', 'color: #FF9800; font-weight: bold;');
            if (onReasoning) onReasoning(parts[0]);

            isInThinkingMode = false;

            if (parts.length > 1 && onMessage) {
                onMessage(parts[1]);
            }
        } else if (isInThinkingMode) {
            // 在思考模式中
            if (onReasoning) onReasoning(content);
        } else {
            // 普通消息内容
            if (onMessage) onMessage(content);
        }
    }

    // 内部函数: 处理文件事件
    function handleFileEvent(data) {
        console.log('%c[Stream] 收到文件事件: message_file', 'color: #4CAF50; font-weight: bold;');

        if (onFileEvent && data.file) {
            // 构建文件数据对象
            const fileData = {
                id: data.file.id,
                filename: data.file.filename || data.file.name,
                type: data.file.type || 'document',
                size: data.file.size || 0,
                url: data.file.url || ''
            };

            // 调用文件事件回调
            onFileEvent(fileData);
        }
    }
};

/**
 * 与模型进行对话
 * @param {Object} options - 选项
 * @param {String} options.api - API类型，默认为'chat'
 * @param {String} options.prompt - 用户消息
 * @param {Array} options.files - 附加文件数组
 * @param {String} options.conversationId - 会话ID
 * @param {Function} options.handleResponse - 响应处理函数
 * @param {AbortController} options.controller - 中断控制器
 * @returns {Promise} 返回Promise
 */
export const chatWithModel = async(options = {}) => {
    const {
        api = 'chat',
            prompt,
            files = [],
            conversationId,
            handleResponse,
            onMessage,
            onReasoning,
            onComplete,
            onFileEvent,
            onError,
            onWorkflowSteps,
            onMessageIdChange,
            onConversationIdChange
    } = options;

    // 检查prompt是否有实际内容
    const hasValidPrompt = prompt && typeof prompt === 'string' && prompt.trim() !== '';
    const hasValidFiles = Array.isArray(files) && files.length > 0;

    // 必须至少有一个有效参数
    if (!hasValidPrompt && !hasValidFiles) {
        console.error('消息内容验证失败:', { prompt, files });
        return Promise.reject(new Error('消息内容和文件至少需要一项'));
    }

    try {
        // 获取用户ID
        const { ensureUserId } = await
        import ('./chat.js');
        const userId = ensureUserId();

        // 准备请求数据
        const requestData = {
            message: hasValidPrompt ? prompt.trim() : '',
            files,
            conversationId,
            userId,
            onConversationIdChange
        };

        // 准备回调函数
        const callbacks = {
            onMessage,
            onReasoning,
            onComplete,
            onFileEvent,
            onError,
            onWorkflowSteps,
            onMessageIdChange
        };

        console.log('准备发送聊天请求:', requestData);

        // 发送请求
        return await sendChatRequest(api, requestData, callbacks);
    } catch (error) {
        console.error('与模型对话失败:', error);
        if (onError) onError(error.message || '发送消息失败');
        return Promise.reject(error);
    }
};

/**
 * 加载系统提示词
 * @returns {Promise<string>} 提示词
 */
export const loadSystemPrompt = async() => {
    try {
        // 使用 LangChain API
        const url = createApiUrl(`/base_agent/system-prompt`, API_CONFIG.langchainBaseURL);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`获取系统提示词失败: ${response.status}`);
        }

        const data = await response.json();
        return data.prompt || '';
    } catch (error) {
        console.error('加载系统提示词失败:', error);
        return ''; // 失败时返回空字符串
    }
};

/**
 * 重置会话
 * 清空当前会话的所有状态和历史记录
 */
export const resetConversation = () => {
    // 可以从这里清除会话相关状态
    console.log('重置会话');

    // 触发自定义事件
    const event = new CustomEvent('conversation-reset');
    document.dispatchEvent(event);
};