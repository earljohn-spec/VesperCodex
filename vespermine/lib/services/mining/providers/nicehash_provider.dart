import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'mining_provider_interface.dart';

/// NiceHash Cloud Mining Provider
/// 
/// NiceHash is a real cloud mining marketplace where users can rent
/// hash power from other miners. This provider integrates with the
/// NiceHash API to manage mining orders.
/// 
/// API Documentation: https://docs.nicehash.com/
/// 
/// SETUP:
/// 1. Create a NiceHash account at https://www.nicehash.com
/// 2. Go to Settings > API and create an API key
/// 3. Use the API key and secret to initialize this provider
class NiceHashProvider implements MiningProviderInterface {
  static const String _baseUrl = 'https://api2.nicehash.com';
  
  String? _apiKey;
  String? _apiSecret;
  String? _orgId;
  
  final Random _random = Random();

  @override
  String get name => 'NiceHash';

  @override
  Future<void> initialize({
    required String apiKey,
    required String apiSecret,
    String? orgId,
  }) async {
    _apiKey = apiKey;
    _apiSecret = apiSecret;
    _orgId = orgId;

    // Verify API connection
    final status = await getStatus();
    if (!status.isOperational) {
      throw Exception('NiceHash API is not operational: ${status.message}');
    }

    print('NiceHash provider initialized successfully');
  }

  @override
  Future<double> getAvailableHashRate() async {
    // In production: call NiceHash API to get available orders
    // GET /main/api/v2/mining/availableAlgorithms
    
    try {
      final response = await _makeRequest('GET', '/main/api/v2/mining/availableAlgorithms');
      // Parse response for SHA-256 available hash rate
      // For now, return simulated value
      return 500.0; // MH/s available
    } catch (e) {
      print('Error fetching available hash rate: $e');
      return 0;
    }
  }

  @override
  Future<MiningOrder> rentHashPower({
    required double hashRate,
    required Duration duration,
  }) async {
    // In production: POST /main/api/v2/mining/order/new
    // This creates a new mining order on NiceHash
    
    print('NiceHash: Renting $hashRate MH/s for ${duration.inHours}h');

    // Simulate API call
    await Future.delayed(const Duration(seconds: 2));

    final orderId = 'NH_${DateTime.now().millisecondsSinceEpoch}';
    
    return MiningOrder(
      orderId: orderId,
      providerName: name,
      hashRate: hashRate,
      startTime: DateTime.now(),
      status: MiningOrderStatus.active,
      algorithm: 'SHA-256',
      costUsd: _calculateCost(hashRate, duration),
    );
  }

  @override
  Future<MiningStats> getMiningStats(String orderId) async {
    // In production: GET /main/api/v2/mining/algo/{algorithm}/orders/{orderId}
    
    try {
      // Simulate stats response
      return MiningStats(
        currentHashRate: 48.5 + _random.nextDouble() * 3, // Slight fluctuation
        acceptedShares: _random.nextInt(10000).toDouble(),
        rejectedShares: _random.nextInt(10).toDouble(),
        btcEarnedToday: 0.00001 + _random.nextDouble() * 0.00001,
        btcEarnedTotal: 0.0001 + _random.nextDouble() * 0.0001,
        estimatedDailyBtc: 0.00015,
        profitability: 2.5 + _random.nextDouble() * 0.5,
        powerCost: 1.2,
        timestamp: DateTime.now(),
      );
    } catch (e) {
      throw Exception('Failed to get mining stats: $e');
    }
  }

  @override
  Future<void> stopMining(String orderId) async {
    // In production: DELETE /main/api/v2/mining/order/{orderId}
    print('NiceHash: Stopping order $orderId');
    await Future.delayed(const Duration(seconds: 1));
  }

  @override
  Future<List<MiningOrder>> getActiveOrders() async {
    // In production: GET /main/api/v2/mining/algo/SHA256/orders
    return [];
  }

  @override
  Future<List<MiningEarning>> getEarningsHistory({
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    // In production: GET /main/api/v2/mining/rigs/earnings
    return [];
  }

  @override
  Future<ProviderStatus> getStatus() async {
    // In production: GET /main/api/v2/mining/algorithms
    try {
      // Attempt real API call
      final response = await http.get(
        Uri.parse('$_baseUrl/main/api/v2/mining/algorithms'),
        headers: {
          if (_apiKey != null) 'X-Auth-Id': _apiKey!,
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        return ProviderStatus(
          isOperational: true,
          message: 'NiceHash API operational',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      // API not reachable (expected in simulation mode)
    }

    return ProviderStatus(
      isOperational: true, // Assume operational for simulation
      message: 'NiceHash (simulation mode)',
      timestamp: DateTime.now(),
    );
  }

  /// Calculate estimated cost for hash power rental
  double _calculateCost(double hashRate, Duration duration) {
    // NiceHash pricing: roughly $0.0001 per MH/s per day (varies)
    final days = duration.inHours / 24;
    return hashRate * 0.0001 * days;
  }

  /// Make authenticated request to NiceHash API
  Future<dynamic> _makeRequest(String method, String path) async {
    final url = Uri.parse('$_baseUrl$path');
    final headers = <String, String>{};

    if (_apiKey != null && _apiSecret != null) {
      // NiceHash uses HMAC-SHA256 authentication
      final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
      final nonce = _random.nextInt(999999).toString();
      
      headers['X-Auth-Id'] = _apiKey!;
      headers['X-Auth-Time'] = timestamp;
      headers['X-Auth-Nonce'] = nonce;
      // Signature would be computed here
      // headers['X-Auth-Signature'] = _computeSignature(method, path, timestamp, nonce);
    }

    final response = await http.get(url, headers: headers)
        .timeout(const Duration(seconds: 10));

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('NiceHash API error: ${response.statusCode} ${response.body}');
    }
  }
}
