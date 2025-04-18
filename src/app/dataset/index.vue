<template>
    <div class="dataset-container">
        <!-- 知识库列表区域 -->
        <t-card title="知识库管理" class="dataset-card">
            <t-loading :loading="loading">
                <div v-if="datasetList.length > 0" class="debug-info">
                    已加载 {{ datasetList.length }} 条记录
                </div>

                <!-- 卡片式网格布局 -->
                <div class="dataset-grid">
                    <t-card v-for="(item, index) in datasetList" :key="item.id" class="dataset-item-card" :hover="true"
                        :bordered="true" @click="showDatasetDetailView(item)" header-bordered>
                        <t-tag class="document-count-tag" theme="primary" variant="light">文档：{{ item.document_count
                        }}</t-tag>
                        <template #title>
                            <div class="dataset-card-title">
                                <span class="dataset-name">{{ item.name }}</span>
                            </div>
                        </template>
                        <div class="dataset-card-content">
                            <p class="dataset-description">{{ item.description || '暂无描述' }}</p>
                            <p class="dataset-create-time">创建时间：{{ formatDate(item.created_at) }}</p>
                        </div>
                    </t-card>
                </div>

                <!-- 空数据状态 -->
                <t-empty v-if="datasetList.length === 0" description="暂无数据" />

                <!-- 分页器 -->
                <div class="pagination-container">
                    <t-pagination v-model="pagination.current" :total="pagination.total"
                        :page-size="pagination.pageSize" :page-size-options="[10, 20, 50]"
                        @change="onPaginationChange" />
                </div>
            </t-loading>
        </t-card>
    </div>
</template>

<script setup lang="ts">
/*————————————————————————————————————————————————组件依赖导入————————————————————————————————————————————————*/
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { getDatasetList } from '/static/api/dataset.js';

/*————————————————————————————————————————————————数据状态定义————————————————————————————————————————————————*/
const router = useRouter();
const loading = ref(true);
const datasetList = ref([]);
const pagination = ref({
    current: 1,
    pageSize: 10,
    total: 0
});

/*————————————————————————————————————————————————工具函数————————————————————————————————————————————————*/
// 格式化日期
const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
};

/*————————————————————————————————————————————————知识库列表数据处理————————————————————————————————————————————————*/
// 获取知识库列表
const fetchDatasetList = async () => {
    loading.value = true;
    try {
        const response = await getDatasetList({
            page: pagination.value.current,
            limit: pagination.value.pageSize
        });

        // 确保数据是数组
        if (Array.isArray(response.data)) {
            datasetList.value = response.data;
        } else if (response.data) {
            datasetList.value = [response.data];
        } else {
            datasetList.value = [];
        }

        pagination.value.total = response.total || 0;
        console.log('获取到知识库列表:', datasetList.value);
    } catch (error) {
        console.error('获取知识库列表失败:', error);
        MessagePlugin.error('获取知识库列表失败');
        datasetList.value = [];
    } finally {
        loading.value = false;
    }
};

/*————————————————————————————————————————————————知识库详情处理————————————————————————————————————————————————*/
// 显示知识库详情 - 改为路由跳转
const showDatasetDetailView = (dataset) => {
    console.log('跳转到知识库详情页:', dataset);
    
    // 导航到知识库详情页面，使用路由参数传递ID和路径
    router.push({
        path: `/app/dataset/detail/${dataset.id}`,
        query: {
            name: dataset.name || `知识库${dataset.id}`
        }
    });
};

/*————————————————————————————————————————————————分页处理————————————————————————————————————————————————*/
// 分页变化
const onPaginationChange = (pageInfo) => {
    pagination.value.current = pageInfo.current;
    fetchDatasetList();
};

/*————————————————————————————————————————————————生命周期钩子————————————————————————————————————————————————*/
// 初始化加载
onMounted(() => {
    // 获取列表数据
    fetchDatasetList();
});
</script>

<style lang="scss">
@import '/static/styles/variables.scss';

.dataset-container {
    padding: $comp-paddingTB-l $comp-paddingLR-l;
    display: flex;
    flex-direction: column;
    height: 100%;
}

.dataset-card {
    margin-bottom: $comp-margin-m;
}

.debug-info {
    margin-bottom: 10px;
    color: #999;
    font-size: 12px;
}

/* 卡片网格布局样式 */
.dataset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
}

.dataset-item-card {
    height: 100%;
    transition: all 0.1s ease-in-out;
    cursor: pointer;
    position: relative;

    &:hover {
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    }
}

/* 文档数量标签样式 */
.document-count-tag {
    position: absolute;
    top: $comp-paddingTB-l;
    right: $comp-paddingLR-l;
    z-index: 2;
}

.dataset-card-title {
    display: flex;
    align-items: center;
}

.dataset-name {
    font-weight: 500;
    font-size: 16px;
    color: #0052d9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.dataset-card-content {
    min-height: 80px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.dataset-description {
    color: #666;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

.dataset-create-time {
    color: #999;
    font-size: 12px;
}

.pagination-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
}
</style>