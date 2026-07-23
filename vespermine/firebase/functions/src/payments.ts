import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Subscription tier configurations
const SUBSCRIPTION_TIERS: Record<string, { hashRate: number; withdrawalFee: number; price: number }> = {
  free: { hashRate: 10, withdrawalFee: 0.02, price: 0 },
  starter: { hashRate: 50, withdrawalFee: 0.015, price: 4.99 },
  pro: { hashRate: 200, withdrawalFee: 0.01, price: 14.99 },
  elite: { hashRate: 500, withdrawalFee: 0, price: 29.99 },
};

/**
 * Called when a subscription is purchased or changed
 * In production, this would be triggered by RevenueCat/Stripe webhook
 */
export const onSubscriptionChange = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  
  const uid = context.auth.uid;
  const { tier, action } = data;
  
  if (!tier || !SUBSCRIPTION_TIERS[tier]) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid subscription tier');
  }
  
  const userRef = db.collection('users').doc(uid);
  
  // In production: verify payment with RevenueCat/Stripe before applying
  await userRef.update({
    subscriptionTier: tier,
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  // If upgrading, log the transaction
  if (action === 'upgrade') {
    await db.collection('users').doc(uid).collection('transactions').add({
      type: 'subscription',
      amountBtc: 0,
      description: `Upgraded to ${tier.toUpperCase()} plan`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
      metadata: {
        tier,
        price: SUBSCRIPTION_TIERS[tier].price,
        action: 'upgrade',
      },
    });
  }
  
  functions.logger.info(`Subscription changed for ${uid}: tier=${tier}, action=${action}`);
  
  return {
    tier,
    hashRate: SUBSCRIPTION_TIERS[tier].hashRate,
    withdrawalFee: SUBSCRIPTION_TIERS[tier].withdrawalFee,
  };
});

/**
 * Process a withdrawal request
 * Creates a pending withdrawal that an admin can approve
 */
export const processWithdrawal = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  
  const uid = context.auth.uid;
  const { amountBtc, destinationAddress } = data;
  
  if (!amountBtc || !destinationAddress) {
    throw new functions.https.HttpsError('invalid-argument', 'Amount and address required');
  }
  
  // Validate minimum withdrawal (10,000 sats = 0.0001 BTC)
  const MIN_WITHDRAWAL = 0.0001;
  if (amountBtc < MIN_WITHDRAWAL) {
    throw new functions.https.HttpsError('failed-precondition', 
      `Minimum withdrawal is ${MIN_WITHDRAWAL} BTC (${MIN_WITHDRAWAL * 1e8} sats)`);
  }
  
  // Validate Bitcoin address format (basic)
  const btcAddressRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
  if (!btcAddressRegex.test(destinationAddress)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid Bitcoin address');
  }
  
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }
  
  const userData = userDoc.data()!;
  const tier = userData.subscriptionTier || 'free';
  const feeRate = SUBSCRIPTION_TIERS[tier].withdrawalFee;
  
  // Check sufficient balance
  if (userData.currentBalance < amountBtc) {
    throw new functions.https.HttpsError('failed-precondition', 'Insufficient balance');
  }
  
  // Calculate fee
  const fee = amountBtc * feeRate;
  const netAmount = amountBtc - fee;
  
  // Create withdrawal transaction
  const withdrawalRef = await db.collection('users').doc(uid)
    .collection('transactions').add({
      type: 'withdrawal',
      amountBtc: netAmount,
      feeBtc: fee,
      feeRate,
      description: `Withdrawal to ${destinationAddress.substring(0, 12)}...`,
      destinationAddress,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending',
    });
  
  // Deduct from user balance
  await userRef.update({
    currentBalance: admin.firestore.FieldValue.increment(-amountBtc),
  });
  
  functions.logger.info(`Withdrawal created for ${uid}: ${amountBtc} BTC, fee: ${fee} BTC, net: ${netAmount} BTC`);
  
  return {
    transactionId: withdrawalRef.id,
    amountBtc: netAmount,
    feeBtc: fee,
    status: 'pending',
  };
});

/**
 * Webhook handler for RevenueCat subscription events
 * In production, this endpoint receives webhook notifications
 */
export const revenuecatWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  
  const event = req.body;
  const { event_type, user_id, product_id } = event;
  
  functions.logger.info(`RevenueCat webhook: ${event_type} for user ${user_id}`);
  
  // Map RevenueCat product to our tiers
  const tierMap: Record<string, string> = {
    'starter_monthly': 'starter',
    'pro_monthly': 'pro',
    'elite_monthly': 'elite',
  };
  
  const tier = tierMap[product_id];
  
  if (!tier) {
    functions.logger.warn(`Unknown product: ${product_id}`);
    res.status(200).send('OK');
    return;
  }
  
  try {
    switch (event_type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        await db.collection('users').doc(user_id).update({
          subscriptionTier: tier,
        });
        break;
      
      case 'CANCELLATION':
      case 'EXPIRATION':
        await db.collection('users').doc(user_id).update({
          subscriptionTier: 'free',
        });
        break;
    }
    
    res.status(200).send('OK');
  } catch (error) {
    functions.logger.error('Webhook processing error', error);
    res.status(500).send('Error');
  }
});
