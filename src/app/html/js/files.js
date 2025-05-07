/**
 * 文件相关操作函数
 */

// 当前文件列表页码和每页数量
let fileListPage = 1;
let fileListPageSize = 10;
let totalFileCount = 0;

// 存储文件列表
let userFiles = [];
// 存储已选择的文件
let selectedFiles = [];

// 初始化文件模块
function initFileModule() {
    console.log("初始化文件模块...");
    // 添加事件监听器
    document.getElementById('uploadFileBtn').addEventListener('click', triggerFileUpload);
    document.getElementById('refreshFilesBtn').addEventListener('click', loadUserFiles);
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('prevFilesPageBtn').addEventListener('click', () => {
        if (fileListPage > 1) {
            fileListPage--;
            loadUserFiles();
        }
    });
    document.getElementById('nextFilesPageBtn').addEventListener('click', () => {
        if (fileListPage * fileListPageSize < totalFileCount) {
            fileListPage++;
            loadUserFiles();
        }
    });

    // 为附件按钮添加事件监听器
    const attachFileBtn = document.getElementById('attachFileBtn');
    if (attachFileBtn) {
        console.log("正在绑定附件按钮事件");
        attachFileBtn.addEventListener('click', function() {
            console.log("附件按钮被点击");
            // 检查是否有会话
            if (!currentUserId) {
                alert('请先创建或选择一个聊天会话');
                return;
            }

            // 在API响应区域显示提示
            const apiResponse = document.getElementById('apiResponse');
            if (apiResponse) {
                apiResponse.innerHTML += '<div class="text-blue-600">请选择要上传的文件，上传后会自动附加到消息中</div>';
                apiResponse.scrollTop = apiResponse.scrollHeight;
            }

            // 直接触发文件选择对话框
            document.getElementById('fileInput').click();
        });
    } else {
        console.error("找不到附件按钮元素");
    }

    // 初始化文件列表显示
    document.getElementById('fileList').innerHTML = '<div class="text-gray-500 text-center">请先选择用户</div>';

    console.log("文件模块初始化完成");
}

// 设置当前用户
function setCurrentFileUser(userId) {
    currentUserId = userId;
    fileListPage = 1; // 重置页码

    if (userId) {
        loadUserFiles();
        document.getElementById('uploadFileBtn').disabled = false;
    } else {
        document.getElementById('fileList').innerHTML = '<div class="text-gray-500 text-center">请先选择用户</div>';
        document.getElementById('uploadFileBtn').disabled = true;
        document.getElementById('prevFilesPageBtn').disabled = true;
        document.getElementById('nextFilesPageBtn').disabled = true;
        document.getElementById('filesPaginationInfo').textContent = '第1页';
    }
}

// 触发文件上传
function triggerFileUpload() {
    if (!currentUserId) {
        alert('请先选择用户');
        return;
    }

    document.getElementById('fileInput').click();
}

// 处理文件上传
async function handleFileUpload(event) {
    const fileInput = event.target;
    if (!fileInput.files || fileInput.files.length === 0) {
        return;
    }

    const file = fileInput.files[0];

    try {
        // 显示上传中状态
        const fileListEl = document.getElementById('fileList');
        const originalContent = fileListEl.innerHTML;
        fileListEl.innerHTML = '<div class="text-center py-4"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div><p class="mt-2">正在上传文件...</p></div>';

        // 上传文件
        const result = await uploadFile(file, currentUserId);

        if (result && result.status === 'success') {
            // 重新加载文件列表
            await loadUserFiles();

            // 自动选中刚上传的文件
            const uploadedFileId = result.file.file_id;
            const uploadedFileName = result.file.filename;

            // 清除之前选中的文件
            selectedFiles = [];

            // 添加新上传的文件
            selectedFiles.push({
                id: uploadedFileId,
                name: uploadedFileName
            });

            // 更新显示
            displaySelectedFiles();

            // 在API响应区域显示提示
            const apiResponse = document.getElementById('apiResponse');
            if (apiResponse) {
                apiResponse.innerHTML += `<div class="text-green-600">文件 "${uploadedFileName}" 已上传并自动选中，发送消息时将随消息一起发送</div>`;
                apiResponse.scrollTop = apiResponse.scrollHeight;
            }

        } else {
            // 恢复原内容
            fileListEl.innerHTML = originalContent;
            alert('文件上传失败');
        }
    } catch (error) {
        console.error('文件上传错误:', error);
        alert(`文件上传失败: ${error.message}`);
    }

    // 清空文件输入框，以便再次选择同一文件
    fileInput.value = '';
}

