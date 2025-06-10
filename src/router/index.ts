import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/app/father'
    // redirect: '/app/index'
  },
   {
    path: '/app/father',
    name: 'AppFather',
    component: () => import('../app/father/father.vue')
  },
  {
    path: '/app/index',
    name: 'AppIndex',
    component: () => import('../app/index/index.vue')
  },
  {
    path: '/web/index',
    name: 'WebIndex',
    component: () => import('../web/index.vue')
  },
  // 知识库相关路由
  {
    path: '/app/dataset',
    name: 'DatasetList',
    component: () => import('../app/dataset/index.vue')
  },
  {
    path: '/app/dataset/detail/:id',
    name: 'DatasetDetail',
    component: () => import('../app/dataset/detail.vue')
  },
  // {
  //   path: '/app/dataset/create',
  //   name: 'DatasetCreate',
  //   component: () => import('../app/dataset/create.vue')
  // },
  {
    path: '/app/dataset/upload/:id',
    name: 'DatasetUpload', 
    component: () => import('../app/dataset/upload.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router 