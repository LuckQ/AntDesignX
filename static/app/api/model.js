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
export const sendChatRequest = async (messages, options = {}) => {
    try {
        const userId = ensureUserId();

        // 使用工具函数创建URL
        const url = createApiUrl('/chat-messages');
        
        // 获取最后一条用户消息
        const lastMessage = messages[messages.length - 1];
        
        // 构建请求体
        const requestBody = {
            query: lastMessage.content, // 用最后一条消息作为query
            user: userId,
            response_mode: 'streaming',
            inputs: {},
        };
        
        // 添加对话ID (如果存在)
        if (options.conversation_id) {
            requestBody.conversation_id = options.conversation_id;
        }
        
        // 添加文件列表 (如果存在)
        if (options.files && Array.isArray(options.files) && options.files.length > 0) {
            requestBody.files = options.files;
        }

        console.log('[Request] 发送请求:', requestBody);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
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
export const handleStreamResponse = async (responsePromise, callbacks = {}) => {
    const { onMessage, onError, onComplete, onReasoning } = callbacks;

    try {
        // 检查responsePromise是否已经被中断
        if (responsePromise.signal && responsePromise.signal.aborted) {
            console.log('[Stream] 请求已中断');
            onComplete?.(false, '请求已中断');
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

                        // 输出事件类型
                        // if (data.event) {
                        //     console.log(`%c[Stream Event] 收到事件: ${data.event}`, 'color: #4CAF50; font-weight: bold;');
                        //     console.log('%c[Stream Data]', 'color: #2196F3; font-weight: bold;', data);
                        // }

                        // 保存会话ID，不使用localStorage
                        if (data.conversation_id && !conversation_id) {
                            conversation_id = data.conversation_id;
                            console.log(`%c[Stream] 获取会话ID: ${conversation_id}`, 'color: #9C27B0; font-weight: bold;');
                            // 使用回调通知上层组件
                            if (callbacks.onConversationIdChange) {
                                callbacks.onConversationIdChange(conversation_id);
                            }
                        }

                        // 处理Dify API返回格式
                        if (data.event === 'message') {
                            const answer = data.answer || '';

                            // 检查是否包含思考过程
                            if (answer.includes('<think>')) {
                                isInThinkingMode = true;
                                const thinkContent = answer.replace('<think>', '');
                                console.log('%c[Stream] 进入思考模式', 'color: #FF9800; font-weight: bold;');
                                onReasoning?.(thinkContent);
                            } else if (answer.includes('</think>')) {
                                const parts = answer.split('</think>');
                                console.log('%c[Stream] 结束思考模式', 'color: #FF9800; font-weight: bold;');
                                onReasoning?.(parts[0]);

                                isInThinkingMode = false;

                                if (parts.length > 1) {
                                    onMessage?.(parts[1]);
                                }
                            } else if (isInThinkingMode) {
                                // 在思考模式中
                                onReasoning?.(answer);
                            } else {
                                // 普通消息内容
                                onMessage?.(answer);
                            }
                        } else if (data.event === 'message_end') {
                            console.log('%c[Stream] 收到消息结束事件: message_end', 'color: #4CAF50; font-weight: bold;');

                            // 消息结束时，只保存消息ID，不直接获取建议问题
                            if (data.message_id && callbacks.onMessageIdChange) {
                                // 通知消息ID变更
                                callbacks.onMessageIdChange(data.message_id);
                            }

                            // 保存任务ID
                            if (data.task_id && callbacks.onTaskIdChange) {
                                callbacks.onTaskIdChange(data.task_id);
                            }
                        } else if (data.event === 'message_file') {
                            console.log('%c[Stream] 收到文件事件: message_file', 'color: #4CAF50; font-weight: bold;');
                            
                            // 处理文件事件数据
                            if (callbacks.onFileEvent && data.file) {
                                // 构建文件数据对象
                                const fileData = {
                                    id: data.file.id,
                                    filename: data.file.filename || data.file.name,
                                    type: data.file.type || 'document',
                                    size: data.file.size || 0,
                                    url: data.file.url || ''
                                };
                                
                                // 调用文件事件回调
                                callbacks.onFileEvent(fileData);
                            }
                        } else if (data.event === 'message_replace') {
                            console.log('%c[Stream] 收到消息替换事件: message_replace', 'color: #4CAF50; font-weight: bold;');
                            // 替换消息内容为审查后的内容
                            onMessage?.(data.answer || '');
                        } else if (data.event === 'tts_message') {
                            console.log('%c[Stream] 收到TTS事件: tts_message', 'color: #4CAF50; font-weight: bold;');
                        } else if (data.event === 'tts_message_end') {
                            console.log('%c[Stream] 收到TTS结束事件: tts_message_end', 'color: #4CAF50; font-weight: bold;');
                        } else if (data.event === 'workflow_started') {
                            console.log('%c[Stream] 收到工作流开始事件: workflow_started', 'color: #4CAF50; font-weight: bold;');
                        } else if (data.event === 'node_started') {
                            console.log('%c[Stream] 收到节点开始事件: node_started', 'color: #4CAF50; font-weight: bold;');
                            console.log('%c[Stream Node Started]', 'color: #2196F3; font-weight: bold;', {
                                title: data.data?.title
                            });
                        } else if (data.event === 'node_finished') {
                            console.log('%c[Stream] 收到节点完成事件: node_finished', 'color: #4CAF50; font-weight: bold;');
                        } else if (data.event === 'workflow_finished') {
                            console.log('%c[Stream] 收到工作流完成事件: workflow_finished', 'color: #4CAF50; font-weight: bold;');
                        } else if (data.event === 'error') {
                            console.error('%c[Stream] 收到错误事件: error', 'color: #F44336; font-weight: bold;');
                            onError?.(data.message || '流处理错误');
                        } else if (data.event === 'ping') {
                            console.log('%c[Stream] 收到ping事件', 'color: #607D8B; font-style: italic;');
                        }
                    } catch (e) {
                        console.error('%c[Stream] 解析流数据失败:', 'color: #F44336; font-weight: bold;', e);
                    }
                }
            }
        } catch (streamError) {
            // 处理流处理过程中的错误
            console.error('%c[Stream] 流处理过程中出错:', 'color: #F44336; font-weight: bold;', streamError);
            const errorMsg = streamError.message || '';

            // 扩展中断错误识别条件
            if (streamError.name === 'AbortError' ||
                errorMsg.includes('aborted') ||
                errorMsg.includes('abort') ||
                errorMsg.includes('BodyStreamBuffer was aborted') ||
                errorMsg.includes('message channel closed') ||
                errorMsg.includes('listener indicated an asynchronous response')) {

                console.log('%c[Stream] 请求被中断', 'color: #FF9800; font-weight: bold;');
                onComplete?.(false, '请求处理过程已中断');
                return; // 直接返回，不再抛出错误
            }
            throw streamError; // 只有非中断类错误才重新抛出
        } finally {
            // 确保释放资源
            try {
                reader.releaseLock();
                console.log('[Stream] 读取器已释放');
            } catch (e) {
                console.warn('[Stream] 释放读取锁时出错:', e);
            }
        }

        console.log('[Stream] 流处理完成');
        onComplete?.(true);
    } catch (error) {
        console.error('[Stream] 流式请求错误:', error);

        // 判断是否是AbortError（请求被中断）
        if (error.name === 'AbortError' ||
            error.message.includes('aborted') ||
            error.message.includes('BodyStreamBuffer was aborted')) {
            console.log('[Stream] 请求中断错误');
            onComplete?.(false, '请求已中断');
        } else {
            console.error('[Stream] 请求失败错误');
            onError?.(error.message || '请求失败');
            onComplete?.(false, error.message);
        }
    }
};

