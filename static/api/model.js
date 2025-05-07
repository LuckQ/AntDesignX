// 导入chat.js中的函数
import {
    ensureUserId,
    getServerConversations as getConversationList,
    getServerConversationHistory as getConversationHistory
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
 * @param {Array} messages - 消息数组
 * @param {Object} options - 其他选项
 * @returns {Promise} 请求Promise
 */
export const sendChatRequest = async(messages, options = {}) => {
    try {
        const userId = ensureUserId();

        // 使用 LangChain API
        const url = createApiUrl(`/base_agent/chat`, API_CONFIG.langchainBaseURL);

        // 获取最后一条用户消息
        const lastMessage = messages[messages.length - 1];

        // 构建请求体
        const requestBody = {
            query: lastMessage.content, // 用最后一条消息作为query
            user_id: userId,
            model_id: API_CONFIG.currentModel || options.model_id,
            response_mode: 'streaming',
            conversation_id: options.conversation_id || '',
        };

        // 添加文件列表 (如果存在)
        if (options.files && Array.isArray(options.files) && options.files.length > 0) {
            requestBody.files = options.files;
        }

        console.log('[Request] 发送请求:', requestBody);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: options.signal
        });

        if (!response.ok) {
            throw new Error(`请求失败: ${response.status}`);
        }

        return response;
    } catch (error) {
        console.error('发送聊天请求失败:', error);
        throw error;
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
            onComplete(false, '请求已中断');
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
        let conversation_id = null; // 存储会话ID
        let workflowSteps = []; // 初始化工作流步骤数组
        let currentLoadingNodeId = null; // 追踪当前正在加载的节点ID

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

                        // 保存会话ID，不使用localStorage
                        if (data.conversation_id && !conversation_id) {
                            conversation_id = data.conversation_id;
                            console.log(`%c[Stream] 获取会话ID: ${conversation_id}`, 'color: #9C27B0; font-weight: bold;');
                            // 使用回调通知上层组件
                            if (onConversationIdChange) {
                                onConversationIdChange(conversation_id);
                            }
                        }

                        // 处理 LangChain API 返回格式
                        if (data.event === 'message') {
                            const answer = data.answer || '';

                            // 检查是否包含思考过程
                            if (answer.includes('<think>')) {
                                isInThinkingMode = true;
                                const thinkContent = answer.replace('<think>', '');
                                console.log('%c[Stream] 进入思考模式', 'color: #FF9800; font-weight: bold;');
                                onReasoning(thinkContent);
                            } else if (answer.includes('</think>')) {
                                const parts = answer.split('</think>');
                                console.log('%c[Stream] 结束思考模式', 'color: #FF9800; font-weight: bold;');
                                onReasoning(parts[0]);

                                isInThinkingMode = false;

                                if (parts.length > 1) {
                                    onMessage(parts[1]);
                                }
                            } else if (isInThinkingMode) {
                                // 在思考模式中
                                onReasoning(answer);
                            } else {
                                // 普通消息内容
                                onMessage(answer);
                            }
                        } else if (data.event === 'message_end') {
                            console.log('%c[Stream] 收到消息结束事件: message_end', 'color: #4CAF50; font-weight: bold;');

                            // 消息结束时，只保存消息ID，不直接获取建议问题
                            if (data.message_id && onMessageIdChange) {
                                // 通知消息ID变更
                                onMessageIdChange(data.message_id);
                            }

                            // 保存任务ID
                            if (data.task_id && onTaskIdChange) {
                                onTaskIdChange(data.task_id);
                            }
                        } else if (data.event === 'message_file') {
                            console.log('%c[Stream] 收到文件事件: message_file', 'color: #4CAF50; font-weight: bold;');

                            // 处理文件事件数据
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
                        } else if (data.event === 'message_replace') {
                            console.log('%c[Stream] 收到消息替换事件: message_replace', 'color: #4CAF50; font-weight: bold;');
                            // 替换消息内容为审查后的内容
                            onMessage(data.answer || '');
                        } else if (data.event === 'tts_message') {
                            console.log('%c[Stream] 收到TTS事件: tts_message', 'color: #4CAF50; font-weight: bold;');
                        } else if (data.event === 'tts_message_end') {
                            console.log('%c[Stream] 收到TTS结束事件: tts_message_end', 'color: #4CAF50; font-weight: bold;');
                        } else if (data.event === 'workflow_started') {
                            console.log('%c[Stream] 收到工作流开始事件: workflow_started', 'color: #4CAF50; font-weight: bold;');
                        } else if (data.event === 'node_started') {
                            console.log('%c[Stream] 收到节点开始事件: node_started', 'color: #4CAF50; font-weight: bold;');
                            const nodeTitle = data.data.title;
                            const nodeId = data.data.id || `node-${workflowSteps.length}`; // 获取或生成节点ID

                            if (nodeTitle) {
                                // 添加：根据节点标题推断节点类型
                                const inferNodeType = (title) => {
                                    const titleLower = title.toLowerCase();

                                    if (titleLower === '开始') return 'start';
                                    if (titleLower.includes('http') || titleLower.includes('请求')) return 'http';
                                    if (titleLower.includes('条件') || titleLower.includes('分支')) return 'condition';
                                    if (titleLower.includes('时间')) return 'time';
                                    if (titleLower.includes('搜索')) return 'search';
                                    if (titleLower.includes('llm') || titleLower.includes('语言模型') || titleLower.includes('ai模型')) return 'llm';
                                    if (titleLower.includes('提取') || titleLower.includes('解析')) return 'extract';
                                    if (titleLower.includes('code') || titleLower.includes('代码')) return 'code';
                                    if (titleLower.includes('工具') || titleLower.includes('function')) return 'tool';
                                    if (titleLower.includes('结束') || titleLower.includes('end')) return 'end';
                                    return 'default'; // 默认类型
                                };

                                // 新节点对象
                                const newStep = {
                                    id: nodeId,
                                    title: nodeTitle,
                                    status: 'loading',
                                    type: inferNodeType(nodeTitle),
                                    startTime: new Date().getTime()
                                };

                                // 添加到工作流步骤数组
                                workflowSteps.push(newStep);
                                currentLoadingNodeId = nodeId;

                                // 通知UI更新
                                if (onWorkflowSteps) {
                                    onWorkflowSteps([...workflowSteps]); // 发送数组的副本
                                }
                            }
                        } else if (data.event === 'node_end') {
                            console.log('%c[Stream] 收到节点结束事件: node_end', 'color: #4CAF50; font-weight: bold;');

                            // 找到对应的步骤并更新状态
                            const nodeId = data.data.id || currentLoadingNodeId;
                            if (nodeId) {
                                const stepIndex = workflowSteps.findIndex(step => step.id === nodeId);
                                if (stepIndex !== -1) {
                                    workflowSteps[stepIndex].status = 'completed';
                                    workflowSteps[stepIndex].endTime = new Date().getTime();

                                    // 计算耗时
                                    if (workflowSteps[stepIndex].startTime) {
                                        const duration = workflowSteps[stepIndex].endTime - workflowSteps[stepIndex].startTime;
                                        workflowSteps[stepIndex].duration = duration;
                                        // 添加耗时文本
                                        workflowSteps[stepIndex].durationText = `${(duration / 1000).toFixed(2)}s`;
                                    }

                                    // 通知UI更新
                                    if (onWorkflowSteps) {
                                        onWorkflowSteps([...workflowSteps]); // 发送数组的副本
                                    }
                                }
                            }

                            // 清除当前加载的节点ID
                            if (currentLoadingNodeId === nodeId) {
                                currentLoadingNodeId = null;
                            }
                        } else if (data.event === 'node_error') {
                            console.log('%c[Stream] 收到节点错误事件: node_error', 'color: #F44336; font-weight: bold;');

                            // 找到对应的步骤并更新状态
                            const nodeId = data.data.id || currentLoadingNodeId;
                            if (nodeId) {
                                const stepIndex = workflowSteps.findIndex(step => step.id === nodeId);
                                if (stepIndex !== -1) {
                                    workflowSteps[stepIndex].status = 'error';
                                    workflowSteps[stepIndex].error = data.data.error || '执行出错';
                                    workflowSteps[stepIndex].endTime = new Date().getTime();

                                    // 通知UI更新
                                    if (onWorkflowSteps) {
                                        onWorkflowSteps([...workflowSteps]); // 发送数组的副本
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error('[Stream] 解析数据行时出错:', error, 'Line:', line);
                    }
                }
            }

            // 流处理完成后的清理工作
            if (onComplete) {
                if (buffer.trim()) {
                    try {
                        // 处理可能在缓冲区中的最后一行数据
                        if (buffer.startsWith('data: ')) {
                            const data = JSON.parse(buffer.substring(6));
                            // 处理最后一条消息（如果有）
                            if (data.event === 'message') {
                                onMessage(data.answer || '');
                            }
                        }
                    } catch (error) {
                        console.error('[Stream] 处理缓冲区剩余数据时出错:', error);
                    }
                }

                // 确保所有工作流步骤都已完成
                const unfinishedSteps = workflowSteps.filter(step => step.status === 'loading');
                if (unfinishedSteps.length > 0) {
                    for (const step of unfinishedSteps) {
                        step.status = 'completed';
                        step.endTime = new Date().getTime();

                        // 计算耗时
                        if (step.startTime) {
                            const duration = step.endTime - step.startTime;
                            step.duration = duration;
                            step.durationText = `${(duration / 1000).toFixed(2)}s`;
                        }
                    }

                    // 最后一次更新UI
                    if (onWorkflowSteps) {
                        onWorkflowSteps([...workflowSteps]);
                    }
                }

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
};

/**
 * 与模型聊天的主函数
 * @param {Array} messages - 消息历史
 * @param {Object} callbacks - 回调函数
 * @param {Object} options - 选项配置
 * @returns {Promise} 聊天结果承诺
 */
export const chatWithModel = async(messages, callbacks = {}, options = {}) => {
    try {
        // 检查是否有回调函数
        if (!callbacks || typeof callbacks !== 'object') {
            callbacks = {};
        }

        // 发送聊天请求
        const response = await sendChatRequest(messages, {
            ...options,
            signal: options.signal
        });

        // 处理流式响应
        handleStreamResponse(response, callbacks);
    } catch (error) {
        console.error('与模型聊天失败:', error);
        // 触发错误回调
        if (callbacks.onError) {
            callbacks.onError(error.message);
        }
        // 触发结束回调，标记为失败
        if (callbacks.onComplete) {
            callbacks.onComplete(false, error.message);
        }
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