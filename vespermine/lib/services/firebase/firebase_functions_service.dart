import 'package:cloud_functions/cloud_functions.dart';
import '../auth_service.dart';

/// Cloud Functions callable service
/// Wraps all Cloud Function calls from the Flutter app
class CloudFunctionsService {
  final FirebaseFunctions _functions;

  CloudFunctionsService({FirebaseFunctions? functions})
      : _functions = functions ?? FirebaseFunctions.instance;

  // ============= MINING =============

  /// Start a mining session via Cloud Function
  Future<Map<String, dynamic>> startMining() async {
    try {
      final result = await _functions
          .httpsCallable('onMiningStart')
          .call(<String, dynamic>{});
      return Map<String, dynamic>.from(result.data as Map);
    } on FirebaseFunctionsException catch (e) {
      throw Exception(e.message ?? 'Failed to start mining');
    }
  }

  /// Stop a mining session via Cloud Function
  Future<Map<String, dynamic>> stopMining(String sessionId) async {
    try {
      final result = await _functions
          .httpsCallable('onMiningStop')
          .call(<String, dynamic>{'sessionId': sessionId});
      return Map<String, dynamic>.from(result.data as Map);
    } on FirebaseFunctionsException catch (e) {
      throw Exception(e.message ?? 'Failed to stop mining');
    }
  }

  // ============= TASKS =============

  /// Complete a task via Cloud Function
  Future<Map<String, dynamic>> completeTask(String taskId, String taskType) async {
    try {
      final result = await _functions
          .httpsCallable('onTaskComplete')
          .call(<String, dynamic>{
        'taskId': taskId,
        'taskType': taskType,
      });
      return Map<String, dynamic>.from(result.data as Map);
    } on FirebaseFunctionsException catch (e) {
      throw Exception(e.message ?? 'Failed to complete task');
    }
  }

  // ============= PAYMENTS =============

  /// Change subscription tier via Cloud Function
  Future<Map<String, dynamic>> changeSubscription(String tier, String action) async {
    try {
      final result = await _functions
          .httpsCallable('onSubscriptionChange')
          .call(<String, dynamic>{
        'tier': tier,
        'action': action,
      });
      return Map<String, dynamic>.from(result.data as Map);
    } on FirebaseFunctionsException catch (e) {
      throw Exception(e.message ?? 'Failed to change subscription');
    }
  }

  /// Process a withdrawal via Cloud Function
  Future<Map<String, dynamic>> processWithdrawal({
    required double amountBtc,
    required String destinationAddress,
  }) async {
    try {
      final result = await _functions
          .httpsCallable('processWithdrawal')
          .call(<String, dynamic>{
        'amountBtc': amountBtc,
        'destinationAddress': destinationAddress,
      });
      return Map<String, dynamic>.from(result.data as Map);
    } on FirebaseFunctionsException catch (e) {
      throw Exception(e.message ?? 'Failed to process withdrawal');
    }
  }
}

/// Provides a mock version for development without Firebase
class MockCloudFunctionsService extends CloudFunctionsService {
  MockCloudFunctionsService() : super(functions: null);

  @override
  Future<Map<String, dynamic>> startMining() async {
    await Future.delayed(const Duration(seconds: 1));
    return {
      'sessionId': 'mock_session_${DateTime.now().millisecondsSinceEpoch}',
      'hashRate': 10.0,
      'tier': 'free',
    };
  }

  @override
  Future<Map<String, dynamic>> stopMining(String sessionId) async {
    await Future.delayed(const Duration(milliseconds: 500));
    return {
      'btcEarned': 0.00001234,
      'duration': 3600.0,
    };
  }

  @override
  Future<Map<String, dynamic>> completeTask(String taskId, String taskType) async {
    await Future.delayed(const Duration(seconds: 1));
    final rewards = <String, int>{
      'daily_checkin': 100,
      'watch_ad': 50,
      'survey_basic': 200,
      'social_share': 150,
    };
    final reward = rewards[taskType] ?? 100;
    return {
      'rewardSatoshi': reward,
      'rewardBtc': reward / 1e8,
    };
  }

  @override
  Future<Map<String, dynamic>> changeSubscription(String tier, String action) async {
    await Future.delayed(const Duration(milliseconds: 500));
    return {
      'tier': tier,
      'hashRate': {'starter': 50, 'pro': 200, 'elite': 500}[tier] ?? 10,
      'withdrawalFee': {'starter': 0.015, 'pro': 0.01, 'elite': 0.0}[tier] ?? 0.02,
    };
  }

  @override
  Future<Map<String, dynamic>> processWithdrawal({
    required double amountBtc,
    required String destinationAddress,
  }) async {
    await Future.delayed(const Duration(seconds: 1));
    final fee = amountBtc * 0.02;
    return {
      'transactionId': 'mock_tx_${DateTime.now().millisecondsSinceEpoch}',
      'amountBtc': amountBtc - fee,
      'feeBtc': fee,
      'status': 'pending',
    };
  }
}
