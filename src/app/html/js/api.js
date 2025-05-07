/**
 * API相关函数 - 处理与后端的通信
 */

// API请求辅助函数
async function apiRequest(endpoint, method, data = null) {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const responseData = await response.json();

        // 记录API响应
        logApiResponse(endpoint, data, responseData);

        if (!response.ok) {
            throw new Error(responseData.detail || 'API请求失败');
        }

        return responseData;
    } catch (error) {
        console.error('API错误:', error);
        logApiResponse(endpoint, data, {
            error: error.message
        });
        alert(`错误: ${error.message}`);
        return null;
    }
}

// 记录API响应
function logApiResponse(endpoint, request, response) {
    const logElement = document.getElementById('apiResponse');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${endpoint}\n` +
        `请求: ${request ? JSON.stringify(request, null, 2) : '无'}\n` +
        `响应: ${JSON.stringify(response, null, 2)}\n` +
        '------------------------------\n';

    logElement.innerText = logEntry + logElement.innerText;
}

// 加载可用模型列表
async function loadAvailableModels() {
    try {
        const response = await apiRequest('/available-models', 'GET');
        if (response && response.models) {
            availableModels = response.models;
            defaultModelId = response.default_model;

            // 更新模型选择下拉菜单
            const modelSelect = document.getElementById('modelProvider');
            modelSelect.innerHTML = ''; // 清空现有选项

            // 添加"默认"选项
            const defaultOption = document.createElement('option');
            defaultOption.value = 'default';
            defaultOption.textContent = '默认模型';
            modelSelect.appendChild(defaultOption);

            // 添加所有可用模型
            availableModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.provider;
                option.textContent = model.name;
                option.dataset.modelId = model.id;
                modelSelect.appendChild(option);

                // 如果是默认模型，选中它
                if (model.id === defaultModelId) {
                    option.selected = true;
                }
            });

            logApiResponse('/available-models', null, {
                models: availableModels,
                default_model: defaultModelId
            });
        }
    } catch (error) {
        console.error('加载模型失败:', error);
        alert('无法加载可用模型列表。请检查服务器是否正常运行。');
    }
}

// 上传文件
async function uploadFile(file, userId) {
    try {
        // 创建FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', userId);

        // 设置请求选项
        const options = {
            method: 'POST',
            body: formData,
            // 不设置Content-Type，让浏览器自动设置为multipart/form-data
        };

        // 发送请求
        const response = await fetch(`${API_BASE_URL}/upload-file`, options);
        const responseData = await response.json();

        // 记录API响应
        logApiResponse('/upload-file', { userId, fileName: file.name }, responseData);

        if (!response.ok) {
            throw new Error(responseData.detail || '上传文件失败');
        }

        return responseData;
    } catch (error) {
        console.error('上传文件错误:', error);
        const fileName = file ? file.name : undefined;
        logApiResponse('/upload-file', { userId, fileName }, {
            error: error.message
        });
        alert(`上传文件错误: ${error.message}`);
        return null;
    }
}

// 获取用户文件列表
async function getUserFiles(userId, page = 1, pageSize = 10) {
    try {
        const data = {
            user_id: userId,
            page: page,
            page_size: pageSize
        };

        return await apiRequest('/list-files', 'POST', data);
    } catch (error) {
        console.error('获取文件列表错误:', error);
        return null;
    }
}

// 获取文件详情
async function getFileDetail(fileId, userId) {
    try {
        const data = {
            file_id: fileId,
            user_id: userId
        };

        return await apiRequest('/file-detail', 'POST', data);
    } catch (error) {
        console.error('获取文件详情错误:', error);
        return null;
    }
}

// 获取文件下载URL
function getFileDownloadUrl(fileId, userId) {
    return `${API_BASE_URL}/download-file/${fileId}?user_id=${userId}`;
}