const { join } = require('path');
module.exports = {
  // Changes the cache location for Puppeteer to a directory inside the project
  // which Render will automatically preserve between builds (since it caches node_modules).
  cacheDirectory: join(__dirname, 'node_modules', '.puppeteer_cache'),
};
