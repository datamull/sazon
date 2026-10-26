import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../state/app_state.dart';
import '../../utils/naming.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/ingredient_row.dart';
import 'buy_screen.dart';
import 'checklist_screen.dart';

class RecipeScreen extends StatefulWidget {
  const RecipeScreen({super.key, required this.url});
  final String url;
  @override
  State<RecipeScreen> createState() => _RecipeScreenState();
}

class _RecipeScreenState extends State<RecipeScreen> {
  Future<RecipeSession>? _future;
  String? _key;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final app = AppScope.of(context);
    // si cambian idioma o país, la receta se vuelve a adaptar
    final key = '${app.lang}|${app.country}';
    if (_key != key) {
      _key = key;
      _load();
    }
  }

  void _load() {
    final app = AppScope.of(context);
    _future = app.api.recipe(widget.url, lang: app.lang, country: app.country).then(app.session);
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return FutureBuilder<RecipeSession>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return Scaffold(appBar: sazonBar(context), body: Padding(padding: const EdgeInsets.all(18), child: Loading(app.t('loadingRecipe'))));
        }
        if (snap.hasError) {
          return Scaffold(
            appBar: sazonBar(context),
            body: Padding(
              padding: const EdgeInsets.all(18),
              child: ErrorBox(message: friendlyError(app, snap.error!), onRetry: () => setState(_load)),
            ),
          );
        }
        return ListenableBuilder(listenable: snap.data!, builder: (context, _) => _RecipeView(session: snap.data!));
      },
    );
  }
}

class _RecipeView extends StatelessWidget {
  const _RecipeView({required this.session});
  final RecipeSession session;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = context.c;
    final r = session.recipe;
    final n = dishName(r.title, r.originalTitle);
    return Scaffold(
      appBar: sazonBar(context),
      bottomNavigationBar: Dock(children: [
        FilledButton.icon(
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ChecklistScreen(session: session))),
          iconAlignment: IconAlignment.end,
          icon: const Icon(Icons.arrow_forward),
          label: Text(app.t('toChecklist')),
        ),
      ]),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          if (r.image != null)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(r.image!, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink()),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(n.main, style: displayStyle(32, c.ink)),
                if (n.translation != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('(${n.translation})', style: displayStyle(18, c.muted, weight: FontWeight.w600)),
                  ),
                if (r.summary.isNotEmpty)
                  Padding(padding: const EdgeInsets.only(top: 8), child: Text(r.summary, style: TextStyle(color: c.muted, height: 1.4))),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(border: Border.symmetric(horizontal: BorderSide(color: c.line))),
                  child: Wrap(
                    spacing: 22,
                    runSpacing: 8,
                    children: [
                      if (r.servings != null) _Fact(app.t('servings'), Text(r.servings!)),
                      if (r.time != null) _Fact(app.t('time'), Text(r.time!)),
                      _Fact(
                        app.t('from'),
                        InkWell(
                          onTap: () => launchUrl(Uri.parse(r.url), mode: LaunchMode.externalApplication),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Text(r.source, style: TextStyle(color: c.accent, decoration: TextDecoration.underline)),
                            const SizedBox(width: 4),
                            Icon(Icons.open_in_new, size: 14, color: c.accent),
                          ]),
                        ),
                      ),
                    ],
                  ),
                ),
                if (!r.aiUsed) ...[
                  const SizedBox(height: 14),
                  Note(
                    '${app.t('aiOff')} ${r.aiError == 'no_key' ? app.t('aiOffKey') : r.aiError == 'rate_limited' ? app.t('aiOffQuota') : ''}',
                    warn: true,
                  ),
                ],
                const SizedBox(height: 24),
                SectionTitle(app.t('ingredients'), count: r.ingredients.length),
                const SizedBox(height: 6),
                for (var i = 0; i < r.ingredients.length; i++) IngredientRow(session: session, index: i),
                const SizedBox(height: 22),
                _BuyCta(session: session),
                const SizedBox(height: 30),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact(this.label, this.value);
  final String label;
  final Widget value;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Eyebrow(label),
          DefaultTextStyle.merge(style: TextStyle(fontWeight: FontWeight.w700, color: context.c.ink), child: value),
        ],
      );
}

class _BuyCta extends StatelessWidget {
  const _BuyCta({required this.session});
  final RecipeSession session;
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = context.c;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Eyebrow(app.t('buyOptional')),
          const SizedBox(height: 2),
          Text(app.t('buyTitle'), style: displayStyle(20, c.ink, weight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(app.t('buyHint'), style: TextStyle(color: c.muted)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => BuyScreen(session: session))),
            icon: const Icon(Icons.shopping_cart_outlined),
            label: Text(app.t('buyTitle')),
          ),
        ],
      ),
    );
  }
}

/// Lista de lo que falta, con nombre en francés primero (para mostrar en el súper).
List<String> missingList(AppState app, RecipeSession s) {
  final out = <String>[];
  for (var i = 0; i < s.recipe.ingredients.length; i++) {
    if (s.have.contains(i)) continue;
    final ing = s.recipe.ingredients[i];
    final e = s.effective(i);
    final amount = [qtyFmt(ing.qty), ing.unit ?? ''].where((x) => x.isNotEmpty).join(' ');
    out.add('${amount.isEmpty ? '' : '$amount '}${withParen(ingredientName(e.name, e.fr, showFr: app.showFr))}');
  }
  return out;
}

