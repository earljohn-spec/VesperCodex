import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Mining constants
const HASH_RATES: Record<string, number> = {
  free: 10,
  starter: 50,
  pro: 200,
  elite: 500,
};

const SATOSHI_PER_HASH = 0.00000001;

/**
 * Called when user starts a mining session
 * Creates a new mining session document
 */
export const onMiningStart = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  
  const uid = context.auth.uid;
  const userDoc = await db.collection('users').doc(uid).get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }
  
  const userData = userDoc.data()!;
  const subscriptionTier = userData.subscriptionTier || 'free';
  const hashRate = HASH_RATES[subscriptionTier] || 10;
  
  // Check if there's already an active session
  const activeSessions = await db.collection('users').doc(uid)
    .collection('miningSessions')
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (!activeSessions.empty) {
    throw new functions.https.HttpsError('already-exists', 'Mining session already active');
  }
  
  const sessionRef = db.collection('users').doc(uid)
    .collection('miningSessions').doc();
  
  const sessionData = {
    sessionId: sessionRef.id,
    userId: uid,
    startTime: admin.firestore.FieldValue.serverTimestamp(),
    endTime: null,
    hashRate,
    status: 'active',
    btcEarned: 0,
    sharesCompleted: 0,
    powerConsumption: hashRate * 0.5,
    tierName: subscriptionTier,
  };
  
  await sessionRef.set(sessionData);
  
  // Update user's last active timestamp
  await db.collection('users').doc(uid).update({
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  functions.logger.info(`Mining session started for ${uid} at ${hashRate} MH/s`);
  
  return {
    sessionId: sessionRef.id,
    hashRate,
    tier: subscriptionTier,
  };
});

/**
 * Called when user stops mining
 * Calculates final earnings and updates balance
 */
export const onMiningStop = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  
  const uid = context.auth.uid;
  const { sessionId } = data;
  
  if (!sessionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Session ID required');
  }
  
  const sessionRef = db.collection('users').doc(uid)
    .collection('miningSessions').doc(sessionId);
  
  const sessionDoc = await sessionRef.get();
  
  if (!sessionDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Session not found');
  }
  
  const sessionData = sessionDoc.data()!;
  
  if (sessionData.status !== 'active') {
    throw new functions.https.HttpsError('failed-precondition', 'Session not active');
  }
  
  // Calculate earnings
  const startTime = sessionData.startTime.toDate();
  const endTime = new Date();
  const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
  const btcEarned = calculateMiningEarnings(sessionData.hashRate, durationSeconds);
  
  // Update session
  await sessionRef.update({
    status: 'completed',
    endTime: admin.firestore.FieldValue.serverTimestamp(),
    btcEarned,
  });
  
  // Update user balance
  await db.collection('users').doc(uid).update({
    currentBalance: admin.firestore.FieldValue.increment(btcEarned),
    totalEarned: admin.firestore.FieldValue.increment(btcEarned),
    miningHoursTotal: admin.firestore.FieldValue.increment(Math.floor(durationSeconds / 3600)),
  });
  
  // Create transaction record
  await db.collection('users').doc(uid).collection('transactions').add({
    type: 'mining',
    amountBtc: btcEarned,
    description: `Cloud mining session - ${Math.floor(durationSeconds / 60)} minutes`,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    status: 'completed',
    sessionId,
  });
  
  functions.logger.info(`Mining stopped for ${uid}: ${btcEarned.toFixed(8)} BTC earned in ${durationSeconds}s`);
  
  return {
    btcEarned,
    duration: durationSeconds,
  };
});

/**
 * Calculate mining earnings based on hash rate and duration
 */
export function calculateMiningEarnings(hashRate: number, durationSeconds: number): number {
  const hashes = hashRate * 1e6 * durationSeconds;
  return hashes * SATOSHI_PER_HASH;
}

/**
 * Scheduled function to update mining session stats every 5 minutes
 * Simulates shares and updates earnings
 */
export const updateMiningSessions = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const activeSessions = await db.collectionGroup('miningSessions')
      .where('status', '==', 'active')
      .get();
    
    const batch = db.batch();
    
    activeSessions.forEach((doc) => {
      const data = doc.data();
      const startTime = data.startTime.toDate();
      const now = new Date();
      const durationSeconds = (now.getTime() - startTime.getTime()) / 1000;
      const currentEarnings = calculateMiningEarnings(data.hashRate, durationSeconds);
      
      // Update share count (1 share per 30 seconds)
      const expectedShares = Math.floor(durationSeconds / 30);
      
      batch.update(doc.ref, {
        btcEarned: currentEarnings,
        sharesCompleted: expectedShares,
      });
    });
    
    await batch.commit();
    functions.logger.info(`Updated ${activeSessions.size} active mining sessions`);
  });
