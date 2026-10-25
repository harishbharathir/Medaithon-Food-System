require('dotenv').config();
const mongoose = require('mongoose');

// Auto-clean URI: strip surrounding quotes and ensure target database path
let rawUri = (process.env.MONGODB_URI || '').trim().replace(/^["']|["']$/g, '');
let MONGODB_URI = rawUri;
if (MONGODB_URI && !MONGODB_URI.includes('/medaithon') && !MONGODB_URI.includes('/medaithon_food') && !MONGODB_URI.includes('/horizonxt')) {
  if (MONGODB_URI.includes('?')) {
    MONGODB_URI = MONGODB_URI.replace('?', '/medaithon?');
  } else {
    MONGODB_URI = MONGODB_URI.endsWith('/') ? `${MONGODB_URI}medaithon` : `${MONGODB_URI}/medaithon`;
  }
}

if (!MONGODB_URI) {
  console.error('⚠️ WARNING: MONGODB_URI is not set in environment variables! Please add it to your .env file.');
}

// ----------------- MONGOOSE SCHEMAS ----------------- //

const mealSessionSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  date: { type: String, required: true },
  start_time: { type: String, default: '' },
  end_time: { type: String, default: '' },
  total_target: { type: Number, default: 300 },
  is_active: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

// Flexible participant schema allowing all fields from registration / desk sticker systems
const participantSchema = new mongoose.Schema({
  id: { type: String, uppercase: true, trim: true },
  barcode: { type: String, uppercase: true, trim: true },
  registrationId: { type: String, uppercase: true, trim: true },
  teamId: { type: String, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  college: { type: String, default: '' },
  team_name: { type: String, default: '' },
  teamName: { type: String, default: '' },
  role: { type: String, default: 'Member' },
  diet_pref: { type: String, default: 'Veg' },
  is_manual_entry: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  foodServings: { type: Array, default: [] },
  created_at: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

const mealClaimSchema = new mongoose.Schema({
  claim_id: { type: Number, unique: true },
  session_id: { type: Number, required: true, index: true },
  participant_id: { type: String, required: true, uppercase: true, trim: true, index: true },
  counter_id: { type: String, default: 'Counter 1' },
  volunteer_name: { type: String, default: 'Volunteer' },
  claimed_at: { type: Date, default: Date.now }
});

// Ensure only one claim per participant per meal session
mealClaimSchema.index({ session_id: 1, participant_id: 1 }, { unique: true });

const MealSession = mongoose.model('MealSession', mealSessionSchema);
const Participant = mongoose.model('Participant', participantSchema);
const MealClaim = mongoose.model('MealClaim', mealClaimSchema);

// Helper for auto-incrementing IDs
async function getNextSessionId() {
  const last = await MealSession.findOne().sort({ id: -1 }).select('id').lean();
  return (last && typeof last.id === 'number' ? last.id : 0) + 1;
}

async function getNextClaimId() {
  const last = await MealClaim.findOne().sort({ claim_id: -1 }).select('claim_id').lean();
  return (last && typeof last.claim_id === 'number' ? last.claim_id : 0) + 1;
}

// Normalize participant data across diverse database schemas
function normalizeParticipant(p) {
  if (!p) return null;
  const canonicalId = p.barcode || p.registrationId || p.id || p.teamId || '';
  const team = p.team_name || p.teamName || '';
  return {
    ...p,
    id: canonicalId,
    barcode: p.barcode || canonicalId,
    registrationId: p.registrationId || canonicalId,
    teamId: p.teamId || '',
    team_name: team,
    teamName: team,
    diet_pref: p.diet_pref || 'Veg'
  };
}

// ----------------- DB INITIALIZATION & SEEDING ----------------- //

async function initDb() {
  if (mongoose.connection.readyState === 1) return;

  try {
    console.log(`📡 Connecting to MongoDB Atlas Cloud (${MONGODB_URI.split('@')[1] || 'Cluster'})...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log(`✅ Connected to MongoDB Atlas successfully! (DB: ${mongoose.connection.name})`);

    // Check Meal Sessions
    const sessionCount = await MealSession.countDocuments();
    if (sessionCount === 0) {
      // Check if existing meals collection has records to import
      const mealsCol = mongoose.connection.db.collection('meals');
      const existingMeals = await mealsCol.find().sort({ date: 1 }).toArray();

      if (existingMeals && existingMeals.length > 0) {
        const mapped = existingMeals.map((m, idx) => {
          const dStr = m.date ? new Date(m.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          return {
            id: idx + 1,
            name: `${m.mealType || 'Meal'} (${m.startTime || ''} - ${m.endTime || ''})`.trim(),
            date: dStr,
            start_time: m.startTime || '',
            end_time: m.endTime || '',
            total_target: 350,
            is_active: m.isActive ? 1 : (idx === 0 ? 1 : 0)
          };
        });
        await MealSession.insertMany(mapped);
        console.log(`🌱 Imported ${mapped.length} meal sessions from existing meals collection`);
      } else {
        const today = new Date().toISOString().split('T')[0];
        const defaultSessions = [
          { id: 1, name: 'Day 1 - Lunch (Medaithon Grand Feast)', date: today, start_time: '12:30', end_time: '15:00', total_target: 350, is_active: 1 },
          { id: 2, name: 'Day 1 - High Tea & Energy Snacks', date: today, start_time: '17:00', end_time: '18:30', total_target: 300, is_active: 0 },
          { id: 3, name: 'Day 1 - Dinner (Hackathon Night)', date: today, start_time: '20:30', end_time: '23:00', total_target: 350, is_active: 0 },
          { id: 4, name: 'Day 2 - Power Breakfast', date: today, start_time: '08:00', end_time: '10:00', total_target: 300, is_active: 0 },
          { id: 5, name: 'Day 2 - Lunch & Valedictory Meal', date: today, start_time: '13:00', end_time: '15:00', total_target: 350, is_active: 0 },
        ];
        await MealSession.insertMany(defaultSessions);
        console.log('🌱 Seeded 5 default meal sessions to MongoDB Atlas');
      }
    }

    // Seed default participants ONLY if the collection is completely empty
    const participantCount = await Participant.countDocuments();
    if (participantCount === 0) {
      console.log('⚠️ Participants collection is empty. Please check your database connection.');
    } else {
      console.log(`👥 Found ${participantCount} active participants in MongoDB Atlas`);
    }
  } catch (err) {
    console.error('❌ MongoDB initialization error:', err);
    throw err;
  }
}

// ----------------- DB QUERY FUNCTIONS ----------------- //

const dbQueries = {
  // Get active session
  async getActiveSession() {
    return await MealSession.findOne({ is_active: 1 }).lean();
  },

  // Get all sessions with claimed counts
  async getAllSessions() {
    const sessions = await MealSession.find().sort({ id: 1 }).lean();
    const sessionIds = sessions.map(s => s.id);
    const claimCounts = await MealClaim.aggregate([
      { $match: { session_id: { $in: sessionIds } } },
      { $group: { _id: '$session_id', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    claimCounts.forEach(c => { countMap[c._id] = c.count; });
    return sessions.map(s => ({
      ...s,
      claimed_count: countMap[s.id] || 0
    }));
  },

  // Set active session
  async setActiveSession(sessionId) {
    const sid = parseInt(sessionId);
    await MealSession.updateMany({}, { $set: { is_active: 0 } });
    await MealSession.updateOne({ id: sid }, { $set: { is_active: 1 } });
    return await this.getActiveSession();
  },

  // Create new session
  async createSession(sessionData) {
    const nextId = await getNextSessionId();
    const newSession = new MealSession({
      id: nextId,
      name: (sessionData.name || '').trim(),
      date: sessionData.date || new Date().toISOString().split('T')[0],
      start_time: sessionData.start_time || '',
      end_time: sessionData.end_time || '',
      total_target: parseInt(sessionData.total_target) || 300,
      is_active: sessionData.is_active ? 1 : 0
    });
    await newSession.save();
    if (sessionData.is_active) {
      await this.setActiveSession(nextId);
    }
    return await MealSession.findOne({ id: nextId }).lean();
  },

  // Update session
  async updateSession(id, data) {
    const sid = parseInt(id);
    const update = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.total_target !== undefined) update.total_target = parseInt(data.total_target);
    if (data.date !== undefined) update.date = data.date;
    if (data.start_time !== undefined) update.start_time = data.start_time;
    if (data.end_time !== undefined) update.end_time = data.end_time;
    await MealSession.updateOne({ id: sid }, { $set: update });
    return await MealSession.findOne({ id: sid }).lean();
  },

  // Delete session
  async deleteSession(id) {
    const sid = parseInt(id);
    await MealClaim.deleteMany({ session_id: sid });
    return await MealSession.deleteOne({ id: sid });
  },

  // Find participant by ID, Barcode, Registration ID or Team ID
  async getParticipantById(id) {
    if (!id) return null;
    const cleanId = String(id).trim();
    const upperId = cleanId.toUpperCase();
    const query = {
      $or: [
        { barcode: cleanId },
        { barcode: upperId },
        { id: cleanId },
        { id: upperId },
        { registrationId: cleanId },
        { registrationId: upperId },
        { teamId: cleanId },
        { teamId: upperId }
      ]
    };
    const participant = await Participant.findOne(query).lean();
    return normalizeParticipant(participant);
  },

  // Check if participant has claimed for this session
  async getClaim(sessionId, participantId) {
    const sid = parseInt(sessionId);
    const pid = String(participantId || '').trim();
    const participant = await this.getParticipantById(pid);

    const candidates = [pid, pid.toUpperCase()];
    if (participant) {
      if (participant.id) candidates.push(participant.id);
      if (participant.barcode) candidates.push(participant.barcode);
      if (participant.registrationId) candidates.push(participant.registrationId);
    }

    const claim = await MealClaim.findOne({
      session_id: sid,
      participant_id: { $in: [...new Set(candidates)] }
    }).lean();

    if (!claim) return null;

    const session = await MealSession.findOne({ id: sid }).lean();

    return {
      ...claim,
      id: claim.claim_id,
      participant_name: participant?.name || '',
      team_name: participant?.team_name || participant?.teamName || '',
      college: participant?.college || '',
      diet_pref: participant?.diet_pref || 'Veg',
      session_name: session?.name || ''
    };
  },

  // Record meal claim
  async recordClaim(sessionId, participantId, counterId, volunteerName) {
    const sid = parseInt(sessionId);
    const pid = String(participantId || '').trim();
    const participant = await this.getParticipantById(pid);
    const canonicalId = participant ? (participant.barcode || participant.id || pid.toUpperCase()) : pid.toUpperCase();
    const claimId = await getNextClaimId();

    const claim = new MealClaim({
      claim_id: claimId,
      session_id: sid,
      participant_id: canonicalId,
      counter_id: counterId,
      volunteer_name: volunteerName || 'Volunteer',
      claimed_at: new Date()
    });
    await claim.save();

    const session = await MealSession.findOne({ id: sid }).lean();

    // Also sync to participant's foodServings if participant exists in participants collection
    if (participant && participant._id) {
      await Participant.updateOne(
        { _id: participant._id },
        {
          $push: {
            foodServings: {
              mealType: session?.name || `Meal Session ${sid}`,
              servedAt: claim.claimed_at,
              counterId,
              method: 'barcode'
            }
          }
        }
      ).catch(() => {});
    }

    return {
      claim_id: claimId,
      id: claimId,
      session_id: sid,
      participant_id: canonicalId,
      counter_id: counterId,
      volunteer_name: volunteerName || 'Volunteer',
      claimed_at: claim.claimed_at,
      participant_name: participant?.name || '',
      email: participant?.email || '',
      phone: participant?.phone || '',
      college: participant?.college || '',
      team_name: participant?.team_name || participant?.teamName || '',
      diet_pref: participant?.diet_pref || 'Veg',
      meal_name: session?.name || ''
    };
  },

  // Add participant
  async addParticipant(participant) {
    const cleanId = (participant.id || '').trim().toUpperCase();
    const newP = new Participant({
      id: cleanId,
      barcode: cleanId,
      name: (participant.name || '').trim(),
      email: participant.email || '',
      phone: participant.phone || '',
      college: participant.college || '',
      team_name: participant.team_name || '',
      teamName: participant.team_name || '',
      diet_pref: participant.diet_pref || 'Veg',
      is_manual_entry: participant.is_manual_entry ? 1 : 0,
      notes: participant.notes || ''
    });
    await newP.save();
    return await this.getParticipantById(cleanId);
  },

  // Update participant
  async updateParticipant(id, data) {
    const cleanId = (id || '').trim();
    const participant = await this.getParticipantById(cleanId);
    if (!participant) return null;

    const update = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.email !== undefined) update.email = data.email;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.college !== undefined) update.college = data.college;
    if (data.team_name !== undefined) {
      update.team_name = data.team_name;
      update.teamName = data.team_name;
    }
    if (data.diet_pref !== undefined) update.diet_pref = data.diet_pref;
    if (data.notes !== undefined) update.notes = data.notes;

    await Participant.updateOne({ _id: participant._id }, { $set: update });
    return await this.getParticipantById(cleanId);
  },

  // Delete participant
  async deleteParticipant(id) {
    const cleanId = (id || '').trim();
    const participant = await this.getParticipantById(cleanId);
    if (!participant) return { deletedCount: 0 };

    await MealClaim.deleteMany({
      participant_id: { $in: [cleanId, cleanId.toUpperCase(), participant.barcode, participant.id] }
    });
    return await Participant.deleteOne({ _id: participant._id });
  },

  // Get participants with search and meal count
  async getParticipants(search = '', limit = 200, offset = 0) {
    let query = {};
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      query = {
        $or: [
          { barcode: regex },
          { id: regex },
          { registrationId: regex },
          { teamId: regex },
          { name: regex },
          { team_name: regex },
          { teamName: regex },
          { college: regex },
          { phone: regex },
          { email: regex }
        ]
      };
    }
    const participants = await Participant.find(query)
      .sort({ createdAt: -1, created_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const candidateIds = [];
    participants.forEach(p => {
      if (p.id) candidateIds.push(p.id);
      if (p.barcode) candidateIds.push(p.barcode);
      if (p.registrationId) candidateIds.push(p.registrationId);
    });

    const mealCounts = await MealClaim.aggregate([
      { $match: { participant_id: { $in: candidateIds } } },
      { $group: { _id: '$participant_id', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    mealCounts.forEach(m => { countMap[m._id] = m.count; });

    return participants.map(p => {
      const norm = normalizeParticipant(p);
      const extraServings = Array.isArray(p.foodServings) ? p.foodServings.length : 0;
      const directClaims = (countMap[norm.id] || 0) || (norm.barcode ? (countMap[norm.barcode] || 0) : 0);
      return {
        ...norm,
        total_meals_taken: Math.max(directClaims, extraServings)
      };
    });
  },

  // Get live statistics for active session
  async getActiveSessionStats() {
    const activeSession = await this.getActiveSession();
    const totalParticipants = await Participant.countDocuments();

    if (!activeSession) {
      return {
        session: null,
        total_target: 0,
        claimed_count: 0,
        remaining_count: 0,
        veg_claimed: 0,
        non_veg_claimed: 0,
        total_participants: totalParticipants,
        counters: {},
        hourly_velocity: [],
        recent_claims: []
      };
    }

    const sessionId = activeSession.id;
    const claims = await MealClaim.find({ session_id: sessionId }).sort({ claimed_at: -1 }).lean();
    const totalClaims = claims.length;

    // Get participant details for diet counts and recent claims
    const pIds = [...new Set(claims.map(c => c.participant_id))];
    const participants = await Participant.find({
      $or: [
        { barcode: { $in: pIds } },
        { id: { $in: pIds } },
        { registrationId: { $in: pIds } }
      ]
    }).lean();

    const pMap = {};
    participants.forEach(p => {
      const norm = normalizeParticipant(p);
      pMap[norm.id] = norm;
      if (norm.barcode) pMap[norm.barcode] = norm;
      if (norm.registrationId) pMap[norm.registrationId] = norm;
    });

    let vegClaimed = 0;
    let nonVegClaimed = 0;
    const counterMap = {};

    claims.forEach(c => {
      // Counter counts
      counterMap[c.counter_id] = (counterMap[c.counter_id] || 0) + 1;

      // Diet breakdown
      const p = pMap[c.participant_id];
      const diet = (p?.diet_pref || '').toLowerCase();
      if (diet === 'veg') vegClaimed++;
      else if (diet.includes('non')) nonVegClaimed++;
      else vegClaimed++; // default
    });

    // Recent claims (last 50)
    const recentClaims = claims.slice(0, 50).map(c => {
      const p = pMap[c.participant_id];
      return {
        claim_id: c.claim_id,
        session_id: c.session_id,
        participant_id: c.participant_id,
        counter_id: c.counter_id,
        volunteer_name: c.volunteer_name,
        claimed_at: c.claimed_at,
        participant_name: p?.name || '',
        college: p?.college || '',
        team_name: p?.team_name || p?.teamName || '',
        diet_pref: p?.diet_pref || 'Veg',
        meal_name: activeSession.name
      };
    });

    // Hourly velocity
    const hourMap = {};
    claims.forEach(c => {
      const d = new Date(c.claimed_at);
      const hourStr = String(d.getHours()).padStart(2, '0') + ':00';
      hourMap[hourStr] = (hourMap[hourStr] || 0) + 1;
    });
    const hourlyVelocity = Object.keys(hourMap).sort().map(hour => ({
      hour,
      count: hourMap[hour]
    }));

    return {
      session: activeSession,
      total_target: activeSession.total_target,
      claimed_count: totalClaims,
      remaining_count: Math.max(0, activeSession.total_target - totalClaims),
      veg_claimed: vegClaimed,
      non_veg_claimed: nonVegClaimed,
      total_participants: totalParticipants,
      counters: counterMap,
      hourly_velocity: hourlyVelocity,
      recent_claims: recentClaims
    };
  },

  // Full export of claims for CSV report
  async getAllClaimsReport(sessionId = null) {
    const filter = {};
    if (sessionId) filter.session_id = parseInt(sessionId);
    const claims = await MealClaim.find(filter).sort({ claimed_at: -1 }).lean();

    const pIds = [...new Set(claims.map(c => c.participant_id))];
    const sIds = [...new Set(claims.map(c => c.session_id))];

    const [participants, sessions] = await Promise.all([
      Participant.find({
        $or: [
          { barcode: { $in: pIds } },
          { id: { $in: pIds } },
          { registrationId: { $in: pIds } }
        ]
      }).lean(),
      MealSession.find({ id: { $in: sIds } }).lean()
    ]);

    const pMap = {};
    participants.forEach(p => {
      const norm = normalizeParticipant(p);
      pMap[norm.id] = norm;
      if (norm.barcode) pMap[norm.barcode] = norm;
      if (norm.registrationId) pMap[norm.registrationId] = norm;
    });

    const sMap = {};
    sessions.forEach(s => { sMap[s.id] = s; });

    return claims.map(c => {
      const p = pMap[c.participant_id];
      const s = sMap[c.session_id];
      return {
        claim_id: c.claim_id,
        session_name: s?.name || '',
        session_date: s?.date || '',
        participant_id: c.participant_id,
        participant_name: p?.name || '',
        email: p?.email || '',
        phone: p?.phone || '',
        college: p?.college || '',
        team_name: p?.team_name || p?.teamName || '',
        diet_pref: p?.diet_pref || '',
        is_manual_entry: p?.is_manual_entry || 0,
        counter_id: c.counter_id,
        volunteer_name: c.volunteer_name,
        claimed_at: c.claimed_at
      };
    });
  },

  // Reset meal claims
  async resetClaims(sessionId = null) {
    if (sessionId) {
      return await MealClaim.deleteMany({ session_id: parseInt(sessionId) });
    }
    return await MealClaim.deleteMany({});
  }
};

module.exports = {
  mongoose,
  initDb,
  dbQueries,
  MealSession,
  Participant,
  MealClaim
};
