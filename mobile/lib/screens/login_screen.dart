import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/ui.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Sign In Form Controllers
  final _signInIdentifierController = TextEditingController();
  final _signInPasswordController = TextEditingController();

  // Register Form Controllers
  final _registerNameController = TextEditingController();
  final _registerUsernameController = TextEditingController();
  final _registerEmailController = TextEditingController();
  final _registerPasswordController = TextEditingController();

  bool _obscureSignInPassword = true;
  bool _obscureRegisterPassword = true;

  bool _isLoading = false;
  String? _errorMessage;

  // Server config
  late TextEditingController _serverUrlController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        setState(() {});
      } else {
        setState(() {});
      }
    });
    _serverUrlController = TextEditingController(text: ApiService().baseUrl);
    _registerPasswordController.addListener(() => setState(() {}));
    _registerUsernameController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _tabController.dispose();
    _signInIdentifierController.dispose();
    _signInPasswordController.dispose();
    _registerNameController.dispose();
    _registerUsernameController.dispose();
    _registerEmailController.dispose();
    _registerPasswordController.dispose();
    _serverUrlController.dispose();
    super.dispose();
  }

  // Password strength checks
  bool get _hasMinLength => _registerPasswordController.text.length >= 8;
  bool get _hasUppercase => _registerPasswordController.text.contains(RegExp(r'[A-Z]'));
  bool get _hasLowercase => _registerPasswordController.text.contains(RegExp(r'[a-z]'));
  bool get _hasDigit => _registerPasswordController.text.contains(RegExp(r'[0-9]'));
  bool get _hasSpecial => _registerPasswordController.text.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>\-_=+\\[\\];]'));

  int get _passwordStrengthScore {
    int score = 0;
    if (_hasMinLength) score++;
    if (_hasUppercase) score++;
    if (_hasLowercase) score++;
    if (_hasDigit) score++;
    if (_hasSpecial) score++;
    return score;
  }

  bool get _isPasswordStrong =>
      _hasMinLength && _hasUppercase && _hasLowercase && _hasDigit && _hasSpecial;

  // Username validity
  bool get _isUsernameValid {
    final u = _registerUsernameController.text.trim();
    if (u.isEmpty) return true; // Optional on submit (server auto-generates if blank)
    return RegExp(r'^[a-zA-Z0-9_]{3,20}$').hasMatch(u);
  }

  Future<void> _handleSignIn() async {
    final identifier = _signInIdentifierController.text.trim();
    final password = _signInPasswordController.text;

    if (identifier.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Please enter your username/email and password');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await ApiService().login(identifier: identifier, password: password);

    if (mounted) {
      setState(() => _isLoading = false);
      if (result['success'] == true) {
        showToast(context, 'Signed in successfully. 7-day session active.', icon: Icons.lock_open_rounded);
      } else {
        setState(() => _errorMessage = result['message'] as String? ?? 'Sign in failed');
      }
    }
  }

  Future<void> _handleRegister() async {
    final email = _registerEmailController.text.trim();
    final username = _registerUsernameController.text.trim();
    final name = _registerNameController.text.trim();
    final password = _registerPasswordController.text;

    if (email.isEmpty || !email.contains('@')) {
      setState(() => _errorMessage = 'Please enter a valid email address');
      return;
    }

    if (username.isNotEmpty && !_isUsernameValid) {
      setState(() => _errorMessage = 'Username must be 3-20 characters (letters, numbers, underscores only)');
      return;
    }

    if (!_isPasswordStrong) {
      setState(() => _errorMessage = 'Password must meet all 5 security requirements below');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await ApiService().register(
      email: email,
      username: username.isEmpty ? null : username,
      displayName: name.isEmpty ? null : name,
      password: password,
    );

    if (mounted) {
      setState(() => _isLoading = false);
      if (result['success'] == true) {
        showToast(context, 'Account created! 7-day session active.', icon: Icons.celebration_rounded);
      } else {
        setState(() => _errorMessage = result['message'] as String? ?? 'Registration failed');
      }
    }
  }

  Future<void> _handleGoogleAuth() async {
    // Show dialog explaining Google Auth / ID Token input
    final tokenController = TextEditingController();
    final p = context.palette;

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(color: p.sunken, borderRadius: BorderRadius.circular(Radii.sm)),
              child: const Icon(Icons.g_mobiledata_rounded, size: 28, color: Colors.blue),
            ),
            const SizedBox(width: 10),
            const Text('Google Authentication'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sign in using your Google Account ID token or authenticate via the web interface at todo.dhanavel.online.',
              style: AppType.body(p.text2),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: tokenController,
              decoration: const InputDecoration(
                hintText: 'Paste Google ID token',
                labelText: 'Google ID Token',
                prefixIcon: Icon(Icons.vpn_key_rounded),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final token = tokenController.text.trim();
              if (token.isEmpty) return;
              Navigator.pop(ctx);
              setState(() {
                _isLoading = true;
                _errorMessage = null;
              });
              final res = await ApiService().loginWithGoogle(token);
              if (mounted) {
                setState(() => _isLoading = false);
                if (res['success'] == true) {
                  showToast(context, 'Google Sign-In successful!', icon: Icons.check_circle_rounded);
                } else {
                  setState(() => _errorMessage = res['message'] as String? ?? 'Google auth failed');
                }
              }
            },
            child: const Text('Authenticate'),
          ),
        ],
      ),
    );
  }

  void _showServerSheet() {
    final p = context.palette;
    showAppSheet(
      context,
      (sheetCtx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return SheetScaffold(
            title: 'Server Settings',
            subtitle: 'Choose your backend server host',
            icon: Icons.dns_rounded,
            trailing: IconButton(
              icon: const Icon(Icons.close_rounded),
              onPressed: () => Navigator.pop(ctx),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _serverUrlController,
                  keyboardType: TextInputType.url,
                  style: AppType.mono(p.text, size: 13),
                  decoration: const InputDecoration(
                    labelText: 'Server URL',
                    prefixIcon: Icon(Icons.link_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildPresetChip('Production', ApiService.defaultProductionUrl, p),
                    _buildPresetChip('Emulator', ApiService.defaultAndroidEmulatorUrl, p),
                    _buildPresetChip('Desktop', ApiService.defaultDesktopUrl, p),
                  ],
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: () async {
                    final newUrl = _serverUrlController.text.trim();
                    if (newUrl.isNotEmpty) {
                      await ApiService().updateBaseUrl(newUrl);
                      if (mounted) setState(() {});
                      if (ctx.mounted) {
                        Navigator.pop(ctx);
                        showToast(ctx, 'Connected to $newUrl', icon: Icons.wifi_rounded);
                      }
                    }
                  },
                  icon: const Icon(Icons.check_rounded, size: 18),
                  label: const Text('Apply Server URL'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildPresetChip(String label, String url, Palette p) {
    final isSelected = _serverUrlController.text.trim() == url;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) {
        setState(() => _serverUrlController.text = url);
      },
      selectedColor: p.primarySoft,
      backgroundColor: p.surface2,
      side: BorderSide(color: isSelected ? p.primary : p.border),
      labelStyle: AppType.caption(isSelected ? p.primaryText : p.text).copyWith(fontWeight: FontWeight.w600),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Server connection badge at top
                  Center(
                    child: Pressable(
                      onTap: _showServerSheet,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: p.sunken,
                          borderRadius: BorderRadius.circular(Radii.full),
                          border: Border.all(color: p.borderSubtle),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: p.green,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                ApiService().baseUrl.replaceFirst(RegExp(r'^https?://'), ''),
                                style: AppType.meta(p.text2),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(Icons.unfold_more_rounded, size: 14, color: p.text3),
                          ],
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // App Brand Logo & Title
                  Center(
                    child: Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [p.primary, p.primary.withValues(alpha: 0.8)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: p.primary.withValues(alpha: 0.3),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.check_circle_rounded,
                        color: Colors.white,
                        size: 32,
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  Text(
                    'Productivity Inbox',
                    textAlign: TextAlign.center,
                    style: AppType.display(p.text).copyWith(fontSize: 24),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Eisenhower Matrix & AI Day Planner',
                    textAlign: TextAlign.center,
                    style: AppType.body(p.text3).copyWith(fontSize: 13.5),
                  ),

                  const SizedBox(height: 24),

                  // 7-day session notification pill
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: p.soft(p.teal),
                      borderRadius: BorderRadius.circular(Radii.md),
                      border: Border.all(color: p.teal.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.shield_outlined, size: 18, color: p.teal),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Sessions last 7 days with secure token encryption.',
                            style: AppType.caption(p.teal).copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Sign In / Register Tab Bar
                  Container(
                    decoration: BoxDecoration(
                      color: p.surface2,
                      borderRadius: BorderRadius.circular(Radii.lg),
                      border: Border.all(color: p.border),
                    ),
                    padding: const EdgeInsets.all(4),
                    child: TabBar(
                      controller: _tabController,
                      indicator: BoxDecoration(
                        color: p.surface,
                        borderRadius: BorderRadius.circular(Radii.md),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.05),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      indicatorSize: TabBarIndicatorSize.tab,
                      dividerColor: Colors.transparent,
                      labelColor: p.text,
                      unselectedLabelColor: p.text3,
                      labelStyle: AppType.caption(p.text).copyWith(fontWeight: FontWeight.w700),
                      unselectedLabelStyle: AppType.caption(p.text3),
                      tabs: const [
                        Tab(text: 'Sign In'),
                        Tab(text: 'Create Account'),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Error Banner
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: p.soft(p.coral),
                        borderRadius: BorderRadius.circular(Radii.md),
                        border: Border.all(color: p.coral.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline_rounded, size: 20, color: p.coral),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: AppType.caption(p.coral).copyWith(fontWeight: FontWeight.w600),
                            ),
                          ),
                          GestureDetector(
                            onTap: () => setState(() => _errorMessage = null),
                            child: Icon(Icons.close_rounded, size: 16, color: p.coral),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Tab Views
                  AnimatedSwitcher(
                    duration: Motion.base,
                    switchInCurve: Motion.out,
                    child: _tabController.index == 0
                        ? KeyedSubtree(
                            key: const ValueKey('sign_in'),
                            child: _buildSignInForm(p),
                          )
                        : KeyedSubtree(
                            key: const ValueKey('register'),
                            child: _buildRegisterForm(p),
                          ),
                  ),

                  const SizedBox(height: 16),

                  // Divider
                  Row(
                    children: [
                      Expanded(child: Divider(color: p.borderSubtle)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: Text('OR', style: AppType.meta(p.text3)),
                      ),
                      Expanded(child: Divider(color: p.borderSubtle)),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Google Sign-In Button
                  OutlinedButton(
                    onPressed: _isLoading ? null : _handleGoogleAuth,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: BorderSide(color: p.border),
                      backgroundColor: p.surface,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Google "G" icon design
                        Container(
                          width: 20,
                          height: 20,
                          alignment: Alignment.center,
                          child: const Icon(
                            Icons.g_mobiledata_rounded,
                            size: 26,
                            color: Colors.blue,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Continue with Google',
                          style: AppType.card(p.text).copyWith(fontSize: 14),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSignInForm(Palette p) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _signInIdentifierController,
          textInputAction: TextInputAction.next,
          autocorrect: false,
          decoration: const InputDecoration(
            labelText: 'Username or Email',
            hintText: 'user@example.com or username',
            prefixIcon: Icon(Icons.person_outline_rounded),
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _signInPasswordController,
          obscureText: _obscureSignInPassword,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _handleSignIn(),
          decoration: InputDecoration(
            labelText: 'Password',
            hintText: 'Enter your password',
            prefixIcon: const Icon(Icons.lock_outline_rounded),
            suffixIcon: IconButton(
              icon: Icon(
                _obscureSignInPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
              ),
              onPressed: () => setState(() => _obscureSignInPassword = !_obscureSignInPassword),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(Icons.schedule_rounded, size: 14, color: p.text3),
                const SizedBox(width: 6),
                Text('Active for 7 days', style: AppType.meta(p.text3)),
              ],
            ),
          ],
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: _isLoading ? null : _handleSignIn,
          child: _isLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text('Sign In'),
        ),
      ],
    );
  }

  Widget _buildRegisterForm(Palette p) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _registerNameController,
          textInputAction: TextInputAction.next,
          decoration: const InputDecoration(
            labelText: 'Full Name (optional)',
            hintText: 'Dhanavel',
            prefixIcon: Icon(Icons.badge_outlined),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _registerUsernameController,
          textInputAction: TextInputAction.next,
          autocorrect: false,
          decoration: InputDecoration(
            labelText: 'Username',
            hintText: 'dhanavel',
            prefixIcon: const Icon(Icons.alternate_email_rounded),
            suffixIcon: _registerUsernameController.text.isNotEmpty
                ? Icon(
                    _isUsernameValid ? Icons.check_circle_rounded : Icons.cancel_rounded,
                    size: 18,
                    color: _isUsernameValid ? p.green : p.coral,
                  )
                : null,
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _registerEmailController,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autocorrect: false,
          decoration: const InputDecoration(
            labelText: 'Email Address',
            hintText: 'user@example.com',
            prefixIcon: Icon(Icons.mail_outline_rounded),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _registerPasswordController,
          obscureText: _obscureRegisterPassword,
          textInputAction: TextInputAction.done,
          decoration: InputDecoration(
            labelText: 'Strong Password',
            hintText: 'Must satisfy all 5 rules',
            prefixIcon: const Icon(Icons.lock_outline_rounded),
            suffixIcon: IconButton(
              icon: Icon(
                _obscureRegisterPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
              ),
              onPressed: () => setState(() => _obscureRegisterPassword = !_obscureRegisterPassword),
            ),
          ),
        ),
        const SizedBox(height: 10),

        // Password strength meter
        _buildPasswordStrengthBar(p),

        const SizedBox(height: 8),

        // Rules checklist
        _buildRuleItem('8+ characters', _hasMinLength, p),
        _buildRuleItem('Uppercase letter (A-Z)', _hasUppercase, p),
        _buildRuleItem('Lowercase letter (a-z)', _hasLowercase, p),
        _buildRuleItem('Number (0-9)', _hasDigit, p),
        _buildRuleItem('Special symbol (!@#\$%^&*)', _hasSpecial, p),

        const SizedBox(height: 16),
        FilledButton(
          onPressed: (_isLoading || !_isPasswordStrong) ? null : _handleRegister,
          child: _isLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text('Create Account'),
        ),
      ],
    );
  }

  Widget _buildPasswordStrengthBar(Palette p) {
    final score = _passwordStrengthScore;
    Color barColor;
    String label;

    if (score <= 1) {
      barColor = p.coral;
      label = 'Weak';
    } else if (score == 2 || score == 3) {
      barColor = p.amber;
      label = 'Fair';
    } else if (score == 4) {
      barColor = p.teal;
      label = 'Good';
    } else {
      barColor = p.green;
      label = 'Strong';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Password strength:', style: AppType.meta(p.text3)),
            Text(
              _registerPasswordController.text.isEmpty ? 'None' : label,
              style: AppType.meta(barColor).copyWith(fontWeight: FontWeight.w700),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: _registerPasswordController.text.isEmpty ? 0.0 : score / 5.0,
            backgroundColor: p.sunken,
            color: barColor,
            minHeight: 5,
          ),
        ),
      ],
    );
  }

  Widget _buildRuleItem(String text, bool satisfied, Palette p) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(
            satisfied ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
            size: 14,
            color: satisfied ? p.green : p.text3,
          ),
          const SizedBox(width: 6),
          Text(
            text,
            style: AppType.meta(satisfied ? p.text : p.text3).copyWith(
              fontWeight: satisfied ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ],
      ),
    );
  }
}
