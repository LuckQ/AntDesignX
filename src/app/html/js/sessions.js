/**
 * 会话管理相关函数 - 处理聊天会话的创建、加载和管理
 */

// 初始化会话管理
function initSessionManager() {
    // 初始化UI
    document.getElementById('createChatBtn').addEventListener('click', handleCreateChat);
    document.getElementById('refreshSessionsBtn').addEventListener('click', refreshSessions);

    // 尝试从localStorage加载用户ID
    const savedUserId = localStorage.getItem('currentUserId');
    if (savedUserId) {
        document.getElementById('userId').value = savedUserId;
        currentUserId = savedUserId;

        // 加载会话列表
        refreshSessions();
    }
}

// 创建新的聊天会话
async function createChat() {
    const userId = document.getElementById('userId').value.trim();
    if (!userId) {
        alert('请输入用户ID');
        return;
    }

    currentUserId = userId;

    // 获取自定义模型名称或使用默认空字符串
    const customModel = document.getElementById('customModel').value.trim();

    // 获取所选模型的ID
    const modelSelect = document.getElementById('modelProvider');
    const selectedOption = modelSelect.options[modelSelect.selectedIndex];
    const provider = selectedOption.value;

    // 如果选择了特定模型（非default），则获取模型ID
    let modelId = "default";
    if (provider !== 'default' && selectedOption.dataset.modelId) {
        modelId = selectedOption.dataset.modelId;
    }

    const requestData = {
        user_id: userId,
        system_prompt: document.getElementById('systemPrompt').value.trim(),
        use_tools: document.getElementById('useTools').checked,
        tool_type: "local", // 只使用本地工具
        model_provider: provider,
        model_name: customModel || modelId, // 如果有自定义模型则使用，否则使用选中的模型ID
        enable_retrieval: false, // 不使用检索
        title: currentTitle // 添加会话标题
    };

    const response = await apiRequest('/create-chat', 'POST', requestData);
    if (response) {
        currentSessionId = response.session_id;
        currentTitle = response.title || "新对话";

        // 更新UI
        document.getElementById('currentSessionInfo').innerText =
            `当前会话: ${currentTitle}`;

        // 启用聊天控件
        document.getElementById('messageInput').disabled = false;
        document.getElementById('sendMessageBtn').disabled = false;

        // 清除并重新加载消息容器
        document.getElementById('messageContainer').innerHTML = '';

        // 如果提供了系统提示，则添加
        if (requestData.system_prompt) {
            addMessage('system', requestData.system_prompt);
        }

        // 刷新会话列表
        refreshSessions();

        // 加载聊天历史
        historyPage = 1;
        loadChatHistory(true);

        // 聚焦消息输入框
        document.getElementById('messageInput').focus();

        // 同步更新文件模块的用户ID
        syncUserIdToFileModule(userId);
    }
}

// 刷新聊天会话列表
async function refreshSessions() {
    try {
        const endpoint = `/list-chats?user_id=${currentUserId}&page=${sessionPage}&page_size=${pageSize}`;
        const response = await apiRequest(endpoint, 'GET');

        const sessionList = document.getElementById('sessionList');

        if (response && response.chats.length > 0) {
            totalSessions = response.total;

            // 清空会话列表
            sessionList.innerHTML = '';

            // 添加每个会话
            response.chats.forEach(session => {
                const sessionDiv = document.createElement('div');
                sessionDiv.className = 'border rounded-md p-3 mb-2 cursor-pointer hover:bg-gray-50';
                sessionDiv.onclick = () => selectSession(session.session_id, session.features, session.title);
                const lastMsg = session.last_message ? session.last_message : '';
                sessionDiv.innerHTML = `
                    <div class="font-medium">${session.title || '新对话'}</div>
                    <div class="text-sm text-gray-500">ID: ${session.session_id.substring(0, 8)}...</div>
                    <div class="text-sm text-gray-500">创建于: ${formatDate(session.created_at)}</div>
                    <div class="text-sm text-gray-500 truncate">${lastMsg}</div>
                `;

                sessionList.appendChild(sessionDiv);
            });

            // 更新分页
            document.getElementById('paginationInfo').innerText = `第 ${sessionPage} 页，共 ${Math.ceil(totalSessions / pageSize)} 页`;
            document.getElementById('prevPageBtn').disabled = sessionPage <= 1;
            document.getElementById('nextPageBtn').disabled = sessionPage * pageSize >= totalSessions;
        } else {
            sessionList.innerHTML = '<div class="text-gray-500 text-center">未找到会话</div>';
            document.getElementById('paginationInfo').innerText = '第 1 页';
            document.getElementById('prevPageBtn').disabled = true;
            document.getElementById('nextPageBtn').disabled = true;
        }
    } catch (error) {
        console.error('获取会话列表失败:', error);
        document.getElementById('sessionList').innerHTML = '<div class="text-gray-500 text-center">加载会话失败</div>';
    }
}

