<template>
    <t-chat-item :avatar="avatar" :name="name" :role="role" :datetime="datetime" :content="content">
        <template #content cla>
            <!-- 工作流程展示区域 - 使用独立组件 -->
            <workflow-steps v-if="role === 'assistant' && workflowSteps && workflowSteps.length > 0" :steps="workflowSteps" />

            <!-- 只有助手消息且有思考内容才显示思考框 -->
            <t-chat-reasoning v-if="reasoning && reasoning.trim() && role === 'assistant' && reasoning !== '思考中...'"
                expand-icon-placement="right"
                @expand-change="(expandValue) => $emit('reasoning-expand-change', expandValue)">
                <template #header>
                    <t-chat-loading v-if="isFirstMessage && loading" text="思考中..." indicator />
                    <div v-else class="reasoning-header">
                        <t-icon name="dart-board"></t-icon>
                        <span>思考过程</span>
                    </div>
                </template>
                <t-chat-content :content="reasoning || ''" />
            </t-chat-reasoning>
            
            <!-- 显示消息内容，如果没有则显示占位 -->
            <t-chat-content v-if="content && content.trim().length > 0" :content="content" class="zero-margins" />

            <!-- 文件展示 -->
            <div class="message-files" v-if="files && files.length > 0">
                <div class="files-scroll-container">
                    <div class="files-list">
                        <t-tag v-for="(file, index) in files" :key="index" theme="default" variant="light" shape="round"
                            size="small" :class="['file-tag', getFileTypeClass(getFileExtension(file.filename))]">
                            <t-icon :name="getFileIcon(getFileExtension(file.filename))" class="file-icon" />
                            <span class="file-name">{{ formatFileName(file.filename) }}</span>
                        </t-tag>
                    </div>
                </div>
            </div>

        </template>

        <!-- 第一条消息且正在加载时显示加载动画 -->
        <template v-if="isFirstMessage && loading && !firstTokenReceived" #content>
            <div class="loading-space">
                <t-space>
                    <t-chat-loading animation="moving" text="思考中..." />
                </t-space>
            </div>
        </template>


        <!-- 操作按钮，只对助手消息显示 -->
        <template #actions>
            <chat-action class="chat-actions-container" v-if="!isStreamLoad && role === 'assistant'" :is-good="isGood" :is-bad="isBad"
                :content="content || ''" @operation="handleOperation" />
        </template>
    </t-chat-item>
</template>

<script setup lang="jsx">
import { defineProps, defineEmits, ref, onMounted, onUnmounted, computed } from 'vue';
import ChatAction from './ChatAction.vue';
import WorkflowSteps from './WorkflowSteps.vue';

// 组件属性
const props = defineProps({
    avatar: {
        type: String,
        default: ''
    },
    name: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        default: 'user'
    },
    datetime: {
        type: String,
        default: ''
    },
    content: {
        type: String,
        default: ''
    },
    reasoning: {
        type: String,
        default: ''
    },
    isFirstMessage: {
        type: Boolean,
        default: false
    },
    loading: {
        type: Boolean,
        default: false
    },
    firstTokenReceived: {
        type: Boolean,
        default: false
    },
    isStreamLoad: {
        type: Boolean,
        default: false
    },
    isGood: {
        type: Boolean,
        default: false
    },
    isBad: {
        type: Boolean,
        default: false
    },
    files: {
        type: Array,
        default: () => []
    },
    workflowSteps: {
        type: Array,
        default: () => []
    }
});

// 定义事件
const emit = defineEmits(['reasoning-expand-change', 'operation']);

// 处理操作事件，确保正确传递参数
const handleOperation = (type, options) => {
    emit('operation', type, options);
};

// 动态省略号状态
const dotsCount = ref(1);
let dotsInterval = null;

// 创建动态省略号动画
onMounted(() => {
    dotsInterval = setInterval(() => {
        dotsCount.value = (dotsCount.value % 6) + 1;
    }, 100);
});

// 清理定时器
onUnmounted(() => {
    if (dotsInterval) {
        clearInterval(dotsInterval);
    }
});

// 获取文件扩展名
const getFileExtension = (filename) => {
    if (!filename) return '';
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return '';
    return filename.slice(lastDotIndex + 1).toLowerCase();
};

