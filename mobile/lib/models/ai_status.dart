class AIStatus {
  final bool connected;
  final String baseUrl;
  final String model;
  final List<String> availableModels;
  final String? error;

  AIStatus({
    required this.connected,
    required this.baseUrl,
    required this.model,
    required this.availableModels,
    this.error,
  });

  factory AIStatus.fromJson(Map<String, dynamic> json) {
    final list = json['availableModels'];
    return AIStatus(
      connected: json['connected'] == true,
      baseUrl: json['baseUrl']?.toString() ?? '',
      model: json['model']?.toString() ?? '',
      availableModels: list is List ? list.map((e) => e.toString()).toList() : [],
      error: json['error']?.toString(),
    );
  }
}
