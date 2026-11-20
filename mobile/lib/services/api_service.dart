import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/task.dart';
import '../models/note.dart';
import '../models/notification_item.dart';
import '../models/ai_status.dart';
import '../models/user.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  static const String defaultProductionUrl = 'https://todo.dhanavel.online';
  static const String defaultAndroidEmulatorUrl = 'http://10.0.2.2:3001';
  static const String defaultDesktopUrl = 'http://127.0.0.1:3001';

  String _baseUrl = defaultProductionUrl;
  String? _authToken;
  User? _currentUser;

  final ValueNotifier<bool> authStateNotifier = ValueNotifier<bool>(false);
  final ValueNotifier<User?> currentUserNotifier = ValueNotifier<User?>(null);

  String get baseUrl => _baseUrl;
  String? get authToken => _authToken;
  User? get currentUser => _currentUser;
  bool get isAuthenticated => _authToken != null && !isTokenExpired(_authToken);

  /// Decodes JWT payload without requiring third-party libraries.
  static Map<String, dynamic>? parseJwt(String? token) {
    if (token == null || token.isEmpty) return null;
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      String normalized = base64Url.normalize(parts[1]);
      String payload = utf8.decode(base64Url.decode(normalized));
      final decoded = jsonDecode(payload);
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  /// Checks if the JWT is expired or invalid.
  static bool isTokenExpired(String? token) {
    if (token == null || token.isEmpty) return true;
    final payload = parseJwt(token);
    if (payload == null || !payload.containsKey('exp')) return true;
    final exp = payload['exp'];
    if (exp is num) {
      final expiryDate = DateTime.fromMillisecondsSinceEpoch(exp.toInt() * 1000);
      return DateTime.now().isAfter(expiryDate);
    }
    return false;
  }

  /// Returns remaining validity duration of token (e.g. 7 days down to 0).
  Duration? getTokenRemainingDuration() {
    if (_authToken == null) return null;
    final payload = parseJwt(_authToken);
    if (payload == null || !payload.containsKey('exp')) return null;
    final exp = payload['exp'];
    if (exp is num) {
      final expiryDate = DateTime.fromMillisecondsSinceEpoch(exp.toInt() * 1000);
      return expiryDate.difference(DateTime.now());
    }
    return null;
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();

    String fallbackUrl = defaultProductionUrl;
    if (!kIsWeb) {
      try {
        if (Platform.isAndroid) {
          fallbackUrl = defaultProductionUrl;
        }
      } catch (_) {}
    }

    _baseUrl = prefs.getString('api_base_url') ?? fallbackUrl;
    _authToken = prefs.getString('auth_token');

    if (_authToken != null && _authToken!.isNotEmpty) {
      if (isTokenExpired(_authToken)) {
        debugPrint('Stored auth token is expired (7-day duration passed). Resetting session.');
        await logout();
      } else {
        // Verify with server and fetch current user profile
        final success = await fetchCurrentUser();
        if (!success) {
          debugPrint('Session validation with server failed. Logging out.');
          await logout();
        } else {
          authStateNotifier.value = true;
        }
      }
    } else {
      authStateNotifier.value = false;
      currentUserNotifier.value = null;
    }
  }

  Future<void> updateBaseUrl(String newUrl) async {
    _baseUrl = newUrl.trim().replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_base_url', _baseUrl);
    // If base url changed, verify current session against new host
    if (_authToken != null) {
      final ok = await fetchCurrentUser();
      if (!ok) {
        await logout();
      }
    }
  }

  Future<bool> testConnection(String url) async {
    try {
      final cleanUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
      final res = await http.get(Uri.parse('$cleanUrl/health')).timeout(const Duration(seconds: 4));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> getAuthConfig() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/api/v1/auth/config')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
    } catch (e) {
      debugPrint('Failed to get auth config: $e');
    }
    return null;
  }

  Future<bool> fetchCurrentUser() async {
    if (_authToken == null) return false;
    try {
      final res = await _get('/api/v1/auth/me');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map<String, dynamic> && data['user'] is Map<String, dynamic>) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          currentUserNotifier.value = _currentUser;
          authStateNotifier.value = true;
          return true;
        }
      } else if (res.statusCode == 401) {
        return false;
      }
    } catch (e) {
      debugPrint('fetchCurrentUser error: $e');
    }
    return false;
  }

  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/api/v1/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'identifier': identifier.trim(),
          'password': password,
        }),
      ).timeout(const Duration(seconds: 8));

      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['token'] != null) {
        _authToken = data['token'] as String;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', _authToken!);

        if (data['user'] != null) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          currentUserNotifier.value = _currentUser;
        }

        authStateNotifier.value = true;
        return {'success': true, 'user': _currentUser};
      }

      final errorMsg = data['error']?['message'] ?? 'Login failed. Please check your credentials.';
      return {'success': false, 'message': errorMsg};
    } catch (e) {
      return {'success': false, 'message': 'Network error. Please check server URL and connection.'};
    }
  }

  Future<Map<String, dynamic>> register({
    required String email,
    String? username,
    required String password,
    String? displayName,
  }) async {
    try {
      final body = <String, dynamic>{
        'email': email.trim().toLowerCase(),
        'password': password,
      };
      if (username != null && username.trim().isNotEmpty) {
        body['username'] = username.trim().toLowerCase();
      }
      if (displayName != null && displayName.trim().isNotEmpty) {
        body['displayName'] = displayName.trim();
      }

      final res = await http.post(
        Uri.parse('$_baseUrl/api/v1/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      ).timeout(const Duration(seconds: 10));

      final data = jsonDecode(res.body);
      if ((res.statusCode == 201 || res.statusCode == 200) && data['token'] != null) {
        _authToken = data['token'] as String;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', _authToken!);

        if (data['user'] != null) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          currentUserNotifier.value = _currentUser;
        }

        authStateNotifier.value = true;
        return {'success': true, 'user': _currentUser};
      }

      final errorMsg = data['error']?['message'] ?? 'Registration failed.';
      return {'success': false, 'message': errorMsg};
    } catch (e) {
      return {'success': false, 'message': 'Network error during registration: $e'};
    }
  }

  Future<Map<String, dynamic>> loginWithGoogle(String credential) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/api/v1/auth/google'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'credential': credential}),
      ).timeout(const Duration(seconds: 12));

      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['token'] != null) {
        _authToken = data['token'] as String;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', _authToken!);

        if (data['user'] != null) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          currentUserNotifier.value = _currentUser;
        }

        authStateNotifier.value = true;
        return {'success': true, 'user': _currentUser};
      }

      final errorMsg = data['error']?['message'] ?? 'Google authentication failed.';
      return {'success': false, 'message': errorMsg};
    } catch (e) {
      return {'success': false, 'message': 'Google authentication error: $e'};
    }
  }

  Future<void> logout() async {
    try {
      if (_authToken != null) {
        await http.post(
          Uri.parse('$_baseUrl/api/v1/auth/logout'),
          headers: _headers(),
        ).timeout(const Duration(seconds: 4));
      }
    } catch (_) {}

    _authToken = null;
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    currentUserNotifier.value = null;
    authStateNotifier.value = false;
  }

  void _handleUnauthorized(http.Response res) {
    if (res.statusCode == 401) {
      debugPrint('Received 401 Unauthorized from API. Logging out user.');
      logout();
    }
  }

  Map<String, String> _headers() {
    final headers = {'Content-Type': 'application/json'};
    if (_authToken != null) {
      headers['Authorization'] = 'Bearer $_authToken';
    }
    return headers;
  }

  Future<http.Response> _get(String path) async {
    final res = await http
        .get(Uri.parse('$_baseUrl$path'), headers: _headers())
        .timeout(const Duration(seconds: 8));
    if (res.statusCode == 401) _handleUnauthorized(res);
    return res;
  }

  Future<http.Response> _post(String path, Map<String, dynamic> body) async {
    final res = await http
        .post(
          Uri.parse('$_baseUrl$path'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 12));
    if (res.statusCode == 401) _handleUnauthorized(res);
    return res;
  }

  Future<http.Response> _patch(String path, Map<String, dynamic> body) async {
    final res = await http
        .patch(
          Uri.parse('$_baseUrl$path'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 8));
    if (res.statusCode == 401) _handleUnauthorized(res);
    return res;
  }

  Future<http.Response> _delete(String path) async {
    final res = await http
        .delete(Uri.parse('$_baseUrl$path'), headers: _headers())
        .timeout(const Duration(seconds: 8));
    if (res.statusCode == 401) _handleUnauthorized(res);
    return res;
  }

  // --- Eisenhower Matrix ---
  Future<Map<String, List<Task>>> fetchMatrix() async {
    final res = await _get('/api/v1/tasks/matrix');
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      return {
        'doFirst': ((data['doFirst'] as List?) ?? []).map((e) => Task.fromJson(e)).toList(),
        'schedule': ((data['schedule'] as List?) ?? []).map((e) => Task.fromJson(e)).toList(),
        'delegate': ((data['delegate'] as List?) ?? []).map((e) => Task.fromJson(e)).toList(),
        'eliminate': ((data['eliminate'] as List?) ?? []).map((e) => Task.fromJson(e)).toList(),
      };
    }
    throw Exception('Failed to load matrix (status ${res.statusCode})');
  }

  // --- Tasks ---
  Future<List<Task>> fetchTasks({String? status}) async {
    final query = status != null ? '?status=$status' : '';
    final res = await _get('/api/v1/tasks$query');
    if (res.statusCode == 200) {
      final list = jsonDecode(res.body) as List;
      return list.map((e) => Task.fromJson(e)).toList();
    }
    throw Exception('Failed to fetch tasks');
  }

  Future<List<Task>> fetchTodayTasks() async {
    final res = await _get('/api/v1/tasks/today');
    if (res.statusCode == 200) {
      final list = jsonDecode(res.body) as List;
      return list.map((e) => Task.fromJson(e)).toList();
    }
    throw Exception('Failed to fetch today tasks');
  }

  Future<Task> createTask({
    required String title,
    String? description,
    String? quadrant,
    String? priority,
    String? dueAt,
  }) async {
    final Map<String, dynamic> body = {'title': title};
    if (description != null) body['description'] = description;
    if (quadrant != null) body['eisenhowerQuadrant'] = quadrant;
    if (priority != null) body['priority'] = priority;
    if (dueAt != null) body['dueAt'] = dueAt;
    final res = await _post('/api/v1/tasks', body);
    if (res.statusCode == 201 || res.statusCode == 200) {
      return Task.fromJson(jsonDecode(res.body));
    }
    throw Exception('Failed to create task');
  }

  Future<void> toggleTaskComplete(String taskId, bool isCompleted) async {
    if (isCompleted) {
      await _post('/api/v1/tasks/$taskId/complete', {});
    } else {
      await _patch('/api/v1/tasks/$taskId/status', {'status': 'TODO'});
    }
  }

  Future<void> moveTaskQuadrant(String taskId, String quadrant) async {
    await _patch('/api/v1/tasks/$taskId/quadrant', {'quadrant': quadrant});
  }

  Future<void> deleteTask(String taskId) async {
    await _delete('/api/v1/tasks/$taskId');
  }

  /// Reschedule a task (PATCH /tasks/:id). Pass null to clear the due date.
  Future<Task> updateTaskDueAt(String taskId, DateTime? dueAt) async {
    final res = await _patch('/api/v1/tasks/$taskId', {'dueAt': dueAt?.toUtc().toIso8601String()});
    if (res.statusCode == 200) return Task.fromJson(jsonDecode(res.body));
    throw Exception('Failed to reschedule task');
  }

  // --- Natural Language Quick Capture with AI ---
  /// Saves a capture; the server parses it and (usually) auto-creates a classified task.
  /// Returns that task, or null if the capture stayed in the inbox (e.g. detected as a note).
  Future<Task?> createCapture(String text) async {
    final res = await _post('/api/v1/captures', {
      'text': text,
      'inputMode': 'TEXT',
      'autoConvert': true,
    });
    if (res.statusCode != 201 && res.statusCode != 200) {
      throw Exception('Capture failed');
    }
    try {
      final data = jsonDecode(res.body);
      if (data is Map<String, dynamic> && data['createdTask'] is Map<String, dynamic>) {
        return Task.fromJson(data['createdTask'] as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  // --- Notes ---
  Future<List<Note>> fetchNotes() async {
    final res = await _get('/api/v1/notes');
    if (res.statusCode == 200) {
      final list = jsonDecode(res.body) as List;
      return list.map((e) => Note.fromJson(e)).toList();
    }
    throw Exception('Failed to fetch notes');
  }

  Future<Note> createNote({String? title, required String content}) async {
    final Map<String, dynamic> body = {'content': content};
    if (title != null) body['title'] = title;
    final res = await _post('/api/v1/notes', body);
    if (res.statusCode == 201 || res.statusCode == 200) {
      return Note.fromJson(jsonDecode(res.body));
    }
    throw Exception('Failed to create note');
  }

  Future<Note> updateNote(String noteId, {String? title, required String content}) async {
    final res = await _patch('/api/v1/notes/$noteId', {'title': title, 'content': content});
    if (res.statusCode == 200) return Note.fromJson(jsonDecode(res.body));
    throw Exception('Failed to save note');
  }

  Future<void> deleteNote(String noteId) async {
    await _delete('/api/v1/notes/$noteId');
  }

  // --- Notifications ---
  Future<List<NotificationItem>> fetchNotifications() async {
    final res = await _get('/api/v1/notifications');
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      final list = data is Map<String, dynamic> ? (data['notifications'] as List? ?? const []) : (data as List);
      return list.map((e) => NotificationItem.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<void> markNotificationRead(String id) async {
    await _post('/api/v1/notifications/$id/read', {});
  }

  Future<void> markAllNotificationsRead() async {
    await _post('/api/v1/notifications/read-all', {});
  }

  // --- AI Status ---
  Future<AIStatus> getAIStatus() async {
    try {
      final res = await _get('/api/v1/tasks/ai-status');
      if (res.statusCode == 200) {
        return AIStatus.fromJson(jsonDecode(res.body));
      }
    } catch (_) {}
    return AIStatus(
      connected: false,
      baseUrl: 'http://127.0.0.1:11434',
      model: 'nemotron-3-nano:30b',
      availableModels: [],
      error: 'Not reachable',
    );
  }
}
