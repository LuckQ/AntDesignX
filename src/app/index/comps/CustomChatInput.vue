<template>
    <div class="custom-chat-input">
        <div class="textarea-container">
            <textarea ref="textareaRef" v-model="inputValue" :placeholder="placeholder" :disabled="disabled"
                :class="['custom-textarea', customClass]" @keydown.enter.prevent="handleKeyDown"
                @input="handleInput"></textarea>

            <!-- 上传文件标签 -->
            <div v-if="uploadedFiles.length > 0" class="uploaded-files-container">
                <div class="files-list">
                    <t-tag v-for="(file, index) in uploadedFiles" :key="file.id || index" theme="default"
                        variant="light" shape="round" size="small"
                        :class="['file-tag', getFileTypeClass(file.extension)]">
                        <t-icon :name="getFileIcon(file.extension)" class="file-icon" />
                        <span class="file-name">{{ formatFileName(file.name) }}</span>
                        <t-button theme="default" variant="text" size="small" class="close-btn"
                            @click="handleRemoveFile(index)">
                            <t-icon name="close" />
                        </t-button>
                    </t-tag>
                </div>
            </div>

            <div class="textarea-actions">
                <t-button v-if="!loading && showAttachButton" theme="default" variant="text" shape="circle"
                    size="medium" class="action-btn attach-btn" @click="handleAttachClick">
                    <template #icon><t-icon name="attach" /></template>
                </t-button>
                <t-button v-if="loading && showStopButton && !uploadingFile" theme="danger" shape="circle" size="medium"
                    class="action-btn stop-btn" @click="handleStop">
                    <template #icon><t-icon name="stop" size="30" /></template>
                </t-button>
                <t-button v-if="!loading || uploadingFile" theme="primary" shape="circle" size="medium"
                    class="action-btn send-btn"
                    :disabled="disabled || (!inputValue.trim() && !enableEmptySend && uploadedFiles.length === 0)"
                    @click="handleSend">
                    <template #icon><t-icon name="send" size="14" /></template>
                </t-button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed } from 'vue';
import { Icon as TIcon, Button as TButton, Tag as TTag } from 'tdesign-vue-next';

// 定义属性
const props = defineProps({
    // v-model绑定值
    modelValue: {
        type: String,
        default: ''
    },
    // 是否禁用
    disabled: {
        type: Boolean,
        default: false
    },
    // 是否禁用停止按钮
    stopDisabled: {
        type: Boolean,
        default: false
    },
    // 是否显示停止按钮
    showStopButton: {
        type: Boolean,
        default: true
    },
    // 是否允许发送空消息
    enableEmptySend: {
        type: Boolean,
        default: false
    },
    // 显示附件按钮
    showAttachButton: {
        type: Boolean,
        default: true
    },
    // 是否正在加载
    loading: {
        type: Boolean,
        default: false
    },
    // 是否正在上传文件
    uploadingFile: {
        type: Boolean,
        default: false
    },
    // 上传的文件列表
    uploadedFiles: {
        type: Array,
        default: () => []
    },
    // 文本域属性
    textareaProps: {
        type: Object,
        default: () => ({})
    },
    // 是否自动调整高度
    autosize: {
        type: Boolean,
        default: true
    },
    // 最小行数
    minRows: {
        type: Number,
        default: 1
    },
    // 最大行数
    maxRows: {
        type: Number,
        default: 5
    }
});

// 定义事件
const emit = defineEmits(['update:modelValue', 'send', 'stop', 'focus', 'blur', 'keydown', 'attach-click', 'remove-file']);

// 输入值
const inputValue = ref(props.modelValue);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// 从textareaProps中获取placeholder和class
const placeholder = computed(() => props.textareaProps?.placeholder || '请输入消息...');
const customClass = computed(() => props.textareaProps?.class || '');

// 文件类型映射
const fileTypeMap = {
    'txt': 'text',
    'md': 'markdown',
    'mdx': 'markdown',
    'markdown': 'markdown',
    'pdf': 'pdf',
    'html': 'code',
    'htm': 'code',
    'xlsx': 'spreadsheet',
    'xls': 'spreadsheet',
    'csv': 'spreadsheet',
    'docx': 'document',
    // ...可以根据需要添加更多类型
    'default': 'generic' // 默认/通用类型
};

