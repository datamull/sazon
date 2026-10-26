import 'package:flutter/material.dart';

import '../../l10n/strings_data.dart';
import '../../state/app_state.dart';
import '../../utils/naming.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'results_screen.dart';
import 'settings_sheet.dart';

const _countries = ['QC', 'CL', 'MX', 'CO'];
const _marks = {'QC': '⚜', 'CL': '★', 'MX': '◆', 'CO': '●'};

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _tab;
  final _q = TextEditingController();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  void _search(String q, {String? country}) {
    if (q.trim().length < 2) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ResultsScreen(query: q.trim(), country: country),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = context.c;
    final tab = _tab ?? app.country;
    final dishes = popularDishes[tab]!;
    return Scaffold(
      appBar: sazonBar(context),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 26, 18, 40),
          children: [
            if (app.name.isNotEmpty) ...[
              Eyebrow('${app.t('hello')}, ${app.name}'),
              const SizedBox(height: 6),
            ],
            Text(app.t('tagline'), style: displayStyle(36, c.ink)),
            const SizedBox(height: 18),
            SearchField(controller: _q, onSubmit: (q) => _search(q)),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 40),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  shape: const StadiumBorder(),
                  textStyle: const TextStyle(
                    fontFamily: body,
                    fontWeight: FontWeight.w500,
                    fontSize: 14,
                  ),
                ),
                onPressed: () => showSettingsSheet(context),
                icon: Icon(Icons.eco_outlined, size: 18, color: c.accent),
                label: Text(
                  app.diet.isEmpty
                      ? app.t('addProfile')
                      : '${app.t('yourProfile')}: ${app.dietNames(app.diet)}',
                ),
              ),
            ),
            const SizedBox(height: 22),
            SizedBox(
              height: 42,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final k in _countries)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        avatar: Text(
                          _marks[k]!,
                          style: TextStyle(color: c.maize),
                        ),
                        label: Text(app.countryName(k)),
                        selected: tab == k,
                        showCheckmark: false,
                        onSelected: (_) => setState(() => _tab = k),
                        selectedColor: c.ink,
                        backgroundColor: c.surface,
                        labelStyle: TextStyle(
                          color: tab == k ? c.bg : c.ink,
                          fontWeight: FontWeight.w600,
                        ),
                        side: BorderSide(
                          color: tab == k ? c.ink : c.line,
                          width: 1.5,
                        ),
                        shape: const StadiumBorder(),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Eyebrow('${app.t('popular')} · ${app.countryName(tab)}'),
            const SizedBox(height: 8),
            Divider(height: 1, color: c.line),
            for (var i = 0; i < dishes.length; i++)
              InkWell(
                onTap: () => _search(dishes[i].q, country: tab),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    vertical: 14,
                    horizontal: 4,
                  ),
                  decoration: BoxDecoration(
                    border: Border(bottom: BorderSide(color: c.line)),
                  ),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 28,
                        child: Text(
                          (i + 1).toString().padLeft(2, '0'),
                          style: TextStyle(
                            fontSize: 12,
                            color: c.muted,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                      ),
                      Expanded(
                        child: _DishLabel(
                          dishName(
                            dishes[i].labels[app.lang] ?? dishes[i].q,
                            dishes[i].q,
                          ),
                        ),
                      ),
                      Icon(Icons.arrow_forward, size: 18, color: c.muted),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 18),
            Text(
              '${app.t('sourcesOf')} ${app.countryName(tab)}: ${recipeSources[tab]}',
              style: TextStyle(fontSize: 12, color: c.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class _DishLabel extends StatelessWidget {
  const _DishLabel(this.n);
  final ({String main, String? translation}) n;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: n.main,
            style: displayStyle(18, c.ink, weight: FontWeight.w700),
          ),
          if (n.translation != null)
            TextSpan(
              text: '  (${n.translation})',
              style: TextStyle(fontSize: 14, color: c.muted),
            ),
        ],
      ),
    );
  }
}

class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.controller,
    required this.onSubmit,
  });
  final TextEditingController controller;
  final ValueChanged<String> onSubmit;
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: controller,
            textInputAction: TextInputAction.search,
            onSubmitted: onSubmit,
            decoration: InputDecoration(hintText: app.t('searchPh')),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 54,
          height: 54,
          child: FilledButton(
            style: FilledButton.styleFrom(padding: EdgeInsets.zero),
            onPressed: () => onSubmit(controller.text),
            child: Icon(Icons.search, semanticLabel: app.t('search')),
          ),
        ),
      ],
    );
  }
}
