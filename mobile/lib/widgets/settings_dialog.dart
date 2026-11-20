import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/ai_status.dart';
import '../models/user.dart';
import '../theme/app_theme.dart';
import 'ui.dart';

/// Settings & connectivity, presented as a bottom sheet.
class SettingsDialog extends StatefulWidget {
  final VoidCallback onSaved;

  const SettingsDialog({super.key, required this.onSaved});

  @override
  State<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends State<SettingsDialog> {
  late TextEditingController _urlController;
  AIStatus? _aiStatus;
  bool _isLoadingAI = true;
  bool _isTesting = false;
  bool _isSaving = false;
  String? _testResult;
  bool? _testSuccess;

  static const String _productionUrl = 'https://todo.dhanavel.online';
  static const String _emulatorUrl = 'http://10.0.2.2:3001';
  static const String _desktopUrl = 'http://127.0.0.1:3001';

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: ApiService().baseUrl);
    _checkAI();
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _checkAI() async {
    setState(() => _isLoadingAI = true);
    final status = await ApiService().getAIStatus();
    if (mounted) {
      setState(() {
        _aiStatus = status;
        _isLoadingAI = false;
      });
    }
  }

  Future<void> _testConnection() async {
    setState(() {
      _isTesting = true;
      _testResult = null;
      _testSuccess = null;
    });

    final url = _urlController.text.trim();
    final ok = await ApiService().testConnection(url);

    if (mounted) {
      setState(() {
        _isTesting = false;
        _testSuccess = ok;
        _testResult = ok ? 'Connected — the server is reachable.' : 'Cannot reach a server at this URL.';
      });
    }
  }

  Future<void> _save() async {
    final newUrl = _urlController.text.trim();
    if (newUrl.isEmpty) return;
    setState(() => _isSaving = true);
    await ApiService().updateBaseUrl(newUrl);
    if (mounted) {
      Navigator.pop(context);
      widget.onSaved();
      showToast(context, 'Reconnected to $newUrl', icon: Icons.wifi_rounded);
    }
  }

  Future<void> _confirmSignOut() async {
    final p = context.palette;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out from your account?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: p.coral),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      if (mounted) Navigator.pop(context); // close sheet
      await ApiService().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final connected = _aiStatus?.connected == true;

