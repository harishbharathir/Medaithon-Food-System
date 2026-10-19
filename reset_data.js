require('dotenv').config();
const { initDb, dbQueries, MealClaim, Participant, MealSession } = require('./server/db');
const http = require('http');

async function resetAllData() {
  console.log('🔄 Resetting Medaithon Food System Data in MongoDB Atlas to 100% Fresh State...\n');

  await initDb();

  // 1. Delete all meal claims across all sessions
  const claimResult = await MealClaim.deleteMany({});
  console.log(`✅ Cleared all meal claims: ${claimResult.deletedCount} claim(s) removed.`);

  // 2. Remove any walk-in / test participants created during automated testing
  const walkinResult = await Participant.deleteMany({
    $or: [
      { is_manual_entry: 1 },
      { id: { $regex: 'TEST', $options: 'i' } }
    ]
  });
  console.log(`✅ Removed test/walk-in participants: ${walkinResult.deletedCount} entry(ies) removed.`);

  // 3. Reset Session 1 to original default settings
  await MealSession.updateOne(
    { id: 1 },
    {
      $set: {
        name: 'Day 1 - Lunch (Medaithon Grand Feast)',
        total_target: 350,
        is_active: 1
      }
    }
  );
  console.log('✅ Session 1 reset to default (Name: "Day 1 - Lunch (Medaithon Grand Feast)", Target: 350, Active: 1).');

  // 4. Reset other sessions to inactive
  await MealSession.updateMany({ id: { $ne: 1 } }, { $set: { is_active: 0 } });
  console.log('✅ Secondary meal sessions set to inactive.');

  // 5. Query and display verification summary
  const totalParticipants = await Participant.countDocuments();
  const totalClaims = await MealClaim.countDocuments();
  const activeStats = await dbQueries.getActiveSessionStats();

  console.log('\n📊 Fresh System Status in MongoDB Atlas:');
  console.log(`   - Total Participants: ${totalParticipants} (All marked fresh / 0 claims)`);
  console.log(`   - Total Claims: ${totalClaims}`);
  console.log(`   - Active Session: ${activeStats.session?.name}`);
  console.log(`   - Target Meals: ${activeStats.total_target}`);
  console.log(`   - Claimed: ${activeStats.claimed_count}`);
  console.log(`   - Remaining Meals: ${activeStats.remaining_count}`);
  console.log(`   - Veg Claimed: ${activeStats.veg_claimed}`);
  console.log(`   - Non-Veg Claimed: ${activeStats.non_veg_claimed}`);

  // 6. Notify the running server if online so Socket.io pushes real-time updates to all connected dashboards and scanners
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/reset-claims',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('\n📡 Server real-time broadcast triggered successfully.');
      process.exit(0);
    });
  });

  req.on('error', () => {
    console.log('\nℹ️ Server is not running on port 3000 (will update upon next start).');
    process.exit(0);
  });

  req.write(JSON.stringify({ sessionId: null }));
  req.end();
}

resetAllData().catch(err => {
  console.error('Reset error:', err);
  process.exit(1);
});
