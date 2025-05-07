/**
 * 聊天消息处理相关函数 - 处理消息的发送和接收
 */

// 初始化聊天模块
function initChatModule() {
    // 清空消息容器
    document.getElementById('messageContainer').innerHTML = '';

    // 设置默认UI状态
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendMessageBtn').disabled = true;
    document.getElementById('loadMoreBtn').disabled = true;

    // 初始化消息输入事件处理
    document.getElementById('messageInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);

    // 控制台日志
    console.log('聊天模块已初始化');
}

// 在聊天中发送消息
async function sendMessage() {
    if (!currentSessionId) {
        alert('请先创建或选择一个聊天会话');
        return;
    }

    const messageInput = document.getElementById('messageInput');
    const userMessage = messageInput.value.trim();

    if (!userMessage) {
        return;
    }

    // 获取选择的文件ID列表
    let fileIds = [];
    let fileInfoList = [];
    // 确保从全局变量selectedFiles中获取文件ID
    if (typeof selectedFiles !== 'undefined' && Array.isArray(selectedFiles)) {
        fileIds = selectedFiles.map(f => f.id);
        // 构建文件信息列表用于显示
        fileInfoList = selectedFiles.map(f => ({
            file_id: f.id,
            filename: f.name
        }));
        console.log("已选择发送的文件ID:", fileIds);
    } else {
        console.log("未选择任何文件或selectedFiles未定义");
    }

    // 添加用户消息到UI - 传递文件信息
    addMessage('user', userMessage, false, fileInfoList.length > 0 ? fileInfoList : null);

    // 清空输入
    messageInput.value = '';

    // 如果有文件被选中，也清空文件选择
    if (typeof clearSelectedFiles === 'function') {
        clearSelectedFiles();
    } else if (typeof selectedFiles !== 'undefined') {
        // 清除选中的文件
        selectedFiles = [];
        // 取消文件列表中的勾选状态
        const checkboxes = document.querySelectorAll('#fileList .file-select-checkbox:checked');
        checkboxes.forEach(cb => cb.checked = false);
        // 清空选中文件显示
        const container = document.getElementById('selectedFilesContainer');
        if (container) container.innerHTML = '';
        console.log("已清除所有选中的文件");
    }

    // 在处理期间禁用输入
    messageInput.disabled = true;
    document.getElementById('sendMessageBtn').disabled = true;
    // 禁用文件附加按钮
    const attachFileBtn = document.getElementById('attachFileBtn');
    if (attachFileBtn) {
        attachFileBtn.disabled = true;
    }

    // 添加流式响应的占位容器
    const responseId = 'response-' + Date.now();
    const responseElement = document.createElement('div');
    responseElement.id = responseId;
    responseElement.className = 'message-assistant break-words';
    responseElement.innerHTML = '<div class="animate-pulse">思考中...</div>';
    document.getElementById('messageContainer').appendChild(responseElement);
    document.getElementById('messageContainer').scrollTop = document.getElementById('messageContainer').scrollHeight;

    // 请求数据
    const requestData = {
        session_id: currentSessionId,
        user_id: currentUserId,
        message: userMessage,
        file_ids: fileIds // 添加文件ID
    };

    try {
        // 创建POST请求选项
        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify(requestData)
        };

        // 使用fetch创建流式连接
        const response = await fetch(`${API_BASE_URL}/stream-message`, fetchOptions);

        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }

        // 处理SSE响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        let finalResponse = "";
        let toolStarted = false;
        let isFirstToken = true;

        // 处理流式数据
        while (true) {
            const {
                value,
                done
            } = await reader.read();

            if (done) {
                break;
            }

            // 解码数据并添加到缓冲区
            buffer += decoder.decode(value, {
                stream: true
            });

            // 处理SSE格式的消息
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));

                        // 记录SSE响应（可选）
                        logApiResponse('/stream-message', requestData, data);

                        // 处理不同类型的响应
                        if (data.error) {
                            // 处理错误
                            finalResponse = `错误: ${data.error_message}`;
                            responseElement.innerHTML = finalResponse;
                        } else if (data.event === 'complete') {
                            // 完成事件，不做特殊处理
                        } else if (data.type === 'thinking') {
                            // 思考状态，保持现有UI的思考动画
                        } else if (data.type === 'action_decision') {
                            // 工具调用意图
                            if (!toolStarted) {
                                toolStarted = true;
                                responseElement.innerHTML = ""; // 清除思考中...
                            }
                            console.log(data);
                            const actionSection = document.createElement('div');
                            actionSection.className = 'border-l-4 border-blue-500 pl-2 my-2 text-blue-700';
                            actionSection.innerHTML = `<div class="font-bold">✅ 工具调用意图</div>
                                <div>思考: ${data.thought}</div>
                                <div>工具: ${data.action.tool}</div>
                                <div>参数: ${data.action.tool_input}</div>`;
                            responseElement.appendChild(actionSection);
                        } else if (data.type === 'tool_execution') {
                            // 工具执行结果
                            const executionSection = document.createElement('div');
                            executionSection.className = 'border-l-4 border-green-500 pl-2 my-2 text-green-700';
                            executionSection.innerHTML = `<div class="font-bold">✅ 工具执行并观察结果</div>
                                <div>工具: ${data.action.tool}</div>
                                <div>参数: ${data.action.tool_input}</div>
                                <div class="mt-1 font-semibold">结果: ${data.observation}</div>`;
                            responseElement.appendChild(executionSection);
                        } else if (data.type === 'final_answer') {
                            // 最终答案
                            finalResponse = data.final_answer;

                            // 如果之前进行了工具操作，添加最终结果部分
                            if (toolStarted) {
                                const finalSection = document.createElement('div');
                                finalSection.className = 'border-l-4 border-purple-500 pl-2 my-2 text-purple-700';
                                finalSection.innerHTML = `<div class="font-bold">✅ 输出最终结果</div>
                                    <div>${finalResponse}</div>`;
                                responseElement.appendChild(finalSection);
                            } else {
                                // 如果没有工具操作，直接显示结果
                                responseElement.innerHTML = finalResponse;
                            }
                        } else if (data.type === 'token_stream') {
                            // 普通令牌流处理
                            if (isFirstToken) {
                                // 第一个令牌，清除思考中...
                                responseElement.innerHTML = "";
                                isFirstToken = false;
                            }

                            // 追加新内容
                            finalResponse += data.content;
                            responseElement.innerHTML = finalResponse;
                        }

                        // 滚动到底部
                        document.getElementById('messageContainer').scrollTop = document.getElementById('messageContainer').scrollHeight;
                    } catch (error) {
                        console.error('解析事件数据失败:', error, line);
                    }
                }
            }
        }

        // 重新启用输入
        messageInput.disabled = false;
        document.getElementById('sendMessageBtn').disabled = false;
        if (attachFileBtn) {
            attachFileBtn.disabled = false;
        }
        messageInput.focus();

    } catch (error) {
        console.error('流式处理失败:', error);
        responseElement.innerHTML = `错误: ${error.message}`;

        // 重新启用输入
        messageInput.disabled = false;
        document.getElementById('sendMessageBtn').disabled = false;
        if (attachFileBtn) {
            attachFileBtn.disabled = false;
        }
        messageInput.focus();
    }
}