// 加载用户文件列表
async function loadUserFiles() {
    if (!currentUserId) {
        return;
    }

    try {
        // 显示加载中状态
        document.getElementById('fileList').innerHTML = '<div class="text-center py-4"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div><p class="mt-2">加载中...</p></div>';

        // 获取文件列表
        const result = await getUserFiles(currentUserId, fileListPage, fileListPageSize);

        if (result && result.status === 'success') {
            userFiles = result.files;
            totalFileCount = result.total;

            // 更新分页信息
            document.getElementById('filesPaginationInfo').textContent = `第${result.page}页 (共${Math.ceil(totalFileCount / fileListPageSize)}页)`;

            // 更新分页按钮状态
            document.getElementById('prevFilesPageBtn').disabled = result.page <= 1;
            document.getElementById('nextFilesPageBtn').disabled = result.page * result.page_size >= totalFileCount;

            // 渲染文件列表
            renderFileList(userFiles);
        } else {
            document.getElementById('fileList').innerHTML = '<div class="text-gray-500 text-center">获取文件列表失败</div>';
        }
    } catch (error) {
        console.error('加载文件列表错误:', error);
        document.getElementById('fileList').innerHTML = '<div class="text-gray-500 text-center">获取文件列表失败</div>';
    }
}

// 渲染文件列表
function renderFileList(files) {
    const fileListEl = document.getElementById('fileList');

    if (!files || files.length === 0) {
        fileListEl.innerHTML = '<div class="text-gray-500 text-center">没有上传的文件</div>';
        return;
    }

    // 创建文件列表HTML
    let html = '<div class="space-y-2">';

    files.forEach(file => {
        // 格式化文件大小
        const fileSize = formatFileSize(file.file_size);

        // 格式化上传时间
        const uploadTime = formatDateTime(file.upload_time);

        // 构建文件图标
        const fileIcon = getFileIcon(file.file_type);

        // 下载链接
        const downloadUrl = getFileDownloadUrl(file.file_id, currentUserId);

        // 构建文件项 - 移除复选框
        html += `
            <div class="p-3 bg-gray-50 rounded-md hover:bg-gray-100">
                <div class="flex items-start">
                    <div class="text-blue-500 mr-3 text-xl">
                        ${fileIcon}
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <a href="${downloadUrl}" 
                               class="font-medium text-blue-600 hover:underline" 
                               target="_blank" 
                               title="点击下载">
                                ${escapeHtml(file.filename)}
                            </a>
                            <span class="text-xs text-gray-500">${uploadTime}</span>
                        </div>
                        <div class="text-xs text-gray-500 mt-1">
                            <span>${fileSize}</span>
                            <span class="mx-2">|</span>
                            <span>${getFileTypeName(file.file_type)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    fileListEl.innerHTML = html;
}

// 获取文件图标
function getFileIcon(mimeType) {
    if (!mimeType) return '<i class="far fa-file"></i>';

    if (mimeType.startsWith('image/')) {
        return '<i class="far fa-file-image"></i>';
    } else if (mimeType.startsWith('video/')) {
        return '<i class="far fa-file-video"></i>';
    } else if (mimeType.startsWith('audio/')) {
        return '<i class="far fa-file-audio"></i>';
    } else if (mimeType.includes('pdf')) {
        return '<i class="far fa-file-pdf"></i>';
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
        return '<i class="far fa-file-word"></i>';
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        return '<i class="far fa-file-excel"></i>';
    } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
        return '<i class="far fa-file-powerpoint"></i>';
    } else if (mimeType.includes('zip') || mimeType.includes('compressed')) {
        return '<i class="far fa-file-archive"></i>';
    } else if (mimeType.includes('text/')) {
        return '<i class="far fa-file-alt"></i>';
    } else {
        return '<i class="far fa-file"></i>';
    }
}

// 获取文件类型名称
function getFileTypeName(mimeType) {
    if (!mimeType) return '未知类型';

    if (mimeType.startsWith('image/')) {
        return '图片';
    } else if (mimeType.startsWith('video/')) {
        return '视频';
    } else if (mimeType.startsWith('audio/')) {
        return '音频';
    } else if (mimeType.includes('pdf')) {
        return 'PDF文档';
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
        return 'Word文档';
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        return 'Excel表格';
    } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
        return 'PPT演示文稿';
    } else if (mimeType.includes('zip') || mimeType.includes('compressed')) {
        return '压缩文件';
    } else if (mimeType.includes('text/')) {
        return '文本文件';
    } else {
        return mimeType.split('/').pop() || '未知类型';
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '未知大小';

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    if (i === 0) return bytes + ' ' + sizes[i];

    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

// 格式化日期时间
function formatDateTime(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// HTML转义
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * 文件管理模块
 */
const files = (() => {
    let currentPage = 1;
    const pageSize = 10;
    let totalFiles = 0;

    // 初始化
    const init = () => {
        console.log("初始化文件管理模块");
        bindFileEvents();
    };

    // 绑定文件相关事件
    const bindFileEvents = () => {
        const fileInput = document.getElementById('fileInput');
        const uploadFileBtn = document.getElementById('uploadFileBtn');
        const refreshFilesBtn = document.getElementById('refreshFilesBtn');
        const attachFileBtn = document.getElementById('attachFileBtn');
        const prevFilesPageBtn = document.getElementById('prevFilesPageBtn');
        const nextFilesPageBtn = document.getElementById('nextFilesPageBtn');

        if (uploadFileBtn && fileInput) {
            uploadFileBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', handleFileUpload);
        }

        if (refreshFilesBtn) {
            refreshFilesBtn.addEventListener('click', refreshFileList);
        }

        if (attachFileBtn) {
            // 点击附加按钮时，显示文件列表供选择 (这里简化为直接触发文件上传)
            // 更完善的实现是弹出一个模态框显示已上传的文件列表
            attachFileBtn.addEventListener('click', showFileSelectionModal); // 改为显示文件选择模态框
        }

        if (prevFilesPageBtn) {
            prevFilesPageBtn.addEventListener('click', () => changeFilesPage(-1));
        }
        if (nextFilesPageBtn) {
            nextFilesPageBtn.addEventListener('click', () => changeFilesPage(1));
        }
    };

    // 处理文件上传
    const handleFileUpload = async(event) => {
        const file = event.target.files[0];
        if (!file) return;

        const userId = document.getElementById('userId').value;
        if (!userId) {
            ui.logApiResponse("请先设置用户ID", true);
            return;
        }

        ui.logApiResponse(`正在上传文件: ${file.name}...`);
        try {
            const response = await api.uploadFile(file, userId);
            ui.logApiResponse(`文件上传成功: ${response.file.filename} (ID: ${response.file.file_id}`);
            // 上传成功后刷新文件列表
            refreshFileList();
        } catch (error) {
            ui.logApiResponse(`文件上传失败: ${error.message}`, true);
        } finally {
            // 清空文件输入框，以便可以再次选择同一个文件
            event.target.value = null;
        }
    };

    // 加载用户文件列表
    const loadUserFiles = async(userId, page = 1) => {
        if (!userId) {
            displayFileList([]); // 清空列表
            updateFilesPagination(0, 1);
            return;
        }
        currentPage = page;
        ui.setElementDisabled('refreshFilesBtn', true);
        try {
            const response = await api.listFiles(userId, currentPage, pageSize);
            totalFiles = response.total;
            displayFileList(response.files);
            updateFilesPagination(totalFiles, currentPage);
        } catch (error) {
            ui.logApiResponse(`获取文件列表失败: ${error.message}`, true);
            displayFileList([]);
            updateFilesPagination(0, 1);
        } finally {
            ui.setElementDisabled('refreshFilesBtn', false);
        }
    };

    // 刷新文件列表
    const refreshFileList = () => {
        const userId = document.getElementById('userId').value;
        loadUserFiles(userId, 1); // 刷新时回到第一页
    };

    // 显示文件列表
    const displayFileList = (filesData) => {
        const fileListContainer = document.getElementById('fileList');
        if (!fileListContainer) return;

        fileListContainer.innerHTML = ''; // 清空

        if (!filesData || filesData.length === 0) {
            fileListContainer.innerHTML = '<div class="text-gray-500 text-center">未找到文件</div>';
            return;
        }

        filesData.forEach(file => {
            const fileElement = document.createElement('div');
            fileElement.className = 'p-2 border rounded-md flex items-center justify-between hover:bg-gray-50 cursor-pointer';
            fileElement.dataset.fileId = file.file_id;
            fileElement.dataset.filename = file.filename;
            fileElement.title = `类型: ${file.file_type || '未知'}\n大小: ${formatBytes(file.file_size)}\n上传时间: ${new Date(file.upload_time).toLocaleString()}`;

            fileElement.innerHTML = `
                <div class="flex items-center space-x-2 overflow-hidden">
                    <span class="text-gray-500">${getFileIcon(file.file_type)}</span>
                    <span class="truncate">${file.filename}</span>
                </div>
                <input type="checkbox" class="file-select-checkbox ml-2" data-file-id="${file.file_id}" data-filename="${file.filename}">
            `;

            // 点击文件项切换选中状态 (复选框)
            // fileElement.addEventListener('click', (e) => {
            //     if (e.target.type !== 'checkbox') {
            //         const checkbox = fileElement.querySelector('.file-select-checkbox');
            //         checkbox.checked = !checkbox.checked;
            //         updateSelectedFilesFromCheckboxes();
            //     }
            // });

            // 复选框变化时更新选中文件
            const checkbox = fileElement.querySelector('.file-select-checkbox');
            checkbox.addEventListener('change', updateSelectedFilesFromCheckboxes);

            fileListContainer.appendChild(fileElement);
        });
    };

    // 点击附加文件按钮时，弹出文件选择模态框（暂未实现模态框，先用console模拟）
    const showFileSelectionModal = () => {
        console.log("打开文件选择列表（模拟）");
        // 实际应用中，这里会创建一个模态框显示文件列表供选择
        // 用户在模态框中勾选文件后，点击确认按钮来更新selectedFiles
        // 目前简化处理：直接显示已上传文件列表，用户勾选即可
        const fileListSection = document.getElementById('fileList');
        if (fileListSection) {
            // 滚动到文件列表
            fileListSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            ui.logApiResponse("请在下方的文件列表中勾选要附加的文件。", false, 3000);
        }
    };

    // 从复选框状态更新已选择的文件
    const updateSelectedFilesFromCheckboxes = () => {
        selectedFiles = [];
        const checkboxes = document.querySelectorAll('#fileList .file-select-checkbox:checked');
        checkboxes.forEach(cb => {
            selectedFiles.push({
                id: cb.dataset.fileId,
                name: cb.dataset.filename
            });
        });
        displaySelectedFiles(); // 更新聊天输入框下方的显示
    };

    // 显示已选择用于发送的文件
    const displaySelectedFiles = () => {
        const container = document.getElementById('selectedFilesContainer');
        if (!container) return;
        container.innerHTML = '';
        if (selectedFiles.length > 0) {
            const fileNames = selectedFiles.map(f => f.name).join(', ');
            container.innerHTML = `
                <span class="font-medium">已附加:</span> ${fileNames}
                <button id="clearSelectedFilesBtn" class="text-red-500 text-xs ml-2">(清除)</button>
            `;
            document.getElementById('clearSelectedFilesBtn').addEventListener('click', clearSelectedFiles);
        }
    };

    // 清除已选择的文件
    const clearSelectedFiles = () => {
        selectedFiles = [];
        // 取消文件列表中的勾选状态
        const checkboxes = document.querySelectorAll('#fileList .file-select-checkbox:checked');
        checkboxes.forEach(cb => cb.checked = false);
        displaySelectedFiles();
    };

    // 获取当前选择的文件ID列表
    const getSelectedFileIds = () => {
        return selectedFiles.map(f => f.id);
    };

    // 更新文件分页信息
    const updateFilesPagination = (total, current) => {
        const paginationInfo = document.getElementById('filesPaginationInfo');
        const prevBtn = document.getElementById('prevFilesPageBtn');
        const nextBtn = document.getElementById('nextFilesPageBtn');
        const totalPages = Math.ceil(total / pageSize);

        if (paginationInfo) {
            paginationInfo.textContent = total > 0 ? `第 ${current} / ${totalPages} 页 (共 ${total} 项)` : '第 1 页';
        }
        if (prevBtn) {
            prevBtn.disabled = current <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = current >= totalPages;
        }
    };

    // 切换文件页面
    const changeFilesPage = (delta) => {
        const newPage = currentPage + delta;
        const totalPages = Math.ceil(totalFiles / pageSize);
        if (newPage >= 1 && newPage <= totalPages) {
            const userId = document.getElementById('userId').value;
            loadUserFiles(userId, newPage);
        }
    };

    // 格式化文件大小
    const formatBytes = (bytes, decimals = 2) => {
        if (bytes === 0 || bytes === null || bytes === undefined) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // 获取文件类型图标
    const getFileIcon = (fileType) => {
        if (!fileType) return '<i class="fas fa-file"></i>';
        if (fileType.startsWith('image/')) return '<i class="fas fa-file-image"></i>';
        if (fileType.startsWith('audio/')) return '<i class="fas fa-file-audio"></i>';
        if (fileType.startsWith('video/')) return '<i class="fas fa-file-video"></i>';
        if (fileType === 'application/pdf') return '<i class="fas fa-file-pdf"></i>';
        if (fileType.includes('word')) return '<i class="fas fa-file-word"></i>';
        if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '<i class="fas fa-file-excel"></i>';
        if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '<i class="fas fa-file-powerpoint"></i>';
        if (fileType === 'text/plain') return '<i class="fas fa-file-alt"></i>';
        if (fileType === 'application/zip' || fileType.includes('archive')) return '<i class="fas fa-file-archive"></i>';
        return '<i class="fas fa-file"></i>'; // 默认图标
    };

    return {
        init,
        loadUserFiles,
        refreshFileList,
        getSelectedFileIds,
        clearSelectedFiles,
        getFileIcon,
        formatBytes
    };
})();

// 将清除选中文件和获取选中文件ID的函数设为全局可用
function clearSelectedFiles() {
    selectedFiles = [];
    // 取消文件列表中的勾选状态
    const checkboxes = document.querySelectorAll('#fileList .file-select-checkbox:checked');
    checkboxes.forEach(cb => cb.checked = false);

    // 更新显示
    const container = document.getElementById('selectedFilesContainer');
    if (container) container.innerHTML = '';

    console.log("文件选择已清除");
}

function getSelectedFileIds() {
    if (selectedFiles && Array.isArray(selectedFiles)) {
        return selectedFiles.map(f => f.id);
    }
    return [];
}

// 更新选中的文件（从复选框）
function updateSelectedFilesFromCheckboxes() {
    selectedFiles = [];
    const checkboxes = document.querySelectorAll('#fileList .file-select-checkbox:checked');
    checkboxes.forEach(cb => {
        selectedFiles.push({
            id: cb.dataset.fileId,
            name: cb.dataset.filename
        });
    });

    // 更新显示
    displaySelectedFiles();

    console.log("已选择的文件:", selectedFiles);
}

// 显示已选择的文件
function displaySelectedFiles() {
    const container = document.getElementById('selectedFilesContainer');
    if (!container) return;

    container.innerHTML = '';
    if (selectedFiles.length > 0) {
        const fileNames = selectedFiles.map(f => f.name).join(', ');
        container.innerHTML = `
            <span class="font-medium">已附加:</span> ${fileNames}
            <button id="clearSelectedFilesBtn" class="text-red-500 text-xs ml-2">(清除)</button>
        `;
        document.getElementById('clearSelectedFilesBtn').addEventListener('click', clearSelectedFiles);
    }
}

// 获取文件下载URL
function getFileDownloadUrl(fileId, userId) {
    return `${API_BASE_URL}/download-file/${fileId}?user_id=${userId}`;
}