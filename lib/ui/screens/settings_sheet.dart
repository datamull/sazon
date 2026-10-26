import 'package:flutter/material.dart';

import '../../state/app_state.dart';
import '../theme.dart';

Future<void> showSettingsSheet(BuildContext context) => showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.c.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => const _SettingsSheet(),
    );

class _SettingsSheet extends StatefulWidget {
  const _SettingsSheet();
  @override
  State<_SettingsSheet> createState() => _SettingsSheetState();
}

class _SettingsSheetState extends State<_SettingsSheet> {
  late final AppState app = AppScope.of(context);
  late String lang = app.lang;
  late String country = app.country;
  late final TextEditingController postal = TextEditingController(text: app.postal);

  @override
  void dispose() {
    postal.dispose();
    super.dispose();
  }

  Widget _seg<T>(String label, Map<T, String> options, T value, ValueChanged<T> onChanged) {
    final c = context.c;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final e in options.entries)
              ChoiceChip(
                label: Text(e.value),
                selected: e.key == value,
                onSelected: (_) => onChanged(e.key),
                selectedColor: c.accent,
                labelStyle: TextStyle(color: e.key == value ? c.accentInk : c.ink, fontWeight: FontWeight.w600),
                showCheckmark: false,
                side: BorderSide(color: e.key == value ? c.accent : c.line, width: 1.5),
                shape: const StadiumBorder(),
              ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 22, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(app.t('settings'), style: displayStyle(20, c.ink, weight: FontWeight.w700)),
            const SizedBox(height: 16),
            _seg(app.t('language'), const {'es': 'Español', 'fr': 'Français', 'en': 'English'}, lang, (v) => setState(() => lang = v)),
            const SizedBox(height: 16),
            _seg(app.t('liveIn'), {for (final k in const ['QC', 'CL', 'MX', 'CO']) k: app.countryName(k)}, country, (v) => setState(() => country = v)),
            const SizedBox(height: 16),
            Text('${app.t('postal')} (Canada)', style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            TextField(
              controller: postal,
              textCapitalization: TextCapitalization.characters,
              maxLength: 7,
              decoration: const InputDecoration(hintText: 'G1R 4S9', counterText: ''),
            ),
            const SizedBox(height: 4),
            Text(app.t('postalHint'), style: TextStyle(fontSize: 13, color: c.muted)),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton(onPressed: () => Navigator.pop(context), child: Text(app.t('close'))),
                const SizedBox(width: 10),
                FilledButton(
                  onPressed: () async {
                    await app.save(lang: lang, country: country, postal: postal.text);
                    if (context.mounted) Navigator.pop(context);
                  },
                  child: Text(app.t('save')),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