    Widget group(String label, List<Widget> children) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.fromLTRB(2, 18, 2, 8), child: Text(label.toUpperCase(), style: AppType.eyebrow(p.text3))),
          ...children,
        ]);

    return SheetScaffold(
      scrollable: true,
      title: 'Settings',
      subtitle: 'Account, connection and appearance',
      icon: Icons.tune_rounded,
      trailing: IconButton(tooltip: 'Close', icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(context)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // Account Profile Section
        ValueListenableBuilder<User?>(
          valueListenable: ApiService().currentUserNotifier,
          builder: (context, user, _) {
            if (user == null) return const SizedBox.shrink();

            final name = user.displayName ?? user.username ?? user.email.split('@').first;
            final initial = name.isNotEmpty ? name[0].toUpperCase() : 'U';
            final remainingDuration = ApiService().getTokenRemainingDuration();
            final daysLeft = remainingDuration != null ? (remainingDuration.inHours / 24).ceil() : 7;

            return group('Account & Session', [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: p.surface2,
                  borderRadius: BorderRadius.circular(Radii.lg),
                  border: Border.all(color: p.border),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 22,
                          backgroundColor: p.primarySoft,
                          child: Text(
                            initial,
                            style: AppType.card(p.primaryText).copyWith(fontSize: 18, fontWeight: FontWeight.w800),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                style: AppType.card(p.text).copyWith(fontSize: 15),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (user.username != null)
                                Text(
                                  '@${user.username}',
                                  style: AppType.mono(p.text3, size: 12),
                                ),
                              Text(
                                user.email,
                                style: AppType.caption(p.text2),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: 'Sign Out',
                          onPressed: _confirmSignOut,
                          icon: Icon(Icons.logout_rounded, color: p.coral),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Divider(color: p.borderSubtle),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.verified_user_outlined, size: 15, color: p.green),
                            const SizedBox(width: 6),
                            Text('7-Day Secure Session', style: AppType.caption(p.text2)),
                          ],
                        ),
                        Tag(
                          '$daysLeft days remaining',
                          color: p.teal,
                          dot: true,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ]);
          },
        ),

        group('Server', [
          TextField(
            controller: _urlController,
            keyboardType: TextInputType.url,
            autocorrect: false,
            style: AppType.mono(p.text, size: 14),
            decoration: const InputDecoration(hintText: 'https://todo.dhanavel.online', prefixIcon: Icon(Icons.dns_rounded, size: 20)),
            onChanged: (_) => setState(() => _testResult = null),
          ),
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 8, children: [
            _preset('Production', Icons.cloud_done_rounded, _productionUrl),
            _preset('Emulator', Icons.android_rounded, _emulatorUrl),
            _preset('Desktop', Icons.computer_rounded, _desktopUrl),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            OutlinedButton.icon(
              onPressed: _isTesting ? null : _testConnection,
              icon: _isTesting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.network_check_rounded, size: 18),
              label: const Text('Test connection'),
            ),
          ]),
          AnimatedSize(
            duration: Motion.base,
            curve: Motion.out,
            child: _testResult == null
                ? const SizedBox(width: double.infinity)
                : Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: p.soft(_testSuccess == true ? p.green : p.coral), borderRadius: BorderRadius.circular(Radii.md)),
                    child: Row(children: [
                      Icon(_testSuccess == true ? Icons.check_circle_rounded : Icons.error_outline_rounded, size: 18, color: _testSuccess == true ? p.green : p.coral),
                      const SizedBox(width: 10),
                      Expanded(child: Text(_testResult!, style: AppType.caption(p.text).copyWith(fontWeight: FontWeight.w500))),
                    ]),
                  ),
          ),
        ]),
        group('AI engine', [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: p.surface2, borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: p.border)),
            child: _isLoadingAI
                ? const SizedBox(height: 44, child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))))
                : Row(children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(color: p.soft(connected ? p.ai : p.amber), borderRadius: BorderRadius.circular(12)),
                      child: Icon(connected ? Icons.auto_awesome_rounded : Icons.memory_rounded, color: connected ? p.ai : p.amber, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Container(width: 7, height: 7, decoration: BoxDecoration(shape: BoxShape.circle, color: connected ? p.green : p.amber)),
                          const SizedBox(width: 6),
                          Text(connected ? 'Ollama online' : 'Ollama offline', style: AppType.card(p.text).copyWith(fontSize: 13.5)),
                        ]),
                        const SizedBox(height: 2),
                        Text('Model: ${_aiStatus?.model ?? '—'}', style: AppType.mono(p.text2, size: 11)),
                        Text(
                          connected ? '${_aiStatus!.availableModels.length} models available · ${_aiStatus!.baseUrl}' : 'Tasks are classified with offline NLP until Ollama is reachable.',
                          style: AppType.meta(p.text3),
                        ),
                      ]),
                    ),
                    IconButton(tooltip: 'Refresh AI status', onPressed: _checkAI, icon: const Icon(Icons.refresh_rounded, size: 20)),
                  ]),
          ),
        ]),
        group('Appearance', [
          ValueListenableBuilder<ThemeMode>(
            valueListenable: ThemeController.instance,
            builder: (context, mode, _) => SegmentedButton<ThemeMode>(
              showSelectedIcon: false,
              style: SegmentedButton.styleFrom(
                backgroundColor: p.surface2,
                selectedBackgroundColor: p.primarySoft,
                selectedForegroundColor: p.primaryText,
                foregroundColor: p.text2,
                side: BorderSide(color: p.border),
                minimumSize: const Size(0, 44),
                textStyle: AppType.caption(p.text).copyWith(fontWeight: FontWeight.w600),
              ),
              segments: const [
                ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto_rounded, size: 18), label: Text('System')),
                ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_rounded, size: 18), label: Text('Light')),
                ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_rounded, size: 18), label: Text('Dark')),
              ],
              selected: {mode},
              onSelectionChanged: (s) => ThemeController.instance.set(s.first),
            ),
          ),
        ]),
        const SizedBox(height: 22),
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel'))),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: FilledButton.icon(
              onPressed: _isSaving ? null : _save,
              icon: _isSaving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.sync_rounded, size: 18),
              label: const Text('Save & reconnect'),
            ),
          ),
        ]),
      ]),
    );
  }

  Widget _preset(String label, IconData icon, String url) {
    final p = context.palette;
    final selected = _urlController.text.trim() == url;
    return ChoiceChip(
      avatar: Icon(icon, size: 16, color: selected ? p.primaryText : p.text3),
      label: Text(label),
      selected: selected,
      showCheckmark: false,
      labelStyle: AppType.caption(selected ? p.primaryText : p.text).copyWith(fontWeight: FontWeight.w600),
      backgroundColor: p.surface2,
      selectedColor: p.primarySoft,
      side: BorderSide(color: selected ? p.primary : p.border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.full)),
      onSelected: (_) {
        setState(() => _urlController.text = url);
        _testConnection();
      },
    );
  }
}