// 文件图标映射
const fileIconMap = {
    'text': 'file-text',
    'markdown': 'catalog', // Markdown 使用 catalog 图标
    'pdf': 'file-pdf',
    'code': 'file-code',
    'spreadsheet': 'file-excel',
    'document': 'file-word',
    'generic': 'file' // 默认图标
};

// 获取文件类型
const getFileType = (extension: string): string => {
    return fileTypeMap[extension?.toLowerCase()] || fileTypeMap.default;
};

// 获取文件图标
const getFileIcon = (extension: string) => {
    const fileType = getFileType(extension);
    return fileIconMap[fileType] || fileIconMap.default;
};

// 获取文件类型对应的CSS类名
const getFileTypeClass = (extension: string): string => {
    const fileType = getFileType(extension);
    return `file-type-${fileType}`;
};

// 格式化文件名
const formatFileName = (fileName: string): string => {
    if (!fileName || fileName.length <= 8) return fileName || '';
    const extension = fileName.slice(fileName.lastIndexOf('.'));
    const name = fileName.slice(0, fileName.lastIndexOf('.'));
    if (name.length <= 5) return fileName; // 如果名称部分已经很短，保留全名
    return name.slice(0, 5) + '...' + extension;
};

// 处理移除文件
const handleRemoveFile = (index: number) => {
    emit('remove-file', index);
};

// 监听modelValue变化
watch(
    () => props.modelValue,
    (newVal) => {
        inputValue.value = newVal;
    }
);

// 监听inputValue变化
watch(
    () => inputValue.value,
    (newVal) => {
        emit('update:modelValue', newVal);
        if (props.autosize) {
            nextTick(() => {
                adjustTextareaHeight();
            });
        }
    }
);

// 调整textarea高度
const adjustTextareaHeight = () => {
    if (!textareaRef.value) return;

    // 重置高度以获取正确的scrollHeight
    textareaRef.value.style.height = 'auto';

    // 计算行高
    const lineHeight = parseInt(getComputedStyle(textareaRef.value).lineHeight) || 20;
    const minHeight = props.minRows * lineHeight;
    const maxHeight = props.maxRows * lineHeight;

    // 获取内容实际高度
    const scrollHeight = textareaRef.value.scrollHeight;

    // 设置高度，确保在最小和最大高度之间
    let newHeight = Math.max(minHeight, scrollHeight);
    if (maxHeight > 0) {
        newHeight = Math.min(newHeight, maxHeight);
    }

    textareaRef.value.style.height = `${newHeight}px`;
};

// 处理输入事件
const handleInput = () => {
    if (props.autosize) {
        adjustTextareaHeight();
    }
};

// 处理按键事件
const handleKeyDown = (event: KeyboardEvent) => {
    // 发送事件供外部使用
    emit('keydown', event);

    // Shift+Enter换行，Enter发送
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
    }
};

// 发送消息
const handleSend = () => {
    if (props.disabled) return;

    // 判断是否允许发送空消息
    if (!inputValue.value.trim() && !props.enableEmptySend && props.uploadedFiles.length === 0) return;

    // 发送消息
    emit('send', inputValue.value);

    // 清空输入框
    inputValue.value = '';

    // 重置高度
    if (props.autosize && textareaRef.value) {
        nextTick(() => {
            adjustTextareaHeight();
        });
    }
};

// 停止生成
const handleStop = () => {
    emit('stop');
};

// 附件点击事件
const handleAttachClick = () => {
    emit('attach-click');
};

// 在组件挂载后调整高度
onMounted(() => {
    if (props.autosize) {
        adjustTextareaHeight();
    }
});
</script>

<style lang="scss">
@import '/static/styles/variables.scss';

.custom-chat-input {
    width: 100%;
    padding: 0px 16px 0px;
    transition: all 0.3s ease;

    @media (max-width: 768px) {
        padding: 8px 10px 10px;
    }
}

