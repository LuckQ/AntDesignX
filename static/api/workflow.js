/**
 * 工作流API模块 - 处理无会话工作流调用
 */

// 导入API配置
import { API_CONFIG, createApiUrl } from './config.js';

/**
 * 执行工作流
 * @param {Object} inputs - 输入变量，如{content: "要处理的内容"}
 * @param {String} responseMode - 响应模式：'streaming'或'blocking'
 * @param {Object} options - 其他选项
 * @returns {Promise} 请求Promise
 */
export const runWorkflow = async (inputs = {}, responseMode = 'streaming', options = {}) => {
    try {
        const userId = options.userId || 'default-user';
        const workflowId = options.workflowId || '';

        // 使用工具函数创建URL
        const url = createApiUrl('/workflows/run');

        // 构建请求体
        const requestBody = {
            inputs: inputs,
            response_mode: responseMode,
            user: userId
        };

        console.log('[Workflow] 开始执行工作流:', {
            inputs,
            responseMode,
            userId
        });

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
            throw new Error(`工作流请求失败: ${response.status}`);
        }

        return response;
    } catch (error) {
        console.error('执行工作流失败:', error);
        throw error;
    }
};

/**
 * 处理工作流流式响应
 * @param {Promise} responsePromise - 响应Promise
 * @param {Object} callbacks - 回调函数对象
 */
export const handleWorkflowStreamResponse = async (responsePromise, callbacks = {}) => {
    const {
        onStart,
        onNodeStart,
        onNodeFinish,
        onFinish,
        onOutput,
        onError,
        onComplete,
        onTTSMessage,
        onTTSMessageEnd
    } = callbacks;

    try {
        // 检查responsePromise是否已经被中断
        if (responsePromise.signal && responsePromise.signal.aborted) {
            console.log('[Workflow] 请求已中断');
            onComplete?.(false, '请求已中断');
            return;
        }

        const response = await responsePromise;

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Workflow] API请求失败:', response.status, errorText);
            throw new Error(`API请求失败: ${response.status} ${errorText}`);
        }

        console.log('[Workflow] 开始处理流式响应');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let workflowRunId = null;
        let taskId = null;

        // 添加错误捕获包装
        try {
            while (true) {
                // 检查是否请求已被中断
                if (responsePromise.signal && responsePromise.signal.aborted) {
                    console.log('[Workflow] 检测到请求中断信号，停止处理流');
                    break;
                }

                const { done, value } = await reader.read();

                if (done) {
                    console.log('[Workflow] 流读取完成');
                    break;
                }

                // 解码接收到的数据
                buffer += decoder.decode(value, { stream: true });

                // 处理缓冲区中的数据行
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ''; // 最后一行可能不完整，保留到下一次

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(line.substring(6));
                        // 保存工作流运行ID和任务ID
                        if (data.workflow_run_id && !workflowRunId) {
                            workflowRunId = data.workflow_run_id;
                        }

                        if (data.task_id && !taskId) {
                            taskId = data.task_id;
                            // 使用回调通知上层组件
                            if (callbacks.onTaskIdChange) {
                                callbacks.onTaskIdChange(taskId);
                            }
                        }

                        // 处理不同类型的事件
                        if (data.event === 'workflow_started') {
                            console.log('%c[Workflow] 收到工作流开始事件: workflow_started', 'color: #4CAF50; font-weight: bold;');
                            onStart?.(data.data);
                        } else if (data.event === 'node_started') {
                            console.log('%c[Workflow] 收到节点开始事件: node_started', 'color: #4CAF50; font-weight: bold;');
                            console.log('%c[Workflow Node Started]', 'color: #2196F3; font-weight: bold;', {
                                title: data.data?.title
                            });
                            onNodeStart?.(data.data);
                        } else if (data.event === 'node_finished') {
                            console.log('%c[Workflow] 收到节点完成事件: node_finished', 'color: #4CAF50; font-weight: bold;');
                            onNodeFinish?.(data.data);
                        } else if (data.event === 'workflow_finished') {
                            console.log('%c[Workflow] 收到工作流完成事件: workflow_finished', 'color: #4CAF50; font-weight: bold;');
                            // 处理工作流完成事件
                            onFinish?.(data.data);

                            // 如果有输出内容，调用输出回调
                            if (data.data && data.data.outputs) {
                                onOutput?.(data.data.outputs);
                            }
                        } else if (data.event === 'tts_message') {
                            console.log('%c[Workflow] 收到TTS事件: tts_message', 'color: #4CAF50; font-weight: bold;');
                            onTTSMessage?.(data);
                        } else if (data.event === 'tts_message_end') {
                            console.log('%c[Workflow] 收到TTS结束事件: tts_message_end', 'color: #4CAF50; font-weight: bold;');
                            onTTSMessageEnd?.(data);
                        } else if (data.event === 'error') {
                            console.error('%c[Workflow] 收到错误事件: error', 'color: #F44336; font-weight: bold;', data);
                            onError?.(data.message || '工作流处理错误');
                        } else if (data.event === 'ping') {
                            console.log('%c[Workflow] 收到ping事件', 'color: #607D8B; font-style: italic;');
                            // 忽略ping事件
                        }
                    } catch (e) {
                        console.error('%c[Workflow] 解析流数据失败:', 'color: #F44336; font-weight: bold;', e);
                    }
                }
            }
        } catch (streamError) {
            // 处理流处理过程中的错误
            console.error('[Workflow] 流处理过程中出错:', streamError);
            const errorMsg = streamError.message || '';

            if (streamError.name === 'AbortError' ||
                errorMsg.includes('aborted') ||
                errorMsg.includes('abort')) {
                console.log('[Workflow] 请求被中断');
                onComplete?.(false, '请求处理过程已中断');
                return;
            }
            throw streamError;
        } finally {
            // 确保释放资源
            try {
                reader.releaseLock();
                console.log('[Workflow] 读取器已释放');
            } catch (e) {
                console.warn('[Workflow] 释放读取锁时出错:', e);
            }
        }

        console.log('[Workflow] 流处理完成');
        onComplete?.(true);
    } catch (error) {
        console.error('[Workflow] 流式请求错误:', error);

        // 判断是否是AbortError（请求被中断）
        if (error.name === 'AbortError' ||
            error.message.includes('aborted')) {
            console.log('[Workflow] 请求中断错误');
            onComplete?.(false, '请求已中断');
        } else {
            console.error('[Workflow] 请求失败错误');
            onError?.(error.message || '请求失败');
            onComplete?.(false, error.message);
        }
    }
};

