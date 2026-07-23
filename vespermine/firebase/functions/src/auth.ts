import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Triggered when a new user signs up
 * Creates their user document in Firestore
 */
export const onAuthCreate = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  const email = user.email || '';
  const displayName = user.displayName || email.split('@')[0];
  
  // Generate referral code
  const referralCode = 'VM' + uid.substring(0, 6).toUpperCase();
  
  const userDoc = {
    uid,
    email,
    displayName,
    avatarUrl: null,
    referralCode,
    referredBy: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    emailVerified: user.emailVerified || false,
    totalEarned: 0,
    currentBalance: 0,
    currentStreak: 0,
    subscriptionTier: 'free',
    totalReferrals: 0,
    totalTasksCompleted: 0,
    miningHoursTotal: 0,
    lastCheckIn: null,
  };

  try {
    await db.collection('users').doc(uid).set(userDoc);
    
    functions.logger.info(`Created user document for ${uid}`);
    
    // Check if referred by someone
    const customClaims = user.customClaims;
    if (customClaims && customClaims.referredBy) {
      await processReferral(uid, customClaims.referredBy as string);
    }
    
    return { success: true };
  } catch (error) {
    functions.logger.error(`Failed to create user document for ${uid}`, error);
    throw error;
  }
});

/**
 * Process referral bonus when a new user signs up with a referral code
 */
async function processReferral(newUserId: string, referrerCode: string): Promise<void> {
  const REFERRAL_BONUS_SATS = 500;
  const referrerRef = db.collection('users')
    .where('referralCode', '==', referrerCode)
    .limit(1);
  
  const snapshot = await referrerRef.get();
  
  if (snapshot.empty) {
    functions.logger.warn(`Referral code ${referrerCode} not found`);
    return;
  }
  
  const referrerDoc = snapshot.docs[0];
  const referrerId = referrerDoc.id;
  
  // Update new user's referredBy
  await db.collection('users').doc(newUserId).update({
    referredBy: referrerId,
  });
  
  // Update referrer's stats
  const batch = db.batch();
  
  batch.update(db.collection('users').doc(referrerId), {
    totalReferrals: admin.firestore.FieldValue.increment(1),
    currentBalance: admin.firestore.FieldValue.increment(REFERRAL_BONUS_SATS / 1e8),
    totalEarned: admin.firestore.FieldValue.increment(REFERRAL_BONUS_SATS / 1e8),
  });
  
  // Create referral transaction
  batch.set(
    db.collection('users').doc(referrerId).collection('transactions').doc(),
    {
      type: 'referral',
      amountBtc: REFERRAL_BONUS_SATS / 1e8,
      description: `Referred ${newUserId}`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
    }
  );
  
  // Store referral record
  batch.set(
    db.collection('referrals').doc(referrerCode),
    {
      referrerId,
      referredUserId: newUserId,
      bonusSatoshi: REFERRAL_BONUS_SATS,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  
  await batch.commit();
  functions.logger.info(`Referral bonus ${REFERRAL_BONUS_SATS} sats given to ${referrerId}`);
}
