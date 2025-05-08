const cron = require('node-cron');
const axios = require('axios');

// 配置化 API URL 和 Token
const API_BASE_URL = process.env.API_BASE_URL || 'https://alpha-dev.predict.one/api/rest';
const JTW_TOKEN = process.env.JTW_TOKEN || 'YOUR_TOKEN_HERE';

class SyncTaskController {
  constructor() {
    this.lastSyncTime = null; // 上次同步时间
    this.lastUpdatedCount = 0; // 上次更新的新闻条数
    this.lastSyncError = null; // 上次同步的错误信息
    this.startScheduledTask();
  }

  getLastSyncInfo() {
    return {
      lastSyncTime: this.lastSyncTime,
      lastUpdatedCount: this.lastUpdatedCount,
      lastSyncError: this.lastSyncError,
    };
  }

  async fetchAndSyncData() {
    try {
      // 调用批量删除接口，删除过期新闻
      // await this.deleteExpiredNews();

      const tableBData = await this.fetchTableBData();

      if (!Array.isArray(tableBData) || tableBData.length === 0) {
        return;
      }

      const uniqueData = this.removeDuplicates(tableBData);

      await this.syncTableA(uniqueData);
      // 更新上次同步时间和更新条数
      this.lastSyncTime = new Date().toISOString();

      this.lastSyncError = null;
    } catch (error) {
      this.lastSyncError = error.message || 'Unknown error';
      console.error('Error during scheduled sync task:', error);
    }
  }

  async deleteExpiredNews() {
    try {
      console.log('Checking for expired news...');
      const response = await axios.delete(`${API_BASE_URL}/deleteExpiredNews`, {
        headers: {
          Authorization: `Bearer ${JTW_TOKEN}`,
        },
      });
      console.log('Expired news deleted:', response.data);
    } catch (error) {
      console.error('Error deleting expired news:', error.message);
    }
  }

  async fetchTableBData() {
    try {
      const response = await axios.get(`${API_BASE_URL}/getAllRunNews`);

      const rawData = response.data?.run || [];
      console.log(`Fetched ${rawData.length} items from Table Run`);

      const parsedData = rawData.flatMap((item) => {
        const createdAt = item.finishedAt || '';
        const output = item.serializableOutput || {};
        const newsItems = Object.values(output).flat();

        return newsItems.map((news) => ({
          id: item.id,
          link: news.link,
          title: news.title,
          description: news.description,
          createdAt: createdAt,
        }));
      });

      console.log(`Parsed ${parsedData.length} items from Table Run.`);

      // 过滤掉超过 72 小时的新闻
      const sixHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const validData = parsedData.filter((item) => {
        const createdAtDate = new Date(item.createdAt);
        return createdAtDate >= sixHoursAgo;
      });

      console.log(`Filtered ${validData.length} valid items from Table Run.`);
      return validData.filter((item) => item.link && item.title && item.description); // 过滤无效数据
    } catch (error) {
      console.error('Error fetching data from table Run:', error);
      return [];
    }
  }

  async syncTableA(data) {
    try {
      const existingDataResponse = await axios.get(`${API_BASE_URL}/getAllNews`);
      const existingData = existingDataResponse.data?.news || [];
      console.log(`Fetched ${existingData.length} items from Table News.`);

      const existingIds = new Set(existingData.map((item) => item.id));
      const newData = data.filter((item) => !existingIds.has(item.id));

      if (newData.length === 0) {
        console.log('No new data to sync to table News.');
        return;
      }

      const validData = newData.filter(
        (item) => item.id && item.link && item.title && item.description
      );

      if (validData.length === 0) {
        console.log('No valid data to sync to table News.');
        return;
      }

      const uniqueData = this.removeDuplicates(validData);

      if (uniqueData.length === 0) {
        console.log('No unique data to sync to table News.');
        return;
      }

      // 过滤掉超过 72 小时的新闻
      const sixHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const filteredData = uniqueData.filter((item) => {
        const createdAtDate = new Date(item.createdAt);
        return createdAtDate >= sixHoursAgo;
      });

      if (filteredData.length === 0) {
        console.log('No data to sync after filtering by createdAt.');
        return;
      }

      // 确保在映射时正确处理每个 item
      const objects = filteredData.map((item) => ({
        id: item.id,
        link: item.link,
        title: item.title,
        description: item.description,
        createdAt: new Date(item.createdAt).toISOString(),
      }));

      console.log(`Syncing ${objects.length} items to Table News...`);

      const response = await axios.post(
        `${API_BASE_URL}/updateNews`,
        { objects: objects },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${JTW_TOKEN}`,
          },
        }
      );
      this.lastUpdatedCount = response.data?.insert_news?.affected_rows || 0;
      console.log('Sync response:', response.data);
    } catch (error) {
      if (error.response) {
        console.error('API Error:', error.response.status, error.response.data);
        throw new Error(`API Error: ${error.response.data.error || 'Unknown error'}`);
      } else if (error.request) {
        console.error('Network Error:', error.message);
        throw new Error('Network Error: Unable to reach the server.');
      } else {
        console.error('Unexpected Error:', error.message);
        throw new Error(`Unexpected Error: ${error.message}`);
      }
    }
  }

  removeDuplicates(data) {
    const seenIds = new Set();
    const seenTitles = new Set();

    return data.filter((item) => {
      if (seenIds.has(item.id) || seenTitles.has(item.title)) {
        return false;
      }

      seenIds.add(item.id);
      seenTitles.add(item.title);

      return true;
    });
  }

  startScheduledTask() {
    cron.schedule('0 * * * *', () => {
      console.log('Starting scheduled sync task...');
      this.fetchAndSyncData().catch((error) => {
        console.error('Error during scheduled sync task:', error);
      });
    });
  }
}

module.exports = SyncTaskController;