/**
 * 封装的工作流执行方法
 * @param {Object} inputs - 输入变量
 * @param {Object} callbacks - 回调函数
 * @param {Object} options - 其他选项
 * @returns {Object} 请求结果
 */
export const executeWorkflow = async (inputs = {}, callbacks = {}, options = {}) => {
    try {
        const userId = options.userId || 'default-user';
        const responseMode = options.responseMode || 'streaming';

        console.log('[Workflow] 开始工作流请求', {
            inputs,
            userId,
            responseMode,
            hasSignal: !!options.signal
        });

        // 发送请求
        const responsePromise = runWorkflow(
            inputs,
            responseMode,
            {
                userId,
                signal: options.signal
            }
        );

        // 如果是阻塞模式，直接返回结果
        if (responseMode === 'blocking') {
            const response = await responsePromise;
            const result = await response.json();
            callbacks.onOutput?.(result.data?.outputs);
            callbacks.onComplete?.(true);
            return { success: true, data: result };
        }

        // 处理流式响应
        try {
            console.log('[Workflow] 开始处理流式响应');
            await handleWorkflowStreamResponse(responsePromise, callbacks);
            console.log('[Workflow] 流式响应处理成功');
            return { success: true };
        } catch (streamError) {
            console.error('[Workflow] 流处理过程中出错:', streamError);

            if (streamError.name === 'AbortError' ||
                streamError.message?.includes('aborted')) {
                console.log('[Workflow] 流处理被中断');
                callbacks.onComplete?.(false, '请求已中断');
                return { success: false, aborted: true, error: streamError };
            }

            console.error('[Workflow] 流处理失败:', streamError.message || '未知错误');
            callbacks.onError?.(streamError.message || '流处理失败');
            callbacks.onComplete?.(false, streamError.message);
            return { success: false, error: streamError };
        }
    } catch (error) {
        console.error('[Workflow] 工作流请求错误:', error);

        if (error.name === 'AbortError' ||
            error.message?.includes('aborted')) {
            console.log('[Workflow] 工作流请求被中断');
            callbacks.onComplete?.(false, '请求已中断');
            return { success: false, aborted: true, error };
        }

        console.error('[Workflow] 工作流请求失败:', error.message || '未知错误');
        callbacks.onError?.(error.message || '请求失败');
        callbacks.onComplete?.(false, error.message);
        return { success: false, error };
    }
};

/**
 * 停止工作流执行
 * @param {String} taskId - 任务ID
 * @param {String} userId - 用户ID
 * @returns {Promise} 请求Promise
 */
