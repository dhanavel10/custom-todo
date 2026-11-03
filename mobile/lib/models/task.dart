class TaskAIAnalysis {
  final String source;
  final String model;
  final num urgencyScore;
  final num importanceScore;
  final String reasoning;

  TaskAIAnalysis({
    required this.source,
    required this.model,
    required this.urgencyScore,
    required this.importanceScore,
    required this.reasoning,
  });

  factory TaskAIAnalysis.fromJson(Map<String, dynamic> json) {
    return TaskAIAnalysis(
      source: json['source']?.toString() ?? '',
      model: json['model']?.toString() ?? '',
      urgencyScore: json['urgencyScore'] ?? 0,
      importanceScore: json['importanceScore'] ?? 0,
      reasoning: json['reasoning']?.toString() ?? '',
    );
  }
}

class Task {
  final String id;
  final String userId;
  final String? captureId;
  final String title;
  final String? description;
  final String status;
  final String? priority;
  final String? category;
  final String? urgency;
  final String? importance;
  final String? eisenhowerQuadrant;
  final bool isDeadline;
  final TaskAIAnalysis? aiAnalysis;
  final String? dueAt;
  final String? completedAt;
  final String createdAt;
  final String updatedAt;

  Task({
    required this.id,
    required this.userId,
    this.captureId,
    required this.title,
    this.description,
    required this.status,
    this.priority,
    this.category,
    this.urgency,
    this.importance,
    this.eisenhowerQuadrant,
    this.isDeadline = false,
    this.aiAnalysis,
    this.dueAt,
    this.completedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get isCompleted => status == 'COMPLETED';

  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      captureId: json['captureId']?.toString(),
      title: json['title']?.toString() ?? 'Untitled Task',
      description: json['description']?.toString(),
      status: json['status']?.toString() ?? 'TODO',
      priority: json['priority']?.toString(),
      category: json['category']?.toString(),
      urgency: json['urgency']?.toString(),
      importance: json['importance']?.toString(),
      eisenhowerQuadrant: json['eisenhowerQuadrant']?.toString(),
      isDeadline: json['isDeadline'] == true,
      aiAnalysis: json['aiAnalysis'] != null && json['aiAnalysis'] is Map<String, dynamic>
          ? TaskAIAnalysis.fromJson(json['aiAnalysis'])
          : null,
      dueAt: json['dueAt']?.toString(),
      completedAt: json['completedAt']?.toString(),
      createdAt: json['createdAt']?.toString() ?? DateTime.now().toIso8601String(),
      updatedAt: json['updatedAt']?.toString() ?? DateTime.now().toIso8601String(),
    );
  }

  Task copyWith({
    String? status,
    String? eisenhowerQuadrant,
    String? completedAt,
  }) {
    return Task(
      id: id,
      userId: userId,
      captureId: captureId,
      title: title,
      description: description,
      status: status ?? this.status,
      priority: priority,
      category: category,
      urgency: urgency,
      importance: importance,
      eisenhowerQuadrant: eisenhowerQuadrant ?? this.eisenhowerQuadrant,
      isDeadline: isDeadline,
      aiAnalysis: aiAnalysis,
      dueAt: dueAt,
      completedAt: completedAt ?? this.completedAt,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
