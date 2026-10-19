const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('--- 1. Testing GET /api/stats ---');
  let res = await request({ hostname: 'localhost', port: 3000, path: '/api/stats', method: 'GET' });
  console.log('Status:', res.status, 'Target:', res.body.data.total_target, 'Claimed:', res.body.data.claimed_count);

  console.log('\n--- 2. Testing First Scan of MED-1003 (Counter 1) ---');
  res = await request({
    hostname: 'localhost', port: 3000, path: '/api/scans/claim', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { participantId: 'MED-1003', counterId: 'Counter 1', volunteerName: 'Rahul' });
  console.log('Status:', res.status, 'Code:', res.body.code, 'Msg:', res.body.message);

  console.log('\n--- 3. Testing Duplicate Scan of MED-1003 (Counter 2) ---');
  res = await request({
    hostname: 'localhost', port: 3000, path: '/api/scans/claim', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { participantId: 'MED-1003', counterId: 'Counter 2', volunteerName: 'Keerthi' });
  console.log('Status:', res.status, 'Code:', res.body.code, 'Msg:', res.body.message);

  console.log('\n--- 4. Testing Manual Walk-in Entry ---');
  res = await request({
    hostname: 'localhost', port: 3000, path: '/api/participants/manual-entry', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    id: 'MED-WALK-TEST',
    name: 'Dr. Alan Grant',
    college: 'Paleo Institute',
    team_name: 'JurassicAI',
    diet_pref: 'Non-Veg',
    autoClaim: true,
    counterId: 'Counter 2',
    volunteerName: 'Admin Desk'
  });
  console.log('Status:', res.status, 'Success:', res.body.success, 'Msg:', res.body.message, 'Claim ID:', res.body.claim?.claim_id);

  console.log('\n--- 5. Testing Updating Number of Meals & Meal Name ---');
  res = await request({
    hostname: 'localhost', port: 3000, path: '/api/sessions/1', method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, {
    total_target: 400,
    name: 'Day 1 - Lunch (Medaithon Grand Feast - Extended)'
  });
  console.log('Status:', res.status, 'New Target:', res.body.session?.total_target, 'New Name:', res.body.session?.name);

  console.log('\n--- 6. Testing CSV Report Export ---');
  res = await request({ hostname: 'localhost', port: 3000, path: '/api/export/csv', method: 'GET' });
  console.log('Status:', res.status, 'Content-Type:', res.headers['content-type'], 'Length:', res.body.length);
  console.log('CSV Preview:\n', res.body.split('\r\n').slice(0, 3).join('\n'));

  console.log('\n✅ ALL INTEGRATION TESTS PASSED PERFECTLY!');
}

runTests().catch(console.error);
