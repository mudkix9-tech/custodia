import 'dotenv/config';
import { getBoss, createWorker } from './apps/api/src/lib/queue.js';

async function run() {
  console.log('Connecting to pg-boss...');
  const boss = await getBoss();

  let jobPickedUp = false;

  const worker = createWorker('test-queue', async (job) => {
    console.log('Job picked up successfully!', job);
    jobPickedUp = true;
  });

  console.log('Enqueuing test job...');
  await boss.send('test-queue', { name: 'hello', data: { timestamp: Date.now() } });

  console.log('Waiting for job pickup...');
  
  // Wait up to 10 seconds for the job to be picked up
  for (let i = 0; i < 10; i++) {
    if (jobPickedUp) {
      console.log('SUCCESS: pg-boss is working with LISTEN/NOTIFY.');
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.error('FAILED: Job was not picked up within 10 seconds.');
  process.exit(1);
}

run().catch(console.error);
