import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/ai_status.dart';
import '../theme/app_theme.dart';

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
  String? _testResult;
  bool? _testSuccess;

  static const String _emulatorUrl = 'http://10.0.2.2:3001';
  static const String _wifiLanUrl = 'http://10.52.6.41:3001';
  static const String _desktopUrl = 'http://127.0.0.1:3001';

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: ApiService().baseUrl);
    _checkAI();
  }

  Future<void> _checkAI() async {
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
        _testResult = ok ? 'Connected! Server is reachable.' : 'Cannot reach server at this URL.';
      });
    }
  }

  Future<void> _save() async {
    final newUrl = _urlController.text.trim();
    if (newUrl.isNotEmpty) {
      await ApiService().updateBaseUrl(newUrl);
      if (mounted) {
        Navigator.pop(context);
        widget.onSaved();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.border),
      ),
      title: const Row(
        children: [
          Icon(Icons.tune, size: 20, color: AppColors.primary),
          SizedBox(width: 8),
          Text(
            'Settings & Connectivity',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.heading,
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Backend API URL',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.heading),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _urlController,
              style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
              decoration: InputDecoration(
                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                hintText: 'http://10.0.2.2:3001',
                hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(height: 8),
            // Quick preset chips
            const Text('Quick Presets:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textMuted)),
            const SizedBox(height: 4),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: [
                _buildPresetChip('Emulator', _emulatorUrl),
                _buildPresetChip('Wi-Fi Phone', _wifiLanUrl),
                _buildPresetChip('Desktop', _desktopUrl),
              ],
            ),
            const SizedBox(height: 10),
            // Test connection button
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: _isTesting ? null : _testConnection,
                  icon: _isTesting
                      ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 1.5))
                      : const Icon(Icons.wifi_find, size: 14, color: AppColors.primary),
                  label: const Text('Test Connection', style: TextStyle(fontSize: 12, color: AppColors.primary)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                ),
                if (_testResult != null) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _testResult!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: _testSuccess == true ? AppColors.success : AppColors.danger,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 14),
            const Text(
              'Ollama AI Status',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.heading),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: _isLoadingAI
                  ? const Center(child: SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)))
                  : Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _aiStatus?.connected == true ? AppColors.success : AppColors.warning,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _aiStatus?.connected == true ? 'AI Engine Online' : 'AI Engine Offline',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.heading),
                              ),
                              Text(
                                'Model: ${_aiStatus?.model ?? "nemotron-3-nano:30b"}',
                                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primarySubtle,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: const Row(
                children: [
                  Icon(Icons.palette_outlined, size: 16, color: AppColors.primary),
                  SizedBox(width: 8),
                  Text(
                    'Theme: Indigo & Cyan Minimalist',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.primary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        ),
        ElevatedButton(
          onPressed: _save,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          ),
          child: const Text('Save & Reconnect', style: TextStyle(color: Colors.white, fontSize: 13)),
        ),
      ],
    );
  }

  Widget _buildPresetChip(String label, String url) {
    return InkWell(
      onTap: () {
        setState(() => _urlController.text = url);
        _testConnection();
      },
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.backgroundTertiary,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColors.border),
        ),
        child: Text(
          label,
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
      ),
    );
  }
}
