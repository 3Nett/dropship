const { syncInventory } = require('./dsers');

// This script can be executed manually or scheduled (e.g. with cron) to
// periodically synchronize inventory and pricing from DSers to your
// local store.  It prints a timestamp before and after sync so you
// can monitor its activity.  To schedule with cron on Unix, run
// `node cron.js` at your desired interval.

async function run() {
  console.log(`[${new Date().toISOString()}] Starting inventory sync...`);
  await syncInventory();
  console.log(`[${new Date().toISOString()}] Inventory sync completed.`);
}

run().catch((err) => {
  console.error(err);
});