.textarea-container {
    position: relative;
    width: 100%;
    display: flex;
    align-items: flex-end;

    .custom-textarea {
        width: 100%;
        min-height: 80px;
        padding: 10px 12px;
        line-height: 20px;
        border: 1px solid var(--td-component-border, $gray-color-3);
        border-radius: 20px;
        background-color: var(--td-bg-color-container, #fff);
        color: var(--td-text-color-primary, #000);
        transition: all 0.2s ease;
        resize: none;
        overflow-y: auto;
        font-size: 14px;
        padding-right: 90px;

        /* 添加hover状态下的浅蓝色边框效果 */
        &:hover:not(:focus) {
            border-color: $brand-color-6;
            box-shadow: 0 0 0 1px rgba($brand-color, 0.15);
        }

        &:focus {
            outline: none;
            border-color: var(--td-brand-color, $brand-color);
            box-shadow: 0 0 0 2px rgba(var(--td-brand-color-rgb), 0.2);
        }

        &:disabled {
            background-color: var(--td-bg-color-component-disabled, $gray-color-2);
            color: var(--td-text-color-disabled, $gray-color-6);
            cursor: not-allowed;
        }

        &::placeholder {
            color: var(--td-text-color-placeholder, $gray-color-5);
        }
    }

    .uploaded-files-container {
        position: absolute;
        left: 12px;
        bottom: 8px;
        max-width: calc(100% - 120px);
        display: flex;
        align-items: center;
        height: 28px;

        .files-list {
            display: flex;
            align-items: center;
            padding-left: 4px;
            overflow: visible;

            .file-tag {
                position: relative;
                margin-left: -80px;
                padding: 0 6px 0 8px;
                max-width: 130px;
                min-width: 100px;
                height: 24px;
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

                .file-icon {
                    font-size: 14px;
                    margin-right: 4px;
                    color: var(--td-text-color-secondary, $gray-color-7);
                    flex-shrink: 0;
                }

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

                .close-btn {
                    width: 16px;
                    height: 16px;
                    margin-left: auto;
                    padding: 0;
                    line-height: 1;
                    color: var(--td-text-color-secondary, $gray-color-7);

                    &:hover {
                        color: var(--td-error-color, $error-color);
                        background: none;
                    }

                    .t-icon {
                        font-size: 12px;
                    }
                }

                &.file-type-generic {
                    background-color: var(--td-gray-color-1, #f3f3f3);
                    border: 1px solid var(--td-gray-color-3, #dcdcdc);

                    .file-icon {
                        color: var(--td-text-color-secondary, $gray-color-7);
                    }
                }

                /* 文本文档 (txt) - 保持蓝色 */
                &.file-type-text {
                    background-color: var(--td-brand-color-light, rgba($brand-color, 0.1));
                    border: 1px solid var(--td-brand-color-2, rgba($brand-color, 0.3));

                    .file-icon {
                        color: var(--td-brand-color, $brand-color);
                    }
                }

                /* Markdown 文档 - 改为灰色 */
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
            }
        }
    }

    .textarea-actions {
        position: absolute;
        right: 10px;
        bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;

        .action-btn {
            min-width: 32px;
            width: 32px;
            height: 32px;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;

            .t-icon {
                font-size: 16px;
            }
        }

        .stop-btn {
            background-color: var(--td-error-color, $error-color);

            &:hover:not(:disabled) {
                background-color: var(--td-error-color-hover, $error-color-hover);
            }

            &:active:not(:disabled) {
                background-color: var(--td-error-color-active, $error-color-active);
            }
        }

        .attach-btn {
            color: var(--td-text-color-placeholder, $gray-color-5);

            &:hover:not(:disabled) {
                color: var(--td-brand-color, $brand-color);
                background-color: var(--td-bg-color-container-hover, $gray-color-2);
            }
        }

        .send-btn {
            background-color: var(--td-brand-color, $brand-color);

            &:hover:not(:disabled) {
                background-color: var(--td-brand-color-hover, $brand-color-hover);
            }

            &:active:not(:disabled) {
                background-color: var(--td-brand-color-active, $brand-color-active);
            }

            &:disabled {
                opacity: 0.6;
                background-color: var(--td-brand-color, $brand-color);
            }
        }
    }
}
</style>