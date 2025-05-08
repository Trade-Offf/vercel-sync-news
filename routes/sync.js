const express = require('express');
const router = express.Router();

module.exports = (app, syncTaskController) => {
  // 手动触发同步的路由
  router.post('/manual-sync', async (req, res) => {
    try {
      await syncTaskController.fetchAndSyncData();
      res.json({ message: 'Manual sync triggered successfully.' });
    } catch (error) {
      console.error('Error during manual sync:', error);
      res.status(500).json({ message: 'Error during manual sync.' });
    }
  });

  // 获取上次同步信息的路由
  router.get('/last-sync-info', (req, res) => {
    const syncInfo = syncTaskController.getLastSyncInfo();
    res.json(syncInfo);
  });

  app.use('/api', router);
};
