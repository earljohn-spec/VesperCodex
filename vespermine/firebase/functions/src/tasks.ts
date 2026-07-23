import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Task rewards in satoshi
const TASK_REWARDS: Record<string, number> = {
  daily_checkin: 100,
  watch_ad: 50,
  survey_basic: 200,
  refer_friend: 500,
  social_share: 150,
};

const STREAK_REWARDS: Record<string, { threshold: number; bonus: number }> = {
  streak_3: { threshold: 3, bonus: 300 },
  streak_7: { threshold: 7, bonus: 1000 },
  streak_30: { threshold: 30, bonus: 5000 },
};

/**
 * Called when a user completes a task
 */
export const onTaskComplete = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  
  const uid = context.auth.uid;
  const { taskId, taskType } = data;
  
  if (!taskId || !taskType) {
    throw new functions.https.HttpsError('invalid-argument', 'Task ID and type required');
  }
  
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }
  
  const userData = userDoc.data()!;
  
  // Handle special task types
  if (taskType === 'daily_checkin') {
    return await handleDailyCheckIn(uid, userData, userRef);
  }
  
  if (taskType === 'watch_ad') {
    return await handleWatchAd(uid, userData, userRef);
  }
  
  // Check if task can be completed
  const rewardSatoshi = TASK_REWARDS[taskId] || TASK_REWARDS[taskType] || 0;
  
  if (rewardSatoshi === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid task');
  }
  
  const rewardBtc = rewardSatoshi / 1e8;
  
  // Update user
  const batch = db.batch();
  
  batch.update(userRef, {
    currentBalance: admin.firestore.FieldValue.increment(rewardBtc),
    totalEarned: admin.firestore.FieldValue.increment(rewardBtc),
    totalTasksCompleted: admin.firestore.FieldValue.increment(1),
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  // Record task completion
  batch.set(
    db.collection('users').doc(uid).collection('taskCompletions').doc(),
    {
      userId: uid,
      taskId,
      taskType,
      rewardSatoshi,
      rewardBtc,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
  );
  
  // Create transaction
  batch.set(
    db.collection('users').doc(uid).collection('transactions').doc(),
    {
      type: 'task',
      amountBtc: rewardBtc,
      description: `Task: ${taskId}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
    }
  );
  
  await batch.commit();
  
  functions.logger.info(`Task ${taskId} completed by ${uid}: ${rewardSatoshi} sats`);
  
  return { rewardSatoshi, rewardBtc };
});

/**
 * Handle daily check-in with streak tracking
 */
async function handleDailyCheckIn(
  uid: string,
  userData: any,
  userRef: admin.firestore.DocumentReference
): Promise<{ rewardSatoshi: number; streak: number }> {
  const REWARD = 100; // satoshi
  const lastCheckIn = userData.lastCheckIn?.toDate();
  const now = new Date();
  
  // Check if already checked in today
  if (lastCheckIn) {
    const sameDay = lastCheckIn.toDateString() === now.toDateString();
    if (sameDay) {
      throw new functions.https.HttpsError('already-exists', 'Already checked in today');
    }
  }
  
  // Calculate streak
  let streak = userData.currentStreak || 0;
  if (lastCheckIn) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = lastCheckIn.toDateString() === yesterday.toDateString();
    
    if (!wasYesterday) {
      streak = 0; // Reset streak
    }
  }
  streak += 1;
  
  // Apply streak bonus
  let bonusReward = 0;
  if (streak === 7) bonusReward = 1000;
  else if (streak === 14) bonusReward = 2000;
  else if (streak === 30) bonusReward = 5000;
  
  const totalRewardSatoshi = REWARD + bonusReward;
  const totalRewardBtc = totalRewardSatoshi / 1e8;
  
  const batch = db.batch();
  
  batch.update(userRef, {
    currentBalance: admin.firestore.FieldValue.increment(totalRewardBtc),
    totalEarned: admin.firestore.FieldValue.increment(totalRewardBtc),
    currentStreak: streak,
    lastCheckIn: admin.firestore.FieldValue.serverTimestamp(),
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  batch.set(
    db.collection('users').doc(uid).collection('transactions').doc(),
    {
      type: bonusReward > 0 ? 'streak_bonus' : 'checkin',
      amountBtc: totalRewardBtc,
      description: bonusReward > 0 ? `${streak}-day streak bonus!` : 'Daily check-in',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
    }
  );
  
  await batch.commit();
  
  functions.logger.info(`Daily check-in by ${uid}: streak=${streak}, reward=${totalRewardSatoshi} sats`);
  
  return { rewardSatoshi: totalRewardSatoshi, streak };
}

/**
 * Handle watching an ad (rate limited)
 */
async function handleWatchAd(
  uid: string,
  userData: any,
  userRef: admin.firestore.DocumentReference
): Promise<{ rewardSatoshi: number }> {
  const REWARD = 50;
  const MAX_DAILY_ADS = 10;
  
  // Check daily ad limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const adsToday = await db.collection('users').doc(uid)
    .collection('taskCompletions')
    .where('taskType', '==', 'watch_ad')
    .where('completedAt', '>=', today)
    .count()
    .get();
  
  if (adsToday.data().count >= MAX_DAILY_ADS) {
    throw new functions.https.HttpsError('resource-exhausted', 'Daily ad limit reached');
  }
  
  const rewardBtc = REWARD / 1e8;
  
  const batch = db.batch();
  
  batch.update(userRef, {
    currentBalance: admin.firestore.FieldValue.increment(rewardBtc),
    totalEarned: admin.firestore.FieldValue.increment(rewardBtc),
    totalTasksCompleted: admin.firestore.FieldValue.increment(1),
  });
  
  batch.set(
    db.collection('users').doc(uid).collection('taskCompletions').doc(),
    {
      userId: uid,
      taskId: 'watch_ad',
      taskType: 'watch_ad',
      rewardSatoshi: REWARD,
      rewardBtc,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
  );
  
  await batch.commit();
  
  return { rewardSatoshi: REWARD };
}

/**
 * Scheduled daily reset - resets daily task limits at midnight UTC
 */
export const onDailyReset = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    functions.logger.info('Running daily task reset');
    
    // Daily reset is handled client-side by checking dates
    // This function could send push notifications reminding users to check in
    
    const snapshot = await db.collection('users')
      .where('currentStreak', '>', 0)
      .get();
    
    // Check for users who broke their streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2); // Day before yesterday
    const batch = db.batch();
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const lastCheckIn = data.lastCheckIn?.toDate();
      
      if (lastCheckIn && lastCheckIn < yesterday) {
        // Streak broken
        batch.update(doc.ref, {
          currentStreak: 0,
        });
        functions.logger.info(`Streak reset for user ${doc.id}`);
      }
    });
    
    await batch.commit();
    functions.logger.info('Daily reset complete');
  });
