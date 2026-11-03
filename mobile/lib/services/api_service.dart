import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/task.dart';
import '../models/note.dart';
import '../models/notification_item.dart';
import '../models/ai_status.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  static const String _defaultAndroidUrl = 'http://127.0.0.1:3001';
  static const String _defaultDesktopUrl = 'http://127.0.0.1:3001';

  String _baseUrl = '';
  String? _authToken;

  String get baseUrl => _baseUrl;
  String? get authToken => _authToken;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    
    // Determine default host based on platform
    String defaultUrl = _defaultDesktopUrl;
    if (!kIsWeb) {
      try {
        if (Platform.isAndroid) {
          defaultUrl = _defaultAndroidUrl;
        }
      } catch (_) {}
    }

    _baseUrl = prefs.getString('api_base_url') ?? defaultUrl;
    _authToken = prefs.getString('auth_token');

    // Auto-authenticate with demo user if not logged in
    await ensureAuthenticated();
  }

  Future<void> updateBaseUrl(String newUrl) async {
    _baseUrl = newUrl.trim().replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_base_url', _baseUrl);
    _authToken = null;
    await prefs.remove('auth_token');
    await ensureAuthenticated();
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

  Future<void> ensureAuthenticated() async {
    if (_authToken != null && _authToken!.isNotEmpty) {
      try {
        final res = await _get('/api/v1/auth/me');
        if (res.statusCode == 200) return;
      } catch (_) {
        // Token might be invalid, proceed to login
      }
    }

    // Try logging into default demo user
    try {
      final loginRes = await http.post(
        Uri.parse('$_baseUrl/api/v1/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': 'demo@personal.local',
          'password': 'demo_password_123',
        }),
      ).timeout(const Duration(seconds: 5));

      if (loginRes.statusCode == 200) {
        final data = jsonDecode(loginRes.body);
        _authToken = data['token'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', _authToken!);
        return;
      }

      // If login failed, register demo account
      final regRes = await http.post(
        Uri.parse('$_baseUrl/api/v1/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': 'demo@personal.local',
          'password': 'demo_password_123',
          'displayName': 'Personal User',
        }),
      ).timeout(const Duration(seconds: 5));

      if (regRes.statusCode == 201 || regRes.statusCode == 200) {
        final data = jsonDecode(regRes.body);
        _authToken = data['token'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', _authToken!);
      }
    } catch (e) {
      debugPrint('Auth bootstrap error: $e');
    }
  }

  Map<String, String> _headers() {
    final headers = {'Content-Type': 'application/json'};
    if (_authToken != null) {
      headers['Authorization'] = 'Bearer $_authToken';
    }
    return headers;
  }

  Future<http.Response> _get(String path) {
    return http
        .get(Uri.parse('$_baseUrl$path'), headers: _headers())
        .timeout(const Duration(seconds: 8));
  }

  Future<http.Response> _post(String path, Map<String, dynamic> body) {
    return http
        .post(
          Uri.parse('$_baseUrl$path'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 12));
  }

  Future<http.Response> _patch(String path, Map<String, dynamic> body) {
    return http
        .patch(
          Uri.parse('$_baseUrl$path'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 8));
  }

  Future<http.Response> _delete(String path) {
    return http
        .delete(Uri.parse('$_baseUrl$path'), headers: _headers())
        .timeout(const Duration(seconds: 8));
  }

  // --- Eisenhower Matrix ---
  Future<Map<String, List<Task>>> fetchMatrix() async {
    await ensureAuthenticated();
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
    await ensureAuthenticated();
    final query = status != null ? '?status=$status' : '';
    final res = await _get('/api/v1/tasks$query');
    if (res.statusCode == 200) {
      final list = jsonDecode(res.body) as List;
      return list.map((e) => Task.fromJson(e)).toList();
    }
    throw Exception('Failed to fetch tasks');
  }

  Future<List<Task>> fetchTodayTasks() async {
    await ensureAuthenticated();
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
    await ensureAuthenticated();
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
    await ensureAuthenticated();
    if (isCompleted) {
      await _post('/api/v1/tasks/$taskId/complete', {});
    } else {
      await _patch('/api/v1/tasks/$taskId/status', {'status': 'TODO'});
    }
  }

  Future<void> moveTaskQuadrant(String taskId, String quadrant) async {
    await ensureAuthenticated();
    await _patch('/api/v1/tasks/$taskId/quadrant', {'quadrant': quadrant});
  }

  Future<void> deleteTask(String taskId) async {
    await ensureAuthenticated();
    await _delete('/api/v1/tasks/$taskId');
  }

  // --- Natural Language Quick Capture with AI ---
  Future<void> createCapture(String text) async {
    await ensureAuthenticated();
    final res = await _post('/api/v1/captures', {
      'text': text,
      'inputMode': 'TEXT',
      'autoConvert': true,
    });
    if (res.statusCode != 201 && res.statusCode != 200) {
      throw Exception('Capture failed');
    }
  }

  // --- Notes ---
  Future<List<Note>> fetchNotes() async {
    await ensureAuthenticated();
    final res = await _get('/api/v1/notes');
    if (res.statusCode == 200) {
      final list = jsonDecode(res.body) as List;
      return list.map((e) => Note.fromJson(e)).toList();
    }
    throw Exception('Failed to fetch notes');
  }

  Future<Note> createNote({String? title, required String content}) async {
    await ensureAuthenticated();
    final Map<String, dynamic> body = {'content': content};
    if (title != null) body['title'] = title;
    final res = await _post('/api/v1/notes', body);
    if (res.statusCode == 201 || res.statusCode == 200) {
      return Note.fromJson(jsonDecode(res.body));
    }
    throw Exception('Failed to create note');
  }

  Future<void> deleteNote(String noteId) async {
    await ensureAuthenticated();
    await _delete('/api/v1/notes/$noteId');
  }

  // --- Notifications ---
  Future<List<NotificationItem>> fetchNotifications() async {
    await ensureAuthenticated();
    final res = await _get('/api/v1/notifications');
    if (res.statusCode == 200) {
      final list = jsonDecode(res.body) as List;
      return list.map((e) => NotificationItem.fromJson(e)).toList();
    }
    return [];
  }

  Future<void> markNotificationRead(String id) async {
    await ensureAuthenticated();
    await _patch('/api/v1/notifications/$id/read', {});
  }

  // --- AI Status ---
  Future<AIStatus> getAIStatus() async {
    try {
      await ensureAuthenticated();
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
