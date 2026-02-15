import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import BotDetails from '../views/BotDetails.vue'
import CreateBot from '../views/CreateBot.vue'
import Status from '../views/Status.vue'
import Settings from '../views/Settings.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/bot/new',
    name: 'CreateBot',
    component: CreateBot
  },
  {
    path: '/bot/:id',
    name: 'BotDetails',
    component: BotDetails
  },
  {
    path: '/status',
    name: 'Status',
    component: Status
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