// 文件类型映射
const fileTypeMap = {
    'document': 'document',
    'image': 'image',
    'audio': 'audio',
    'video': 'video',
    'txt': 'text',
    'md': 'markdown',
    'mdx': 'markdown',
    'markdown': 'markdown',
    'pdf': 'pdf',
    'html': 'code',
    'htm': 'code',
    'js': 'code',
    'ts': 'code',
    'css': 'code',
    'scss': 'code',
    'less': 'code',
    'json': 'code',
    'py': 'code',
    'java': 'code',
    'c': 'code',
    'cpp': 'code',
    'h': 'code',
    'php': 'code',
    'rb': 'code',
    'go': 'code',
    'rs': 'code',
    'swift': 'code',
    'kt': 'code',
    'dart': 'code',
    'vue': 'code',
    'jsx': 'code',
    'tsx': 'code',
    'xml': 'code',
    'yaml': 'code',
    'yml': 'code',
    'xlsx': 'spreadsheet',
    'xls': 'spreadsheet',
    'csv': 'spreadsheet',
    'docx': 'document',
    'doc': 'document',
    'rtf': 'document',
    'odt': 'document',
    'jpg': 'image',
    'jpeg': 'image',
    'png': 'image',
    'gif': 'image',
    'svg': 'image',
    'bmp': 'image',
    'webp': 'image',
    'mp3': 'audio',
    'wav': 'audio',
    'ogg': 'audio',
    'flac': 'audio',
    'aac': 'audio',
    'm4a': 'audio',
    'mp4': 'video',
    'avi': 'video',
    'mov': 'video',
    'wmv': 'video',
    'mkv': 'video',
    'webm': 'video',
    'custom': 'generic',
    'default': 'generic' // 默认/通用类型
};

// 文件图标映射
const fileIconMap = {
    'text': 'file-text',
    'markdown': 'catalog',
    'pdf': 'file-pdf',
    'code': 'file-code',
    'spreadsheet': 'file-excel',
    'document': 'file-word',
    'image': 'photo',
    'audio': 'play-circle',
    'video': 'play-circle-stroke',
    'generic': 'file' // 默认图标
};

// 获取文件类型
const getFileType = (extension) => {
    return fileTypeMap[extension?.toLowerCase()] || fileTypeMap.default;
};

// 获取文件图标
const getFileIcon = (extension) => {
    const fileType = getFileType(extension);
    return fileIconMap[fileType] || fileIconMap.generic;
};

// 获取文件类型对应的CSS类名
const getFileTypeClass = (extension) => {
    const fileType = getFileType(extension);
    return `file-type-${fileType}`;
};

// 添加：获取动态省略号函数
const getLoadingDots = () => {
    const fullDots = '......'; // 6个点
    return fullDots.substring(0, dotsCount.value);
};

// 格式化文件名
const formatFileName = (fileName) => {
    if (!fileName) return '';
    if (fileName.length <= 8) return fileName;
    
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return fileName.slice(0, 5) + '...';
    
    const extension = fileName.slice(lastDotIndex);
    const name = fileName.slice(0, lastDotIndex);
    if (name.length <= 5) return fileName; // 如果名称部分已经很短，保留全名
    return name.slice(0, 5) + '...' + extension;
};
</script>

<style lang="scss">
@import '/static/styles/variables.scss';

/* 添加基础过渡效果 */
.t-chat-item {
    transition: all 0.3s ease, width 0.3s ease, max-width 0.3s ease, transform 0.3s ease;
}

/* 消息内容容器 */
:deep(.t-chat__bubble) {
    transition: all 0.3s ease, width 0.3s ease, max-width 0.3s ease;
}

/* 思考框样式 */
:deep(.t-chat-reasoning) {
    transition: all 0.3s ease, max-width 0.3s ease, width 0.3s ease;
    
    .t-chat-reasoning__header, 
    .t-chat-reasoning__content {
        transition: all 0.3s ease;
    }
}

/* 思考框头部样式 */
.reasoning-header {
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.3s ease;

    .t-icon {
        font-size: 16px;
        color: var(--td-brand-color);
    }
}

/* 消息内容无边距 */
.zero-margins {
    margin: 0 !important;
    transition: all 0.3s ease;
}

/* 文件展示区域 */
.message-files {
    margin-top: 12px;
    transition: all 0.3s ease;
}