// 添加消息到UI
function addMessage(role, content, addToTop = false, fileInfo = null) {
    const messageContainer = document.getElementById('messageContainer');
    const messageElement = document.createElement('div');

    messageElement.className = `message-${role} break-words`;

    // 设置消息内容
    messageElement.innerText = content;

    // 如果有文件信息，添加文件附件显示
    if (fileInfo && Array.isArray(fileInfo) && fileInfo.length > 0) {
        // 先清除文本内容，改为HTML方式添加
        messageElement.innerText = '';

        // 添加消息文本
        const textElement = document.createElement('div');
        textElement.innerText = content;
        messageElement.appendChild(textElement);

        // 添加文件附件区域
        const filesContainer = document.createElement('div');
        filesContainer.className = 'files-container mt-2 border-t pt-2 bg-gray-50 rounded-md p-2';

        // 添加文件标题
        const filesTitle = document.createElement('div');
        filesTitle.className = 'text-sm font-medium text-gray-700 mb-2';
        filesTitle.innerText = '附件文件:';
        filesContainer.appendChild(filesTitle);

        // 添加文件列表
        const filesList = document.createElement('div');
        filesList.className = 'files-list grid grid-cols-1 gap-2';

        // 为每个文件创建一个元素
        fileInfo.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item flex items-center p-2 border rounded bg-white hover:bg-blue-50 transition-colors';

            // 文件图标 - 根据文件类型显示不同图标
            const fileIcon = document.createElement('span');
            fileIcon.className = 'file-icon mr-2 text-blue-500';

            // 根据文件名后缀选择图标
            const fileName = file.filename || '未命名文件';
            const fileExt = fileName.split('.').pop().toLowerCase();

            let iconHtml = '📎';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
                iconHtml = '🖼️';
            } else if (['pdf'].includes(fileExt)) {
                iconHtml = '📑';
            } else if (['doc', 'docx'].includes(fileExt)) {
                iconHtml = '📝';
            } else if (['xls', 'xlsx'].includes(fileExt)) {
                iconHtml = '📊';
            } else if (['ppt', 'pptx'].includes(fileExt)) {
                iconHtml = '📽️';
            } else if (['zip', 'rar', '7z'].includes(fileExt)) {
                iconHtml = '🗜️';
            } else if (['txt', 'md'].includes(fileExt)) {
                iconHtml = '📄';
            }

            fileIcon.innerHTML = iconHtml;
            fileItem.appendChild(fileIcon);

            // 文件名
            const fileNameElem = document.createElement('span');
            fileNameElem.className = 'file-name flex-grow text-sm truncate';
            fileNameElem.innerText = fileName;
            fileItem.appendChild(fileNameElem);

            // 如果有下载链接，添加下载按钮
            if (file.file_id) {
                const downloadBtn = document.createElement('a');
                downloadBtn.className = 'download-btn ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600';
                downloadBtn.href = `${API_BASE_URL}/download-file/${file.file_id}?user_id=${currentUserId}`;
                downloadBtn.target = '_blank';
                downloadBtn.innerText = '下载';
                fileItem.appendChild(downloadBtn);
            }

            filesList.appendChild(fileItem);
        });

        filesContainer.appendChild(filesList);
        messageElement.appendChild(filesContainer);
    }

    if (addToTop) {
        messageContainer.insertBefore(messageElement, messageContainer.firstChild);
    } else {
        messageContainer.appendChild(messageElement);
        // 滚动到底部
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
}