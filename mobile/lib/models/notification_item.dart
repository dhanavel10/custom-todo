class NotificationItem {
  final String id;
  final String userId;
  final String? taskId;
  final String title;
  final String message;
  final bool isRead;
  final String createdAt;

  NotificationItem({
    required this.id,
    required this.userId,
    this.taskId,
    required this.title,
    required this.message,
    this.isRead = false,
    required this.createdAt,
  });

  /// Server shape: { id, userId, taskId, title, body, readAt, createdAt }.
  /// Older field names (message / isRead) are still accepted.
  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      taskId: json['taskId']?.toString(),
      title: json['title']?.toString() ?? 'Reminder',
      message: (json['body'] ?? json['message'])?.toString() ?? '',
      isRead: json['readAt'] != null || json['isRead'] == true,
      createdAt: json['createdAt']?.toString() ?? DateTime.now().toIso8601String(),
    );
  }

  /// Icon category inferred from the text (the API has no type field).
  String get kind {
    final t = '$title $message'.toLowerCase();
    if (RegExp(r'study|plan|session|concept').hasMatch(t)) return 'study';
    if (RegExp(r'morning|evening|review|briefing|wrap').hasMatch(t)) return 'review';
    return 'reminder';
  }
}