/* 文件滚动容器 */
.files-scroll-container {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    transition: all 0.3s ease;

    &::-webkit-scrollbar {
        display: none;
    }

    .files-list {
        display: flex;
        align-items: center;
        padding-left: 4px;
        overflow: visible;
    }
}

/* 文件标签 */
.file-tag {
    position: relative;
    margin-left: -70px;
    padding: 5px 6px 5px 8px;
    max-width: 130px;
    min-width: 100px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    border-radius: 12px;
    transition: transform 0.2s ease, margin-left 0.2s ease, z-index 0s linear 0s, border-color 0.2s ease, background-color 0.2s ease;
    cursor: pointer;
    box-sizing: border-box;

    &:first-child {
        margin-left: 0;
    }

    &:hover {
        z-index: 10;
        transform: scale(1.05);
        border-color: var(--td-brand-color, $brand-color);
    }

    /* 文件图标 */
    .file-icon {
        font-size: 14px;
        margin-right: 4px;
        color: var(--td-text-color-secondary, $gray-color-7);
        flex-shrink: 0;
    }

    /* 文件名称 */
    .file-name {
        font-size: 12px;
        color: var(--td-text-color-primary, #000);
        flex-grow: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-right: 4px;
    }

    /* 文件类型样式 */
    &.file-type-generic {
        background-color: var(--td-gray-color-1, #f3f3f3);
        border: 1px solid var(--td-gray-color-3, #dcdcdc);

        .file-icon {
            color: var(--td-text-color-secondary, $gray-color-7);
        }
    }

    &.file-type-text {
        background-color: var(--td-brand-color-light, rgba($brand-color, 0.1));
        border: 1px solid var(--td-brand-color-2, rgba($brand-color, 0.3));

        .file-icon {
            color: var(--td-brand-color, $brand-color);
        }
    }

    &.file-type-markdown {
        background-color: var(--td-gray-color-1, #f3f3f3);
        border: 1px solid var(--td-gray-color-3, #dcdcdc);

        .file-icon {
            color: var(--td-text-color-secondary, $gray-color-7);
        }
    }

    &.file-type-pdf {
        background-color: var(--td-error-color-1, rgba($error-color, 0.1));
        border: 1px solid var(--td-error-color-2, rgba($error-color, 0.3));

        .file-icon {
            color: var(--td-error-color, $error-color);
        }
    }

    &.file-type-code {
        background-color: var(--td-warning-color-1, rgba($warning-color, 0.1));
        border: 1px solid var(--td-warning-color-2, rgba($warning-color, 0.3));

        .file-icon {
            color: var(--td-warning-color, $warning-color);
        }
    }

    &.file-type-spreadsheet {
        background-color: var(--td-success-color-1, rgba($success-color, 0.1));
        border: 1px solid var(--td-success-color-2, rgba($success-color, 0.3));

        .file-icon {
            color: var(--td-success-color, $success-color);
        }
    }

    &.file-type-document {
        background-color: var(--td-brand-color-light, rgba($brand-color, 0.1));
        border: 1px solid var(--td-brand-color-2, rgba($brand-color, 0.3));

        .file-icon {
            color: var(--td-brand-color, $brand-color);
        }
    }

    &.file-type-image {
        background-color: var(--td-purple-color-1, rgba(#722ed1, 0.1));
        border: 1px solid var(--td-purple-color-3, rgba(#722ed1, 0.3));

        .file-icon {
            color: var(--td-purple-color, #722ed1);
        }
    }

    &.file-type-audio {
        background-color: var(--td-cyan-color-1, rgba(#13c2c2, 0.1));
        border: 1px solid var(--td-cyan-color-3, rgba(#13c2c2, 0.3));

        .file-icon {
            color: var(--td-cyan-color, #13c2c2);
        }
    }

    &.file-type-video {
        background-color: var(--td-magenta-color-1, rgba(#eb2f96, 0.1));
        border: 1px solid var(--td-magenta-color-3, rgba(#eb2f96, 0.3));

        .file-icon {
            color: var(--td-magenta-color, #eb2f96);
        }
    }
}

.t-tag.t-size-s{
    padding: 11px 6px 12px 8px;
}

/* 加载空间 */
.loading-space {
    transition: all 0.3s ease;
    width: 100%;
}

/* 响应式调整 */
@media (max-width: 768px) {
    .file-tag {
        min-width: 80px;
        margin-left: -50px;
    }
}
</style>