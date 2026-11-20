class User {
  final String id;
  final String email;
  final String? username;
  final String? displayName;
  final String? avatarUrl;
  final String? timeZone;
  final DateTime? createdAt;

  User({
    required this.id,
    required this.email,
    this.username,
    this.displayName,
    this.avatarUrl,
    this.timeZone,
    this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      username: json['username'] as String?,
      displayName: json['displayName'] as String? ?? json['display_name'] as String?,
      avatarUrl: json['avatarUrl'] as String? ?? json['avatar_url'] as String?,
      timeZone: json['timeZone'] as String? ?? json['time_zone'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : (json['created_at'] != null ? DateTime.tryParse(json['created_at'] as String) : null),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'username': username,
        'displayName': displayName,
        'avatarUrl': avatarUrl,
        'timeZone': timeZone,
        'createdAt': createdAt?.toIso8601String(),
      };
}