// 选择要查看/继续的会话
function selectSession(sessionId, features, title) {
    currentSessionId = sessionId;
    currentSessionFeatures = features; // 保存会话特性信息
    currentTitle = title || "新对话"; // 保存会话标题
    historyPage = 1; // 重置消息分页

    // 更新UI
    document.getElementById('currentSessionInfo').innerText =
        `当前会话: ${currentTitle}`;

    // 启用聊天控件
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendMessageBtn').disabled = false;
    document.getElementById('deleteSessionBtn').disabled = false;
    document.getElementById('attachFileBtn').disabled = false;

    // 高亮选中的会话
    const sessionItems = document.querySelectorAll('#sessionList > div');
    sessionItems.forEach(item => {
        if (item.querySelector('.text-sm').innerText.includes(sessionId.substring(0, 8))) {
            item.classList.add('bg-blue-50', 'border-blue-300');
        } else {
            item.classList.remove('bg-blue-50', 'border-blue-300');
        }
    });

    // 显示会话设置信息
    if (features) {
        document.getElementById('settingTitle').innerText = title || '新对话';
        document.getElementById('settingModel').innerText = features.model || '-';
        document.getElementById('settingProvider').innerText = features.model_provider || '-';
        document.getElementById('settingTools').innerText = features.tools_enabled ? '已启用' : '已禁用';
        document.getElementById('settingToolType').innerText = features.tool_type || '-';
        document.getElementById('settingRetrieval').innerText = features.retrieval_enabled ? '已启用' : '已禁用';
        document.getElementById('sessionSettings').classList.remove('hidden');
    } else {
        document.getElementById('sessionSettings').classList.add('hidden');
    }

    // 加载聊天历史
    loadChatHistory(true);
}

// 加载聊天历史
async function loadChatHistory(clearExisting = true) {
    if (!currentSessionId) return;

    const requestData = {
        session_id: currentSessionId,
        user_id: currentUserId,
        page: historyPage,
        page_size: historyPageSize
    };

    const response = await apiRequest('/chat-history', 'POST', requestData);

    if (response) {
        totalMessages = response.total;

        // 更新消息容器
        const messageContainer = document.getElementById('messageContainer');

        if (clearExisting) {
            messageContainer.innerHTML = '';
        }

        // 添加消息（历史加载时倒序）
        const messages = [...response.messages].reverse();

        for (const msg of messages) {
            console.log("处理消息: ", msg);

            // 检查消息是否包含附件信息
            let fileInfo = null;

            // 支持多种可能的文件信息字段名和结构
            if (msg.file_info) {
                // 处理file_info为对象且包含files数组的情况
                if (typeof msg.file_info === 'object' && msg.file_info.files && Array.isArray(msg.file_info.files)) {
                    fileInfo = msg.file_info.files;
                    console.log("从file_info.files获取到文件列表:", fileInfo);
                }
                // 处理file_info直接为数组的情况
                else if (Array.isArray(msg.file_info) && msg.file_info.length > 0) {
                    fileInfo = msg.file_info;
                    console.log("从file_info数组获取到文件列表:", fileInfo);
                }
            }
            // 处理fileInfo字段
            else if (msg.fileInfo) {
                if (typeof msg.fileInfo === 'object' && msg.fileInfo.files && Array.isArray(msg.fileInfo.files)) {
                    fileInfo = msg.fileInfo.files;
                    console.log("从fileInfo.files获取到文件列表:", fileInfo);
                } else if (Array.isArray(msg.fileInfo) && msg.fileInfo.length > 0) {
                    fileInfo = msg.fileInfo;
                    console.log("从fileInfo数组获取到文件列表:", fileInfo);
                }
            }
            // 处理additional_kwargs中的文件信息
            else if (msg.additional_kwargs && msg.additional_kwargs.file_info) {
                // 检查additional_kwargs中的file_info的结构
                if (typeof msg.additional_kwargs.file_info === 'object' &&
                    msg.additional_kwargs.file_info.files &&
                    Array.isArray(msg.additional_kwargs.file_info.files)) {
                    fileInfo = msg.additional_kwargs.file_info.files;
                    console.log("从additional_kwargs.file_info.files获取到文件列表:", fileInfo);
                } else if (Array.isArray(msg.additional_kwargs.file_info)) {
                    fileInfo = msg.additional_kwargs.file_info;
                    console.log("从additional_kwargs.file_info数组获取到文件列表:", fileInfo);
                }
            }

            // 确保至少有一个文件才传递文件信息
            if (fileInfo && fileInfo.length > 0) {
                console.log("最终传递的文件信息:", fileInfo);
            }

            addMessage(msg.role, msg.content, true, fileInfo); // 添加到顶部（历史），传递文件信息
        }

        // 更新加载更多按钮
        document.getElementById('loadMoreBtn').disabled = historyPage * historyPageSize >= totalMessages;
    }
}

