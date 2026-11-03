class NotificationItem {
  final String id;
  final String userId;
  final String? reminderId;
  final String title;
  final String message;
  final String type;
  final bool isRead;
  final String createdAt;

  NotificationItem({
    required this.id,
    required this.userId,
    this.reminderId,
    required this.title,
    required this.message,
    required this.type,
    this.isRead = false,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      reminderId: json['reminderId']?.toString(),
      title: json['title']?.toString() ?? 'Reminder',
      message: json['message']?.toString() ?? '',
      type: json['type']?.toString() ?? 'INFO',
      isRead: json['isRead'] == true,
      createdAt: json['createdAt']?.toString() ?? DateTime.now().toIso8601String(),
    );
  }
}
