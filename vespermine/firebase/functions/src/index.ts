import * as admin from 'firebase-admin';
import { onAuthCreate } from './auth';
import { onMiningStart, onMiningStop, calculateMiningEarnings } from './mining';
import { onTaskComplete, onDailyReset } from './tasks';
import { onSubscriptionChange, processWithdrawal } from './payments';
import { updateBitcoinPrice } from './price';

// Initialize Firebase Admin
admin.initializeApp();

// ============= AUTH TRIGGERS =============
export { onAuthCreate };

// ============= MINING =============
export { onMiningStart, onMiningStop, calculateMiningEarnings };

// ============= TASKS =============
export { onTaskComplete, onDailyReset };

// ============= PAYMENTS =============
export { onSubscriptionChange, processWithdrawal };

// ============= SCHEDULED FUNCTIONS =============
export { updateBitcoinPrice };
