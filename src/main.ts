import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import TDesignChat from '@tdesign-vue-next/chat'
import TDesign from 'tdesign-vue-next'
import 'tdesign-vue-next/es/style/index.css'
import router from './router'

const app = createApp(App)
app.use(TDesignChat)
app.use(TDesign)
app.use(router)
app.mount('#app')