// 删除当前会话
async function deleteCurrentSession() {
    if (!currentSessionId) {
        alert('请先选择一个会话');
        return;
    }

    if (!confirm('确定要删除这个会话吗？此操作不可撤销。')) {
        return;
    }

    const requestData = {
        session_id: currentSessionId,
        user_id: currentUserId
    };

    const response = await apiRequest('/delete-chat', 'POST', requestData);
    if (response && response.status === "success") {
        alert('会话已删除');

        // 清除当前会话状态
        currentSessionId = null;
        currentSessionFeatures = null;

        // 禁用聊天控件
        document.getElementById('messageInput').disabled = true;
        document.getElementById('sendMessageBtn').disabled = true;
        document.getElementById('deleteSessionBtn').disabled = true;

        // 清空消息容器
        document.getElementById('messageContainer').innerHTML = '';
        document.getElementById('currentSessionInfo').innerText = '无活动会话';
        document.getElementById('sessionSettings').classList.add('hidden');

        // 刷新会话列表
        refreshSessions();
    }
}

// 显示标题编辑模态框
function showEditTitleModal() {
    if (!currentSessionId) return;

    const titleInput = document.getElementById('titleInput');
    titleInput.value = document.getElementById('settingTitle').innerText;
    document.getElementById('editTitleModal').classList.remove('hidden');
    titleInput.focus();
    titleInput.select();

    // 添加回车键处理
    titleInput.onkeypress = function(e) {
        if (e.key === 'Enter') {
            updateSessionTitle();
        }
    };
}

// 更新会话标题
async function updateSessionTitle() {
    if (!currentSessionId) return;

    const newTitle = document.getElementById('titleInput').value.trim();
    if (!newTitle) {
        alert('标题不能为空');
        return;
    }

    const requestData = {
        session_id: currentSessionId,
        user_id: currentUserId,
        title: newTitle
    };

    const response = await apiRequest('/update-title', 'POST', requestData);

    if (response && response.status === "success") {
        // 更新UI
        document.getElementById('settingTitle').innerText = newTitle;
        document.getElementById('currentSessionInfo').innerText = `当前会话: ${newTitle}`;
        currentTitle = newTitle;

        // 隐藏模态框
        document.getElementById('editTitleModal').classList.add('hidden');

        // 刷新会话列表以更新显示
        refreshSessions();
    }
}

// 显示代理配置
async function showAgentConfig() {
    const response = await apiRequest('/config', 'GET');
    if (response && response.config) {
        document.getElementById('configContent').innerText = JSON.stringify(response.config, null, 2);
        document.getElementById('configModal').classList.remove('hidden');
    }
}

// 格式化日期显示
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

// 创建会话按钮点击处理
async function handleCreateChat() {
    // 禁用创建按钮，防止重复点击
    const createBtn = document.getElementById('createChatBtn');
    createBtn.disabled = true;
    createBtn.innerText = '正在创建...';

    try {
        // 获取表单数据
        const userId = document.getElementById('userId').value.trim();
        const systemPrompt = document.getElementById('systemPrompt').value.trim();
        const useToolsElement = document.getElementById('useTools');
        const useTools = useToolsElement ? useToolsElement.checked : false;

        // 获取选择的模型
        let selectedModel = document.getElementById('modelProvider').value;

        // 检查是否指定了自定义模型
        const customModel = document.getElementById('customModel').value.trim();
        if (customModel) {
            selectedModel = customModel;
        }

        // 基本验证
        if (!userId) {
            alert('请输入用户ID');
            return;
        }

        // 准备请求数据
        const data = {
            user_id: userId,
            system_prompt: systemPrompt || undefined,
            tools_enabled: useTools, // 修改为与服务端一致的参数名
            tool_type: useTools ? "local" : "none", // 如果启用工具，明确指定为本地工具
            model_name: selectedModel === 'default' ? undefined : selectedModel
        };

        // 调用创建会话API
        const response = await apiRequest('/create-chat', 'POST', data);

        if (response && response.session_id) {
            // 成功创建会话
            currentUserId = userId;

            // 保存当前用户ID到本地存储
            localStorage.setItem('currentUserId', userId);

            // 刷新会话列表
            await refreshSessions();

            // 提示用户
            alert('会话创建成功');

            // 自动选择新创建的会话
            await selectSession(response.session_id);

            // 同步更新文件模块的用户ID
            syncUserIdToFileModule(userId);
        }
    } catch (error) {
        console.error('创建会话失败:', error);
        alert(`创建会话失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        createBtn.disabled = false;
        createBtn.innerText = '创建聊天会话';
    }
}