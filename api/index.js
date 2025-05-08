require('dotenv').config();
const path = require('path');
const express = require('express');
const setupSyncRoutes = require('../routes/sync');
const SyncTaskController = require('../controllers/syncTaskController');

const app = express();

// 配置静态文件服务
app.use(express.static(path.join(__dirname, '../public')));
app.use('api', express.static(path.join(__dirname, '../routes')));
app.use(express.json());

// 初始化同步任务
const syncTaskController = new SyncTaskController();
// 设置路由，并将 SyncTaskController 实例传递给路由
setupSyncRoutes(app, syncTaskController);

app.get('/', (req, res) => {
  res.send('Sync service is running.');
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// 声明端口号并启动服务器
const PORT = process.env.PORT || 3000; // 优先使用环境变量中的 PORT，否则默认使用 3000
app.listen(PORT, () => {
  console.log(`Sync service is running on port ${PORT}.`);
});

module.exports = app;
