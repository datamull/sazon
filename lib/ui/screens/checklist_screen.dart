import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../state/app_state.dart';
import '../../utils/naming.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/ingredient_row.dart';
import 'cook_screen.dart';
import 'recipe_screen.dart';

class ChecklistScreen extends StatelessWidget {
  const ChecklistScreen({super.key, required this.session});
  final RecipeSession session;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = context.c;
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final r = session.recipe;
        final n = r.ingredients.length;
        final got = session.have.length;
        final all = got >= n;
        final miss = missingList(app, session);
        void cook() => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => CookScreen(session: session)),
        );
        return Scaffold(
          appBar: sazonBar(context),
          bottomNavigationBar: Dock(
            children: [
              FilledButton.icon(
                onPressed: all ? cook : null,
                iconAlignment: IconAlignment.end,
                icon: const Icon(Icons.arrow_forward),
                label: Text(app.t('start')),
              ),
              if (!all)
                TextButton(onPressed: cook, child: Text(app.t('startAnyway'))),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
            children: [
              Eyebrow(withParen(dishName(r.title, r.originalTitle))),
              const SizedBox(height: 4),
              Text(app.t('checkTitle'), style: displayStyle(28, c.ink)),
              const SizedBox(height: 4),
              Text(app.t('checkHint'), style: TextStyle(color: c.muted)),
              const SizedBox(height: 14),
              ClipRRect(
                borderRadius: BorderRadius.circular(5),
                child: LinearProgressIndicator(
                  value: n == 0 ? 0 : got / n,
                  minHeight: 10,
                  color: c.accent,
                  backgroundColor: c.sunk,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                '$got ${app.t('of')} $n · ${app.t('have')}',
                style: TextStyle(fontSize: 14, color: c.muted),
              ),
              const SizedBox(height: 6),
              for (var i = 0; i < n; i++)
                IngredientRow(session: session, index: i, withCheck: true),
              const SizedBox(height: 20),
              if (miss.isEmpty)
                Row(
                  children: [
                    Icon(Icons.check_circle, color: c.accent),
                    const SizedBox(width: 8),
                    Text(
                      app.t('allSet'),
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: c.accent,
                      ),
                    ),
                  ],
                )
              else
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: c.maizeSoft,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionTitle(app.t('shopping'), count: miss.length),
                      const SizedBox(height: 10),
                      SelectableText(
                        miss.map((m) => '• $m').join('\n'),
                        style: TextStyle(height: 1.7, color: c.ink),
                      ),
                      const SizedBox(height: 10),
                      OutlinedButton.icon(
                        onPressed: () async {
                          await Clipboard.setData(
                            ClipboardData(
                              text:
                                  '${withParen(dishName(r.title, r.originalTitle))}\n${miss.map((m) => '• $m').join('\n')}',
                            ),
                          );
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(app.t('copied'))),
                            );
                          }
                        },
                        icon: const Icon(Icons.copy),
                        label: Text(app.t('copy')),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
