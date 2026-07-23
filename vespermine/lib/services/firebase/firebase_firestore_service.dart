import 'package:cloud_firestore/cloud_firestore.dart';
import '../../models/mining_session.dart';
import '../../models/wallet.dart';
import '../../models/earnings.dart';

/// Firestore service for data operations
/// Handles reading/writing to Firestore collections
class FirestoreService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // ============= USERS =============

  /// Get user data
  Future<DocumentSnapshot> getUser(String userId) {
    return _firestore.collection('users').doc(userId).get();
  }

  /// Listen to user data changes
  Stream<DocumentSnapshot> userStream(String userId) {
    return _firestore.collection('users').doc(userId).snapshots();
  }

  /// Update user's last active timestamp
  Future<void> updateLastActive(String userId) {
    return _firestore.collection('users').doc(userId).update({
      'lastActiveAt': FieldValue.serverTimestamp(),
    });
  }

  // ============= MINING SESSIONS =============

  /// Get active mining session for user
  Future<QuerySnapshot> getActiveSession(String userId) {
    return _firestore
        .collection('users')
        .doc(userId)
        .collection('miningSessions')
        .where('status', '==', 'active')
        .limit(1)
        .get();
  }

  /// Get mining session history
  Stream<QuerySnapshot> getMiningSessions(String userId, {int limit = 50}) {
    return _firestore
        .collection('users')
        .doc(userId)
        .collection('miningSessions')
        .orderBy('startTime', descending: true)
        .limit(limit)
        .snapshots();
  }

  /// Listen to active mining session
  Stream<QuerySnapshot> activeSessionStream(String userId) {
    return _firestore
        .collection('users')
        .doc(userId)
        .collection('miningSessions')
        .where('status', '==', 'active')
        .limit(1)
        .snapshots();
  }

  // ============= TRANSACTIONS =============

  /// Get transaction history
  Stream<QuerySnapshot> getTransactions(String userId, {int limit = 50}) {
    return _firestore
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .orderBy('timestamp', descending: true)
        .limit(limit)
        .snapshots();
  }

  /// Get recent transactions
  Future<List<TransactionModel>> getRecentTransactions(String userId, {int limit = 10}) async {
    final snapshot = await _firestore
        .collection('users')
        .doc(userId)
        .collection('transactions')
        .orderBy('timestamp', descending: true)
        .limit(limit)
        .get();

    return snapshot.docs.map((doc) {
      final data = doc.data();
      return TransactionModel(
        transactionId: doc.id,
        walletId: 'ledger_$userId',
        type: _parseTransactionType(data['type'] as String),
        amountBtc: (data['amountBtc'] as num).toDouble(),
        amountUsd: 0, // Calculate from price
        feeBtc: data['feeBtc'] != null ? (data['feeBtc'] as num).toDouble() : null,
        status: _parseTransactionStatus(data['status'] as String),
        description: data['description'] as String?,
        timestamp: (data['timestamp'] as Timestamp).toDate(),
      );
    }).toList();
  }

  // ============= TASK COMPLETIONS =============

  /// Get today's task completions
  Future<QuerySnapshot> getTodayCompletions(String userId) {
    final startOfDay = DateTime.now();
    startOfDay.subtract(Duration(
      hours: startOfDay.hour,
      minutes: startOfDay.minute,
      seconds: startOfDay.second,
    ));

    return _firestore
        .collection('users')
        .doc(userId)
        .collection('taskCompletions')
        .where('completedAt', isGreaterThanOrEqualTo: Timestamp.fromDate(startOfDay))
        .get();
  }

  /// Get task completions count for today by type
  Future<int> getTodayCompletionCount(String userId, String taskType) async {
    final startOfDay = DateTime.now();
    startOfDay.subtract(Duration(
      hours: startOfDay.hour,
      minutes: startOfDay.minute,
      seconds: startOfDay.second,
    ));

    final snapshot = await _firestore
        .collection('users')
        .doc(userId)
        .collection('taskCompletions')
        .where('taskType', '==', taskType)
        .where('completedAt', isGreaterThanOrEqualTo: Timestamp.fromDate(startOfDay))
        .count()
        .get();

    return snapshot.count;
  }

  // ============= BITCOIN PRICE =============

  /// Get current Bitcoin price from Firestore
  Future<double> getBitcoinPrice() async {
    final doc = await _firestore.collection('config').doc('bitcoin_price').get();
    if (doc.exists) {
      return (doc.data()!['price'] as num).toDouble();
    }
    return 67500.0; // Fallback price
  }

  /// Listen to Bitcoin price changes
  Stream<double> bitcoinPriceStream() {
    return _firestore.collection('config').doc('bitcoin_price').snapshots().map((doc) {
      if (doc.exists && doc.data() != null) {
        return (doc.data()!['price'] as num).toDouble();
      }
      return 67500.0;
    });
  }

  // ============= REFERRALS =============

  /// Get referral data by code
  Future<DocumentSnapshot> getReferralByCode(String code) {
    return _firestore
        .collection('users')
        .where('referralCode', '==', code)
        .limit(1)
        .get()
        .then((snapshot) => snapshot.docs.first);
  }

  // ============= HELPER METHODS =============

  TransactionType _parseTransactionType(String type) {
    switch (type) {
      case 'mining': return TransactionType.miningReward;
      case 'task': return TransactionType.taskReward;
      case 'referral': return TransactionType.referralBonus;
      case 'deposit': return TransactionType.deposit;
      case 'withdrawal': return TransactionType.withdrawal;
      case 'commission': return TransactionType.commission;
      default: return TransactionType.taskReward;
    }
  }

  TransactionStatus _parseTransactionStatus(String status) {
    switch (status) {
      case 'pending': return TransactionStatus.pending;
      case 'completed': return TransactionStatus.completed;
      case 'failed': return TransactionStatus.failed;
      case 'cancelled': return TransactionStatus.cancelled;
      default: return TransactionStatus.completed;
    }
  }
}
