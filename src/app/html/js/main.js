/**
 * 主初始化文件 - 处理页面加载后的初始化和事件绑定
 */

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async() => {
    console.log('DOM fully loaded and parsed');

    // 工具复选框事件
    document.getElementById('useTools').addEventListener('change', function() {
        // 不再需要显示工具选项，因为只支持本地工具
    });

    // 创建聊天按钮
    document.getElementById('createChatBtn').addEventListener('click', handleCreateChat);

    // 发送消息按钮
    document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);

    // 消息输入框回车键处理
    document.getElementById('messageInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // 会话导航
    document.getElementById('refreshSessionsBtn').addEventListener('click', refreshSessions);
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (sessionPage > 1) {
            sessionPage--;
            refreshSessions();
        }
    });
    document.getElementById('nextPageBtn').addEventListener('click', () => {
        if (sessionPage * pageSize < totalSessions) {
            sessionPage++;
            refreshSessions();
        }
    });

    // 加载更多消息按钮
    document.getElementById('loadMoreBtn').addEventListener('click', () => {
        if (historyPage * historyPageSize < totalMessages) {
            historyPage++;
            loadChatHistory(false);
        }
    });

    // 删除会话按钮
    document.getElementById('deleteSessionBtn').addEventListener('click', deleteCurrentSession);

    // 编辑标题按钮和模态框
    document.getElementById('editTitleBtn').addEventListener('click', showEditTitleModal);
    document.getElementById('closeTitleModal').addEventListener('click', () => {
        document.getElementById('editTitleModal').classList.add('hidden');
    });
    document.getElementById('saveTitleBtn').addEventListener('click', updateSessionTitle);

    // 查看代理配置按钮
    document.getElementById('viewAgentConfigBtn').addEventListener('click', async() => {
        try {
            const response = await fetch(`${API_BASE_URL}/config`);
            const data = await response.json();

            if (response.ok && data.config) {
                const configContent = document.getElementById('configContent');
                configContent.textContent = JSON.stringify(data.config, null, 2);

                document.getElementById('configModal').classList.remove('hidden');
            } else {
                alert('获取配置失败');
            }
        } catch (error) {
            console.error('获取配置错误:', error);
            alert(`获取配置失败: ${error.message}`);
        }
    });

    // 清除日志按钮
    document.getElementById('clearLogBtn').addEventListener('click', () => {
        document.getElementById('apiResponse').innerText = '';
    });

    // 设置默认用户ID
    currentUserId = document.getElementById('userId').value;

    // 初始化会话管理
    initSessionManager();

    // 初始化聊天功能
    initChatModule();

    // 初始化文件模块
    initFileModule();

    // 等待API配置初始化完成后再加载模型
    setTimeout(async() => {
        try {
            // 加载可用模型列表
            await loadAvailableModels();
        } catch (error) {
            console.error('加载模型列表失败:', error);
        }
    }, 500);
});

// 当创建会话成功时，同步设置文件模块的用户
function syncUserIdToFileModule(userId) {
    setCurrentFileUser(userId);
}

function setupWebSocket(sessionId, userId) {
    if (!sessionId || !userId) return;

    // 关闭现有连接
    if (webSocket && webSocket.readyState !== WebSocket.CLOSED) {
        webSocket.close();
    }

    // 创建新的WebSocket连接
    const wsURL = `${WS_BASE_URL}/ws/${sessionId}/${userId}`;
    webSocket = new WebSocket(wsURL);

    // 连接建立后的处理
    webSocket.onopen = function() {
        console.log('WebSocket连接已建立');
        document.getElementById('sendMessageBtn').disabled = false;
        document.getElementById('messageInput').disabled = false;
        document.getElementById('attachFileBtn').disabled = false; // 启用文件附加按钮

        // 清空旧消息
        document.getElementById('messageContainer').innerHTML = '';

        // 添加欢迎消息
        const welcomeElement = document.createElement('div');
        welcomeElement.className = 'text-center text-gray-500 my-4';
        welcomeElement.innerText = '已连接到会话，可以开始聊天了';
        document.getElementById('messageContainer').appendChild(welcomeElement);
    };

    // 收到消息的处理
    webSocket.onmessage = function(event) {
        receiveText(event);
    };

    // 连接关闭的处理
    webSocket.onclose = function() {
        console.log('WebSocket连接已关闭');
        document.getElementById('sendMessageBtn').disabled = true;
        document.getElementById('messageInput').disabled = true;
        document.getElementById('attachFileBtn').disabled = true; // 禁用文件附加按钮
    };

    // 连接错误的处理
    webSocket.onerror = function(error) {
        console.error('WebSocket错误:', error);
        alert('WebSocket连接出错，请尝试重新连接');
    };
}

// 通过WebSocket发送消息
function sendWebSocketMessage() {
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {
        alert('WebSocket未连接');
        return false;
    }

    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message) {
        return false;
    }

    // 获取选择的文件IDs
    const fileIds = files && typeof files.getSelectedFileIds === 'function' ? files.getSelectedFileIds() : [];

    // 创建消息对象
    const messageObj = {
        message: message,
        file_ids: fileIds // 添加文件ID
    };

    // 发送JSON格式的消息
    webSocket.send(JSON.stringify(messageObj));

    // 清空输入框和文件选择
    messageInput.value = '';
    if (files && typeof files.clearSelectedFiles === 'function') {
        files.clearSelectedFiles();
    }

    return true;
}

function receiveText(event) {
    try {
        const data = JSON.parse(event.data);

        // 根据消息类型处理
        if (data.type === 'message') {
            // 处理文本消息
            const role = data.role || 'assistant';
            const content = data.content || '';
            const fileInfo = data.files || null; // 获取文件信息

            // 使用更新后的addMessage函数，传入文件信息
            window.chatModule.addMessage(role, content, false, fileInfo);

            // 如果是助手回复，可以启用发送按钮
            if (role === 'assistant') {
                setButtonState(true);
            }
        } else if (data.type === 'status') {
            // 处理状态消息
            const statusMessage = data.status || '连接状态已更新';
            updateStatus(statusMessage);
        } else if (data.type === 'error') {
            // 处理错误消息
            const errorMessage = data.error || '发生错误';
            updateStatus(`错误: ${errorMessage}`, true);
            setButtonState(true);
        }
    } catch (error) {
        console.error('无法解析消息:', error);
        updateStatus('无法解析接收到的消息', true);
    }
}