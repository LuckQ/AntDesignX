/**
 * UI交互相关函数 - 处理用户界面交互和更新
 */

// 显示标题编辑模态框
function showEditTitleModal() {
    if (!currentSessionId) return;

    const titleInput = document.getElementById('titleInput');
    titleInput.value = document.getElementById('settingTitle').innerText;
    document.getElementById('editTitleModal').classList.remove('hidden');
    titleInput.focus();
    titleInput.select();
}

// 关闭标题编辑模态框
function closeTitleModal() {
    document.getElementById('editTitleModal').classList.add('hidden');
}

// 显示代理配置模态框
function showAgentConfig() {
    const response = apiRequest('/config', 'GET').then(response => {
        if (response && response.config) {
            document.getElementById('configContent').innerText = JSON.stringify(response.config, null, 2);
            document.getElementById('configModal').classList.remove('hidden');
        }
    });
}

// 关闭代理配置模态框
function closeConfigModal() {
    document.getElementById('configModal').classList.add('hidden');
}

// 清除API响应日志
function clearApiLog() {
    document.getElementById('apiResponse').innerText = '';
}

// 显示消息到容器
const displayMessage = (role, content, timestamp, fileIds = null, fileInfo = null) => {
        const container = document.getElementById('messageContainer');
        if (!container) return;

        const messageElement = document.createElement('div');
        messageElement.className = \`mb-3 p-3 rounded-lg max-w-[85%] ${role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100 mr-auto'}\`;

    const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : '';
    let fileHtml = \'\';

    // 生成文件附件HTML
    if (fileIds && fileIds.length > 0 && fileInfo && fileInfo.files && fileInfo.files.length > 0) {
        fileHtml = '<div class="mt-2 border-t pt-2 border-gray-300 space-y-1">';
        fileInfo.files.forEach(file => {
            fileHtml += \`
                <div class="flex items-center text-xs p-1 bg-white rounded border border-gray-200">
                    <span class="mr-2 text-gray-500">${files.getFileIcon(file.file_type)}</span>
                    <span class="truncate flex-1" title="${file.filename} (${files.formatBytes(file.file_size)})">${file.filename}</span>
                    <a href="/api/v1/base_agent/download-file/${file.file_id}?user_id=${document.getElementById(\'userId\').value}" target="_blank" class="ml-2 text-blue-500 hover:underline" title="下载文件">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </a>
                </div>
            \`;
        });
        fileHtml += '</div>';
    }

    messageElement.innerHTML = \`
        <div class="flex justify-between items-center mb-1">
            <span class="font-medium text-sm capitalize">${role}</span>
            <span class="text-xs text-gray-500">${timeStr}</span>
        </div>
        <div class="text-sm">${escapeHtml(content)}</div>
        ${fileHtml}
    \`;

    container.appendChild(messageElement);
    scrollToBottom(container);
};