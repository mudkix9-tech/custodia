const fs = require('fs');

let content = fs.readFileSync('apps/api/src/workers/notifications.ts', 'utf8');
content = content.replace(
  "export async function scheduleNotificationJobs() {",
  "export async function scheduleNotificationJobs() {\n  // Using enqueuePendingNotifications to fill the process-queue\n  await notificationsJobQueue.add('enqueue-pending', {}, {\n    repeat: { pattern: '* * * * *' }\n  });\n"
);
fs.writeFileSync('apps/api/src/workers/notifications.ts', content);