export const stopWorkflowExecution = async (taskId, userId = 'default-user') => {
    try {
        if (!taskId) {
            throw new Error('任务ID不能为空');
        }

        // 使用工具函数创建URL
        const url = createApiUrl(`/workflows/tasks/${taskId}/stop`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify({ user: userId })
        });

        if (!response.ok) {
            throw new Error(`停止工作流请求失败: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('停止工作流执行失败:', error);
        throw error;
    }
};

/**
 * 自动生成文章标题（使用特定工作流）
 * @param {String} content - 文章内容
 * @param {Object} callbacks - 回调函数
 * @param {Object} options - 其他选项
 * @returns {Object} 请求结果
 */
export const generateArticleTitle = async (content, callbacks = {}, options = {}) => {
    try {
        const userId = options.userId || 'default-user';
        const responseMode = options.responseMode || 'streaming';

        // 使用特定的工作流API密钥，而不是通用API密钥
        const workflowApiKey = 'app-6aRhLAp4zAppCJus5ViMgOsh';  // 直接使用固定的工作流API密钥

        // 构建输入变量
        const inputs = {
            content: content  // 工作流需要的输入变量是content
        };

        console.log('[WorkflowTitle] 开始执行标题生成工作流:', {
            contentLength: content.length,
            responseMode,
            userId
        });

        // 使用工具函数创建URL
        const url = createApiUrl('/workflows/run');

        // 构建请求体
        const requestBody = {
            inputs: inputs,
            response_mode: responseMode,
            user: userId
        };

        console.log('[WorkflowTitle] 发送工作流请求:', {
            url: url.toString(),
            workflowApiKey: workflowApiKey.substring(0, 10) + '...',
            requestBody
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${workflowApiKey}`  // 使用工作流专用密钥
            },
            body: JSON.stringify(requestBody),
            signal: options.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[WorkflowTitle] 请求失败:', response.status, errorText);
            throw new Error(`标题生成工作流请求失败: ${response.status} - ${errorText}`);
        }

        // 如果是阻塞模式，直接返回结果
        if (responseMode === 'blocking') {
            const result = await response.json();
            console.log('[WorkflowTitle] 收到阻塞模式响应:', result);

            // 提取标题，过滤思考内容
            let title = result.data?.outputs?.text || '';
            title = extractFinalTitle(title);

            console.log('[WorkflowTitle] 最终生成的标题:', title);

            if (title) {
                callbacks.onOutput?.({ text: title });
            } else {
                console.warn('[WorkflowTitle] 未从响应中找到有效标题');
                callbacks.onError?.('未能生成有效标题');
            }

            callbacks.onComplete?.(true);
            return { success: true, data: result, title };
        }

        // 处理流式响应
        try {
            console.log('[WorkflowTitle] 开始处理流式响应');

            // 创建自定义回调函数，专注于提取标题
            const titleCallbacks = {
                ...callbacks,
                onOutput: (outputs) => {
                    let title = outputs.text || '';
                    // 过滤掉思考内容
                    title = extractFinalTitle(title);

                    console.log('[WorkflowTitle] 获得过滤后的标题:', title);
                    if (title) {
                        callbacks.onOutput?.({ text: title });
                    }
                },
                onFinish: (data) => {
                    if (callbacks.onFinish) {
                        callbacks.onFinish(data);
                    }

                    // 如果输出中包含思考部分，再次过滤一次
                    if (data && data.outputs && data.outputs.text) {
                        let title = data.outputs.text;
                        title = extractFinalTitle(title);

                        if (title && title !== data.outputs.text) {
                            console.log('[WorkflowTitle] 工作流完成后过滤标题:', title);
                            callbacks.onOutput?.({ text: title });
                        }
                    }
                }
            };

            await handleWorkflowStreamResponse(response, titleCallbacks);
            console.log('[WorkflowTitle] 流式响应处理成功');
            return { success: true };
        } catch (streamError) {
            console.error('[WorkflowTitle] 流处理过程中出错:', streamError);

            if (streamError.name === 'AbortError' ||
                streamError.message?.includes('aborted')) {
                console.log('[WorkflowTitle] 流处理被中断');
                callbacks.onComplete?.(false, '请求已中断');
                return { success: false, aborted: true, error: streamError };
            }

            console.error('[WorkflowTitle] 流处理失败:', streamError.message || '未知错误');
            callbacks.onError?.(streamError.message || '标题生成失败');
            callbacks.onComplete?.(false, streamError.message);
            return { success: false, error: streamError };
        }
    } catch (error) {
        console.error('[WorkflowTitle] 标题生成请求错误:', error);

        if (error.name === 'AbortError' ||
            error.message?.includes('aborted')) {
            console.log('[WorkflowTitle] 标题生成请求被中断');
            callbacks.onComplete?.(false, '请求已中断');
            return { success: false, aborted: true, error };
        }

        console.error('[WorkflowTitle] 标题生成请求失败:', error.message || '未知错误');
        callbacks.onError?.(error.message || '请求失败');
        callbacks.onComplete?.(false, error.message);
        return { success: false, error };
    }
};

/**
 * 从返回的文本中提取最终标题，过滤掉思考过程
 * @param {String} text - 包含可能的思考过程的文本
 * @returns {String} 提取的最终标题
 */
function extractFinalTitle(text) {
    if (!text) return '';

    // 过滤掉<think>...</think>思考部分
    const thinkRegex = /<think>[\s\S]*?<\/think>/;
    text = text.replace(thinkRegex, '');

    // 移除开头和结尾的空白字符和换行符
    text = text.trim();

    console.log('[WorkflowTitle] 过滤后的标题:', text);
    return text;
} 