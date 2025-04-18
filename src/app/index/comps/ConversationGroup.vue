<template>
    <div class="conversation-group">
        <div class="group-title">{{ title }}</div>
        <t-list-item 
            v-for="conversation in conversations" 
            :key="conversation.id"
            @click="handleConversationSelect(conversation.id)"
            class="conversation-item"
            :class="{ 'active': activeSection === 'chat' && conversation.id === currentConversationId }"
        >
            <t-icon name="chat" class="conversation-icon" />
            <span class="conversation-text">{{ getConversationTitle(conversation) }}</span>
            
            <!-- 更多操作按钮及下拉菜单 - 改为hover触发 -->
            <t-dropdown @click="handleMenuClick($event, conversation.id)" trigger="hover" :hide-after-click="false">
                <t-button 
                    variant="text" 
                    shape="circle" 
                    size="small" 
                    class="more-btn"
                    @click.stop
                >
                    <t-icon name="more" />
                </t-button>
                
                <template #dropdown>
                    <t-dropdown-menu>
                        <t-dropdown-item :value="`pin-${conversation.id}`">
                            <div class="menu-item-content">
                                <t-icon name="pin" class="menu-icon" />
                                <span>置顶对话</span>
                            </div>
                        </t-dropdown-item>
                        <t-dropdown-item :value="`rename-${conversation.id}`">
                            <div class="menu-item-content">
                                <t-icon name="edit" class="menu-icon" />
                                <span>重命名</span>
                            </div>
                        </t-dropdown-item>
                        <t-dropdown-item :value="`delete-${conversation.id}`" theme="error">
                            <div class="menu-item-content">
                                <t-icon name="delete" class="menu-icon" />
                                <span>删除</span>
                            </div>
                        </t-dropdown-item>
                    </t-dropdown-menu>
                </template>
            </t-dropdown>
        </t-list-item>
    </div>
</template>

<script setup lang="ts">
// 组件属性
const props = defineProps({
    title: {
        type: String,
        required: true
    },
    conversations: {
        type: Array,
        required: true
    },
    currentConversationId: {
        type: String,
        default: ''
    },
    activeSection: {
        type: String,
        default: 'chat'
    }
});

// 定义事件
const emit = defineEmits(['select', 'pin-conversation', 'rename-conversation', 'delete-conversation', 'chat-section']);

// 处理菜单点击
const handleMenuClick = (data, conversationId) => {
    // TDesign的dropdown @click事件返回的不是原生事件对象
    // 所以不要尝试使用stopPropagation
    const value = data?.value;
    
    if (!value) return;

    // 处理置顶对话
    if (value.startsWith('pin-')) {
        emit('pin-conversation', conversationId);
        return;
    }

    // 处理重命名对话
    if (value.startsWith('rename-')) {
        emit('rename-conversation', conversationId);
        return;
    }

    // 处理删除对话
    if (value.startsWith('delete-')) {
        emit('delete-conversation', conversationId);
        return;
    }
};

// 获取对话显示标题的方法
const getConversationTitle = (conversation, maxLength = 20) => {
    if (!conversation) return '新对话';

    // 优先使用name字段
    if (conversation.name) {
        return conversation.name.length > maxLength
            ? conversation.name.substring(0, maxLength) + '...'
            : conversation.name;
    }

    // 其次尝试使用最近的用户消息作为标题
    if (conversation.last_message && conversation.last_message.trim()) {
        return conversation.last_message.length > maxLength
            ? conversation.last_message.substring(0, maxLength) + '...'
            : conversation.last_message;
    }

    // 如果没有名称和最近消息，使用ID的一部分
    return `对话 ${conversation.id.substring(0, 8)}...`;
};

// 处理会话选择
const handleConversationSelect = (conversationId) => {
    emit('select', conversationId);
    // 添加切换到聊天区域事件
    emit('chat-section');
};
</script>

<style lang="scss" scoped>
@import '/static/styles/variables.scss';

/* 对话列表抽屉样式 */
.conversation-group {
    margin-bottom: $comp-margin-m;
    
    .group-title {
        font-size: $font-size-body-small;
        color: $text-color-secondary;
        padding: $comp-paddingTB-xs $comp-paddingLR-m;
        margin-bottom: $size-1;
        font-weight: 500;
        position: sticky;
        top: 0;
        background-color: $bg-color-container;
        z-index: 10;
        backdrop-filter: blur(5px);
    }
}

.conversation-item {
    display: flex;
    align-items: center;
    padding: $comp-paddingTB-s $comp-paddingLR-m;
    margin-bottom: $size-1;
    border-radius: $radius-default;
    transition: all 0.3s ease;
    position: relative;
    
    &:hover {
        background-color: $bg-color-container-hover;
        
        .more-btn {
            opacity: 1;
            visibility: visible;
        }
    }
    
    &.active {
        background-color: $brand-color-light;
        color: $brand-color;
        
        .conversation-icon {
            color: $brand-color;
        }
        
        .more-btn {
            opacity: 1;
            visibility: visible;
        }
    }
    
    .conversation-icon {
        margin-right: $size-2;
        color: $text-color-secondary;
    }
    
    .conversation-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .more-btn {
        opacity: 0;
        visibility: hidden; /* 增加可见性属性，提升过渡效果 */
        color: $text-color-secondary;
        transition: all 0.3s ease, opacity 0.3s ease, visibility 0.3s ease;
        
        &:hover {
            color: $text-color-primary;
            background-color: $bg-color-container-hover;
        }

        /* 活跃状态样式 */
        &:active {
            transform: scale(0.95);
        }
    }
}

/* 下拉菜单图标样式 */
.menu-icon {
    margin-right: $size-2;
    font-size: $font-size-body-medium;
    vertical-align: middle;
}

/* 菜单项内容容器样式 */
.menu-item-content {
    display: flex;
    align-items: center;
    width: 100%;
}

/* 确保菜单中的文字也垂直居中 */
:deep(.t-dropdown-item) {
    padding: $comp-paddingTB-xs $comp-paddingLR-m;
}
</style> 