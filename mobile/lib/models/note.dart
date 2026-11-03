class Note {
  final String id;
  final String userId;
  final String? title;
  final String content;
  final bool isPinned;
  final bool isArchived;
  final String createdAt;
  final String updatedAt;

  Note({
    required this.id,
    required this.userId,
    this.title,
    required this.content,
    this.isPinned = false,
    this.isArchived = false,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Note.fromJson(Map<String, dynamic> json) {
    return Note(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      title: json['title']?.toString(),
      content: json['content']?.toString() ?? '',
      isPinned: json['isPinned'] == true,
      isArchived: json['isArchived'] == true,
      createdAt: json['createdAt']?.toString() ?? DateTime.now().toIso8601String(),
      updatedAt: json['updatedAt']?.toString() ?? DateTime.now().toIso8601String(),
    );
  }
}
