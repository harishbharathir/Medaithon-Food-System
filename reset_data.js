require('dotenv').config();
const { mongoose, initDb, dbQueries, MealClaim, Participant, MealSession } = require('./server/db');
const http = require('http');

async function resetAllData() {
  console.log('🔄 Resetting Medaithon Food System Data in MongoDB Atlas to 100% Fresh State...\n');

  await initDb();

  // 1. Delete all meal claims across all sessions in medaithon
  const claimResult = await MealClaim.deleteMany({});
  console.log(`✅ Cleared all meal claims: ${claimResult.deletedCount} claim(s) removed.`);

  // 2. Reset foodServings array to empty for all participants in medaithon
  const foodResult = await Participant.updateMany({}, { $set: { foodServings: [] } });
  console.log(`✅ Reset food servings on all participants in 'medaithon' DB: ${foodResult.modifiedCount} updated.`);

  // 3. Also reset foodServings in 'horizonxt' DB if it exists on the cluster
  try {
    const horizonxtConn = await mongoose.createConnection(
      process.env.MONGODB_URI.replace('/medaithon', '/horizonxt')
    ).asPromise();
    const hResult = await horizonxtConn.collection('participants').updateMany({}, { $set: { foodServings: [] } });
    await horizonxtConn.collection('mealclaims').deleteMany({}).catch(() => {});
    console.log(`✅ Reset food servings on all participants in 'horizonxt' DB: ${hResult.modifiedCount} updated.`);
    await horizonxtConn.close();
  } catch (e) {
    console.log('ℹ️ Note on horizonxt sync:', e.message);
  }

  // 4. Remove any walk-in / test participants created during testing
  const walkinResult = await Participant.deleteMany({
    $or: [
      { is_manual_entry: 1 },
      { id: { $regex: 'TEST', $options: 'i' } },
      { name: { $regex: 'TEST', $options: 'i' } }
    ]
  });
  if (walkinResult.deletedCount > 0) {
    console.log(`✅ Removed test/walk-in participants: ${walkinResult.deletedCount} entry(ies) removed.`);
  }

  // 5. Ensure Session 1 is active and secondary sessions are inactive
  await MealSession.updateOne({ id: 1 }, { $set: { is_active: 1 } });
  await MealSession.updateMany({ id: { $ne: 1 } }, { $set: { is_active: 0 } });
  console.log('✅ Meal sessions reset (Session 1 active, others inactive).');

  // 6. Query and display verification summary
  const totalParticipants = await Participant.countDocuments();
  const totalClaims = await MealClaim.countDocuments();
  const activeStats = await dbQueries.getActiveSessionStats();

  console.log('\n📊 100% Fresh System Status in MongoDB Atlas:');
  console.log(`   - Total Participants: ${totalParticipants} (All 0 claims / 0 food servings)`);
  console.log(`   - Total Claims in DB: ${totalClaims}`);
  console.log(`   - Active Session: ${activeStats.session?.name}`);
  console.log(`   - Target Meals: ${activeStats.total_target}`);
  console.log(`   - Claimed: ${activeStats.claimed_count}`);
  console.log(`   - Remaining Meals: ${activeStats.remaining_count}`);
  console.log(`   - Veg Claimed: ${activeStats.veg_claimed}`);
  console.log(`   - Non-Veg Claimed: ${activeStats.non_veg_claimed}`);

  // 7. Notify running server if online
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
    console.log('\nℹ️ Server is not currently running on port 3000 (fresh state will load upon next launch).');
    process.exit(0);
  });

  req.write(JSON.stringify({ sessionId: null }));
  req.end();
}

resetAllData().catch(err => {
  console.error('Reset error:', err);
  process.exit(1);
});