/**
 * 封装的请求方法
 * @param {Array} messages - 消息数组
 * @param {Object} callbacks - 回调函数
 * @param {Object} options - 其他选项
 * @returns {Object} 请求结果
 */
export const chatWithModel = async (messages, callbacks = {}, options = {}) => {
    try {
        // 直接使用传入的会话ID
        const conversationId = options.conversation_id || '';
        const requestOptions = {
            ...options,
            conversation_id: conversationId
        };

        console.log('[Chat] 开始聊天请求', {
            conversationId: conversationId,
            messageCount: messages.length,
            hasSignal: !!options.signal
        });

        // 发送请求
        const responsePromise = sendChatRequest(messages, requestOptions);

        // 处理流式响应
        try {
            console.log('[Chat] 开始处理流式响应');
            await handleStreamResponse(responsePromise, callbacks);
            console.log('[Chat] 流式响应处理成功');
            return { success: true };
        } catch (streamError) {
            // 专门处理流处理过程中的错误
            console.error('[Chat] 流处理过程中出错:', streamError);

            // 检查是否是中断或通道关闭错误
            if (streamError.name === 'AbortError' ||
                streamError.message?.includes('aborted') ||
                streamError.message?.includes('message channel closed') ||
                streamError.message?.includes('BodyStreamBuffer was aborted') ||
                streamError.message?.includes('listener indicated an asynchronous response')) {

                console.log('[Chat] 流处理被中断');
                callbacks.onComplete?.(false, '请求已中断');
                return { success: false, aborted: true, error: streamError };
            }

            // 其他错误传递给回调
            console.error('[Chat] 流处理失败:', streamError.message || '未知错误');
            callbacks.onError?.(streamError.message || '流处理失败');
            callbacks.onComplete?.(false, streamError.message);
            return { success: false, error: streamError };
        }
    } catch (error) {
        console.error('[Chat] 聊天请求错误:', error);

        // 检查是否是中断或通道关闭错误
        if (error.name === 'AbortError' ||
            error.message?.includes('aborted') ||
            error.message?.includes('message channel closed') ||
            error.message?.includes('BodyStreamBuffer was aborted') ||
            error.message?.includes('listener indicated an asynchronous response')) {

            console.log('[Chat] 聊天请求被中断');
            callbacks.onComplete?.(false, '请求已中断');
            return { success: false, aborted: true, error };
        }

        console.error('[Chat] 聊天请求失败:', error.message || '未知错误');
        callbacks.onError?.(error.message || '请求失败');
        callbacks.onComplete?.(false, error.message);
        return { success: false, error };
    }
};

/**
 * 加载系统提示词
 */
export const loadSystemPrompt = async () => {
    try {
        // 使用标准Fetch API替代uni.request
        const response = await fetch('/static/files/prompt-copy.json');
        if (response.ok) {
            const data = await response.json();
            return JSON.stringify(data);
        } else {
            console.error(`加载系统提示词失败: ${response.status}`);
            return {
                role: "您是一个助手",
                tools: { description: "" },
                rules: []
            };
        }
    } catch (error) {
        console.error('加载系统提示词失败:', error);
        return {
            role: "您是一个助手",
            tools: { description: "" },
            rules: []
        };
    }
};

/**
 * 重置对话
 */
export const resetConversation = () => {
    try {
        return true;
    } catch (e) {
        console.error('重置会话出错:', e);
        return false;
    }
};