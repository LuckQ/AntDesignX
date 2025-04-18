/**
 * 聊天历史管理和消息处理的公共函数
 */

// 导入API配置
import { API_CONFIG, createApiUrl } from './config.js';

/**
 * 确保用户ID存在
 * @returns {String} 用户ID
 */
export const ensureUserId = () => {
    let userId = localStorage.getItem('dify_user_id');
    if (!userId) {
        // 生成随机用户ID
        userId = 'user_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('dify_user_id', userId);
    }
    return userId;
};

/**
 * 获取服务器会话列表
 * @param {Object} options - 选项参数
 * @param {String} options.last_id - 当前页最后面一条记录的ID
 * @param {Number} options.limit - 一次请求返回多少条记录
 * @param {String} options.sort_by - 排序字段
 * @returns {Promise<Array>} 会话列表数组
 */
export const getServerConversations = async (options = {}) => {
    try {
        const userId = ensureUserId();

        // 使用工具函数创建URL
        const url = createApiUrl('/conversations');

        // 添加用户ID，必选参数
        url.searchParams.append('user', userId);

        // 添加可选参数
        if (options.last_id) {
            url.searchParams.append('last_id', options.last_id);
        }

        if (options.limit) {
            url.searchParams.append('limit', options.limit);
        }

        if (options.sort_by) {
            url.searchParams.append('sort_by', options.sort_by);
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`获取会话列表失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        // 按时间顺序排序会话，最新的在前面
        if (data && Array.isArray(data.data)) {
            data.data.sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return dateB - dateA;
            });
        }

        return data.data || [];
    } catch (error) {
        console.error('获取会话列表失败:', error);
        return [];
    }
};

/**
 * 分析和提取思考内容
 * @param {string} content - 原始消息内容
 * @returns {Object} 包含处理后的内容和思考内容
 */
const extractThinkingContent = (content) => {
    if (!content) return { content: '', reasoning: '' };

    // 思考内容标签
    const THINK_START_TAG = '<think>';
    const THINK_END_TAG = '</think>';
    let reasoning = '';
    let processedContent = content;

    if (content.includes(THINK_START_TAG) && content.includes(THINK_END_TAG)) {
        try {
            // 尝试提取<think>标签中的内容
            const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch && thinkMatch[1]) {
                reasoning = thinkMatch[1].trim();
            }

            // 移除<think>标签及其内容
            processedContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
        } catch (error) {
            console.error('提取思考内容时出错:', error);
            // 出错时回退到原始内容
            processedContent = content;
        }
    }

    return {
        content: processedContent,
        reasoning: reasoning
    };
};

/**
 * 获取服务器会话历史
 * @param {String} conversationId - 会话ID
 * @param {Object} options - 选项
 * @param {Number} options.page - 页码
 * @param {Number} options.pageSize - 每页数量
 * @param {AbortSignal} options.signal - 用于取消请求的信号
 * @returns {Promise<Array>} 会话历史数组
 */
export const getServerConversationHistory = async (conversationId, options = {}) => {
    if (!conversationId) {
        return [];
    }

    try {
        const userId = ensureUserId();
        
        // 构建URL
        const { page = 1, pageSize = 20 } = options;
        
        // 使用工具函数创建URL
        const url = createApiUrl('/messages');
        url.searchParams.append('conversation_id', conversationId);
        url.searchParams.append('user', userId);
        url.searchParams.append('page', page);
        url.searchParams.append('page_size', pageSize);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            // 添加AbortController的signal支持
            signal: options.signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`获取会话历史失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        
        if (data && data.data && Array.isArray(data.data)) {
            // 转换服务器格式为应用程序格式
            return convertServerMessagesToAppFormat(data.data, conversationId);
        }
        
        return [];
    } catch (error) {
        // AbortError是预期的错误，不用记录到控制台
        if (error.name !== 'AbortError') {
            console.error('获取服务器会话历史失败:', error);
        }
        
        // 将AbortError继续抛出以便上层处理
        throw error;
    }
};

/**
 * 将服务器返回的消息格式转换为应用程序格式
 * @param {Array} serverMessages - 服务器返回的消息数组
 * @param {String} conversationId - 对话ID
 * @returns {Array} 格式化后的消息数组
 */
const convertServerMessagesToAppFormat = (serverMessages, conversationId) => {
    // 结果数组，将包含格式化后的消息
    const formattedMessages = [];

    // 分析服务器返回的每条消息
    for (const msg of serverMessages) {
        // 如果有query字段，创建用户消息
        if (msg.query) {
            // 创建基本用户消息
            const userMessage = {
                avatar: 'https://tdesign.gtimg.com/site/avatar.jpg', // 用户头像
                name: '自己',
                datetime: new Date(msg.created_at * 1000).toLocaleString(),
                content: msg.query,
                role: 'user',
                id: msg.id + '_user'
            };
            
            // 如果有files字段，添加到用户消息中
            if (msg.files && Array.isArray(msg.files) && msg.files.length > 0) {
                userMessage.files = msg.files.map(file => ({
                    id: file.id,
                    filename: file.filename || file.name,
                    type: file.type || 'document',
                    size: file.size || 0,
                    url: file.url || ''
                }));
            }
            
            // 如果有message_files字段，添加到用户消息中
            if (msg.message_files && Array.isArray(msg.message_files) && msg.message_files.length > 0) {
                if (!userMessage.files) {
                    userMessage.files = [];
                }
                
                msg.message_files.forEach(file => {
                    userMessage.files.push({
                        id: file.id,
                        filename: file.filename || file.name,
                        type: file.type || 'document',
                        size: file.size || 0,
                        url: file.url || ''
                    });
                });
            }
            
            formattedMessages.push(userMessage);
        }

        // 如果有answer字段，创建助手消息
        if (msg.answer) {
            // 提取思考内容
            const { content, reasoning } = extractThinkingContent(msg.answer);

            // 创建基本助手消息
            const assistantMessage = {
                avatar: '/static/files/favicon.png', // 助手头像
                name: '百年金钟，智启未来',
                datetime: new Date(msg.created_at * 1000).toLocaleString(),
                content: content || '',
                role: 'assistant',
                ...(reasoning ? { reasoning } : {}), // 只有有思考内容时才添加
                id: msg.id + '_assistant'
            };
            
            formattedMessages.push(assistantMessage);
        }
    }

    // 后端API是倒序返回的(最新的在前面)，但前端显示需要正序，所以需要反转
    formattedMessages.reverse();

    return formattedMessages;
};

/**
 * 获取聊天历史
 * @param {String} conversationId - 会话ID
 * @param {Object} options - 分页选项
 * @returns {Promise<Array>} 聊天历史数组
 */
export const getChatHistory = async (conversationId, options = {}) => {
    if (!conversationId) {
        return [];
    }

    try {
        // 从服务器获取会话历史
        const messages = await getServerConversationHistory(conversationId, options);
        if (messages && messages.length > 0) {
            return messages;
        } else {
            return [];
        }
    } catch (err) {
        console.error('获取聊天记录失败:', err);
        return [];
    }
};

/**
 * 构建消息历史用于API请求
 * @param {Array} chatList - 聊天记录
 * @param {string} currentMessage - 当前用户输入的消息
 * @param {string} systemPrompt - 系统提示词
 * @param {number} [messageLimit=10] - 消息数量限制
 * @returns {Array} 格式化后的消息历史
 */
export const buildMessageHistory = (chatList, currentMessage, systemPrompt, messageLimit = 10) => {
    // 构建消息历史
    let hasSystemPrompt = false;
    let messagesToSend = [];
    
    // 对于新消息，先确保我们明确知道当前的用户消息是什么
    // 由于消息存储是倒序的，最新的用户消息应该在chatList的最前面（或者是currentMessage参数）
    let currentUserMessage = currentMessage;
    
    // 如果currentMessage为空，但chatList中有内容，则尝试从chatList获取最新用户消息
    if (!currentUserMessage && chatList && chatList.length > 0) {
        // 查找最新的用户消息（在chatList的前面）
        for (let i = 0; i < chatList.length; i++) {
            if (chatList[i].role === 'user' && chatList[i].content.trim() !== '') {
                currentUserMessage = chatList[i].content;
                break;
            }
        }
    }
    
    // 首先从chatList构建历史消息，但跳过最新的用户消息，因为我们会单独添加它
    let processedMessages = new Set(); // 用于跟踪已处理过的消息
    
    // 按照对话顺序处理消息（由于chatList是倒序的，我们需要反转处理）
    for (let i = chatList.length - 1; i >= 0; i--) {
        const item = chatList[i];
        
        // 只考虑角色是用户、助手或系统且内容不为空的消息
        if ((item.role === 'user' || item.role === 'assistant' || item.role === 'system') && item.content.trim() !== '') {
            // 如果是用户消息，且与当前用户消息相同，则跳过，因为我们会在最后添加当前消息
            if (item.role === 'user' && item.content === currentUserMessage) {
                continue;
            }
            
            // 检查是否已经包含系统提示词
            if (item.role === 'system') {
                hasSystemPrompt = true;
            }
            
            // 将消息内容作为唯一键，防止重复
            const messageKey = `${item.role}:${item.content}`;
            if (!processedMessages.has(messageKey)) {
                messagesToSend.push({
                    role: item.role,
                    content: item.content
                });
                processedMessages.add(messageKey);
            }
        }
    }

    // 添加当前的用户消息（确保只添加一次）
    if (currentUserMessage && currentUserMessage.trim() !== '') {
        const messageKey = `user:${currentUserMessage}`;
        if (!processedMessages.has(messageKey)) {
            messagesToSend.push({
                role: 'user',
                content: currentUserMessage
            });
        }
    }

    // 限制只取最近指定数量条消息
    if (messagesToSend.length > messageLimit) {
        messagesToSend = messagesToSend.slice(-messageLimit);
    }

    // 如果消息中没有系统提示词，且系统提示词存在，则添加到最前面
    if (!hasSystemPrompt && systemPrompt) {
        messagesToSend.unshift({
            role: 'system',
            content: systemPrompt
        });
    }
    
    return messagesToSend;
};

/**
 * 滚动聊天窗口到底部
 * @param {Object} chatRef - 聊天容器的引用
 */
export const scrollToBottom = (chatRef) => {
    if (chatRef) {
        chatRef.scrollToBottom({
            behavior: 'smooth',
        });
    }
};

/**
 * 创建用户消息对象
 * @param {string} content - 消息内容
 * @param {Array} files - 文件数组，可选
 * @returns {Object} 用户消息对象
 */
export const createUserMessage = (content, files = []) => {
    const userMessage = {
        avatar: 'https://tdesign.gtimg.com/site/avatar.jpg',
        name: '自己',
        datetime: new Date().toLocaleString(),
        content: content || '',
        role: 'user',
    };
    
    // 如果有文件，添加到消息对象
    if (files && Array.isArray(files) && files.length > 0) {
        userMessage.files = files.map(file => ({
            id: file.upload_file_id || file.id,
            filename: file.filename || file.name || '未命名文件',
            type: file.type || 'document',
            size: file.size || 0,
            url: file.url || ''
        }));
    }
    
    return userMessage;
};

/**
 * 创建助手消息对象
 * @param {boolean} isDeepThinking - 是否为深度思考模式
 * @returns {Object} 助手消息对象
 */
export const createAssistantMessage = (isDeepThinking = false) => {
    const baseMessage = {
        avatar: '/static/files/favicon.png',
        name: '百年金钟，智启未来',
        datetime: new Date().toLocaleString(),
        content: '',
        role: 'assistant',
    };

    if (isDeepThinking) {
        return {
            ...baseMessage,
            reasoning: '思考中...'
        };
    }

    return baseMessage;
};

/**
 * 自动重命名会话（如果需要）
 * 会在以下情况触发自动重命名：
 * 1. 新对话的前三次对话后
 * 2. 对话消息数量为5、10、15等（每5条消息）时
 * @param {String} conversationId - 会话ID
 * @param {Object} options - 选项
 * @param {Array} options.messages - 当前消息列表，可选，如提供则不再从服务器获取
 * @param {Function} options.onComplete - 完成回调函数
 */
export const autoRenameConversationIfNeeded = async (conversationId, options = {}) => {
    try {
        if (!conversationId) {
            console.log('会话ID为空，跳过自动重命名');
            return false;
        }

        // 获取当前会话的消息
        let messages = options.messages || [];
        
        if (!messages.length) {
            messages = await getServerConversationHistory(conversationId);
        }
        
        const messageCount = messages.length;

        // 计算用户和助手消息对的数量（一问一答算一轮对话）
        // 由于每个消息都会创建用户和助手两条记录，所以总消息数除以2就是对话轮数
        const conversationTurns = Math.floor(messageCount / 2);

        // 获取当前会话信息，以检查是否已经有自定义名称
        const conversations = await getServerConversations();
        const currentConversation = conversations.find(conv => conv.id === conversationId);

        // 判断是否需要执行自动重命名
        // 条件：
        // 1. 会话在前三轮对话后
        // 2. 对话轮数为5、10、15等（每5轮执行一次）
        // 3. 当前会话名称为空或是默认生成的名称
        const needRename = (
            // 新对话的前三轮，或者每5轮对话
            (conversationTurns <= 3 || (conversationTurns >= 5 && conversationTurns % 5 === 0)) &&
            // 会话没有名称或有默认名称
            (!currentConversation || !currentConversation.name || currentConversation.name.startsWith('新对话') || currentConversation.name === 'New conversation')
        );

        if (needRename) {
            console.log('[自动重命名] 需要重命名对话:', conversationId, '当前轮数:', conversationTurns);
            
            try {
                // 尝试使用工作流API生成标题
                // 首先，提取对话内容
                let conversationContent = '';
                
                // 按照时间顺序添加消息内容（从旧到新）
                // 确保按时间顺序排序
                const sortedMessages = [...messages].sort((a, b) => {
                    // 如果有datetime属性（毫秒时间戳），使用它来排序
                    if (a.datetime && b.datetime) {
                        return a.datetime - b.datetime;
                    }
                    // 如果有created_at属性（ISO日期字符串或秒级时间戳），使用它来排序
                    if (a.created_at && b.created_at) {
                        const timeA = typeof a.created_at === 'string' ? new Date(a.created_at).getTime() : a.created_at * 1000;
                        const timeB = typeof b.created_at === 'string' ? new Date(b.created_at).getTime() : b.created_at * 1000;
                        return timeA - timeB;
                    }
                    return 0; // 无法比较时保持原顺序
                });
                
                // 从所有消息中提取时间顺序下的"对话轮次"
                const dialogPairs = [];
                let currentPair = { user: null, assistant: null };
                
                for (const msg of sortedMessages) {
                    if (msg.role === 'user') {
                        // 如果当前对中已有用户消息，创建新对
                        if (currentPair.user !== null) {
                            dialogPairs.push({...currentPair});
                            currentPair = { user: null, assistant: null };
                        }
                        currentPair.user = msg.content;
                    } else if (msg.role === 'assistant') {
                        // 如果助手回复先于用户消息，创建新对
                        if (currentPair.assistant !== null) {
                            dialogPairs.push({...currentPair});
                            currentPair = { user: null, assistant: null };
                        }
                        currentPair.assistant = msg.content;
                    }
                }
                
                // 添加最后一对对话（如果有）
                if (currentPair.user !== null || currentPair.assistant !== null) {
                    dialogPairs.push(currentPair);
                }
                
                // 取最近的5轮完整对话（或全部，如果不足5轮）
                const recentPairs = dialogPairs.slice(-5);
                
                // 构建完整对话内容
                for (let i = 0; i < recentPairs.length; i++) {
                    const pair = recentPairs[i];
                    conversationContent += `[第${i+1}轮]\n`;
                    if (pair.user) {
                        conversationContent += `用户: ${pair.user}\n`;
                    }
                    if (pair.assistant) {
                        conversationContent += `助手: ${pair.assistant}\n`;
                    }
                    conversationContent += '\n';
                }
                
                console.log('[自动重命名] 提取的对话内容:', conversationContent.length, '字节');
                
                // 如果消息内容为空，则使用默认重命名
                if (!conversationContent.trim()) {
                    console.log('[自动重命名] 消息内容为空，使用默认重命名方式');
                    const renameResult = await renameConversation(conversationId, { auto_generate: true });
                    if (!renameResult.success) {
                        console.warn('[自动重命名] 默认重命名失败:', renameResult.message);
                    }
                    return renameResult.success;
                }
                
                // 导入工作流API
                const { generateArticleTitle } = await import('/static/api/workflow.js');
                
                let titleGenerated = false;
                let generatedTitle = '';
                
                // 调用工作流API生成标题
                const result = await generateArticleTitle(conversationContent, {
                    onOutput: async (output) => {
                        if (output && output.text) {
                            const title = output.text.trim();
                            console.log('[自动重命名] 生成的标题:', title);
                            
                            if (title) {
                                titleGenerated = true;
                                generatedTitle = title;
                                
                                // 使用生成的标题重命名会话
                                const renameResult = await renameConversation(conversationId, { name: title });
                                
                                // 处理重命名结果
                                if (renameResult.success) {
                                    console.log('[自动重命名] 重命名成功:', title);
                                    // 调用完成回调
                                    if (typeof options.onComplete === 'function') {
                                        options.onComplete(title);
                                    }
                                } else {
                                    console.error('[自动重命名] 重命名失败:', renameResult.message);
                                    // 尝试使用默认重命名
                                    console.log('[自动重命名] 尝试使用默认方式重命名');
                                    const defaultRenameResult = await renameConversation(conversationId, { auto_generate: true });
                                    if (defaultRenameResult.success && typeof options.onComplete === 'function') {
                                        options.onComplete(defaultRenameResult.name || '');
                                    }
                                }
                            }
                        }
                    },
                    onError: async (error) => {
                        console.error('[自动重命名] 生成标题失败:', error);
                        // 发生错误时使用默认方式重命名
                        const renameResult = await renameConversation(conversationId, { auto_generate: true });
                        if (renameResult.success && typeof options.onComplete === 'function') {
                            options.onComplete(renameResult.name || '');
                        }
                    },
                    onComplete: async (success) => {
                        // 如果没有生成标题，但工作流执行成功，可能是没有返回标题或其他情况
                        if (success && !titleGenerated) {
                            console.warn('[自动重命名] 工作流执行成功但未生成标题，使用默认重命名');
                            const renameResult = await renameConversation(conversationId, { auto_generate: true });
                            if (renameResult.success && typeof options.onComplete === 'function') {
                                options.onComplete(renameResult.name || '');
                            }
                        }
                    }
                }, {
                    responseMode: 'streaming', // 改为流式传输模式
                    userId: 'title-generator'
                });
                
                // 如果标题已生成，则已经处理过了，返回true
                if (titleGenerated) {
                    console.log('[自动重命名] 标题已生成并应用:', generatedTitle);
                    return true;
                }
                
                // 如果工作流执行失败，使用默认重命名
                if (!result.success) {
                    console.warn('[自动重命名] 生成标题工作流执行失败，使用默认重命名');
                    const renameResult = await renameConversation(conversationId, { auto_generate: true });
                    return renameResult.success;
                }
                
                return true;
                
            } catch (workflowError) {
                console.error('[自动重命名] 使用工作流生成标题失败，回退到默认方式:', workflowError);
                // 如果工作流API调用失败，使用默认API重命名
                const renameResult = await renameConversation(conversationId, { auto_generate: true });
                return renameResult.success;
            }
        }
        
        return false;
    } catch (error) {
        console.error('[自动重命名] 自动重命名失败:', error);
        return false;
    }
};

/**
 * 重命名会话
 * @param {String} conversationId - 会话ID
 * @param {Object} options - 选项
 * @param {String} options.name - 名称，若auto_generate为true时可不传
 * @param {Boolean} options.auto_generate - 是否自动生成标题，默认false
 * @returns {Promise<Object>} 请求结果
 */
export const renameConversation = async (conversationId, options = {}) => {
    const userId = ensureUserId();

    try {
        // 创建请求体
        const requestBody = {
            user: userId
        };

        // 添加name或auto_generate
        if (options.auto_generate) {
            requestBody.auto_generate = true;
        } else if (options.name) {
            requestBody.name = options.name;
        }

        console.log(`[重命名] 尝试重命名会话 ${conversationId}`, {
            auto_generate: options.auto_generate,
            name: options.name,
            API地址: `${API_CONFIG.baseURL}/conversations/${conversationId}/name`
        });

        const response = await fetch(`${API_CONFIG.baseURL}/conversations/${conversationId}/name`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        // 获取响应文本，无论成功还是失败
        const responseText = await response.text();
        let responseData;
        
        try {
            // 尝试解析为JSON
            responseData = JSON.parse(responseText);
        } catch (e) {
            // 如果不是JSON，保留原始文本
            responseData = responseText;
        }
        
        if (!response.ok) {
            console.error(`[重命名] 重命名会话失败: ${response.status}`, responseData);
            // 不抛出异常，而是返回错误对象
            return { 
                success: false, 
                status: response.status,
                error: responseData,
                message: `重命名会话失败: ${response.status}`
            };
        }

        console.log(`[重命名] 会话重命名成功: ${conversationId}`, responseData);
        return { 
            success: true,
            ...responseData
        };
    } catch (error) {
        console.error('[重命名] 重命名会话错误:', error);
        // 不抛出异常，返回错误信息
        return { 
            success: false, 
            error: error,
            message: error.message || '重命名会话失败'
        };
    }
};

/**
 * 删除会话
 * @param {String} conversationId - 会话ID
 * @returns {Promise<Object>} 请求结果
 */
export const deleteConversation = async (conversationId) => {
    const userId = ensureUserId();

    try {
        // 创建请求体
        const requestBody = {
            user: userId,
        };

        const response = await fetch(`${API_CONFIG.baseURL}/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`删除会话失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('删除会话错误:', error);
        throw error;
    }
};

/**
 * 获取当前会话或创建新会话
 * 返回会话列表中的第一个会话，如果没有则返回空字符串
 * @returns {Promise<String>} 会话ID
 */
export const getCurrentConversation = async () => {
    try {
        // 获取会话列表
        const conversations = await getServerConversations({ limit: 1 });

        // 如果有会话，返回第一个会话的ID
        if (conversations && conversations.length > 0) {
            return conversations[0].id;
        }

        // 如果没有会话，返回空字符串，表示创建新会话
        return '';
    } catch (error) {
        console.error('获取当前会话失败:', error);
        return '';
    }
};

/**
 * 清空聊天历史
 * 在服务端没有直接清空历史的API，此函数仅重置当前状态
 * @param {String} conversationId - 会话ID
 * @returns {Promise<boolean>} 是否清空成功
 */
export const clearChatHistory = async (conversationId) => {
    try {
        if (conversationId) {
            // 如果有会话ID，删除该会话
            await deleteConversation(conversationId);
        }
        return true;
    } catch (err) {
        console.error('清空聊天记录失败:', err);
        return false;
    }
};

/**
 * 保存聊天历史到本地（兼容性实现，不再执行实际操作）
 * @param {Array} chatList - 聊天记录数组
 * @returns {Promise<boolean>} 始终返回true
 */
export const saveChatHistory = () => {
    return Promise.resolve(true);
};

/**
 * 获取消息建议问题
 * @param {String} messageId - 消息ID
 * @returns {Promise<Array>} 建议问题列表
 */
export const getSuggestedQuestions = async (messageId) => {
    try {
        const userId = ensureUserId();

        // 使用正确的API端点
        const url = createApiUrl(`/messages/${messageId}/suggested`);
        url.searchParams.append('user', userId);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`获取建议问题失败: ${response.status}`);
        }

        const data = await response.json();

        // 检查返回数据结构
        if (data && data.data && Array.isArray(data.data)) {
            // 返回建议问题列表
            return data.data;
        } else {
            return [];
        }
    } catch (error) {
        console.error('获取建议问题失败:', error);
        return [];
    }
};