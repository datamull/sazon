import 'package:flutter/material.dart';

import '../../l10n/strings_data.dart';
import '../../models/recipe.dart';
import '../../state/app_state.dart';
import '../../utils/naming.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'home_screen.dart';
import 'recipe_screen.dart';

class ResultsScreen extends StatefulWidget {
  const ResultsScreen({super.key, required this.query, this.country});
  final String query;
  final String? country;
  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  late final _q = TextEditingController(text: widget.query);
  late String _query = widget.query;
  String? _country;
  Future<SearchResult>? _future;
  String? _key;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final app = AppScope.of(context);
    // al cambiar de idioma o régimen, se vuelve a buscar (títulos traducidos, recetas aptas primero)
    if (_future == null || _key != '${app.lang}|${app.dietParam}') _load();
  }

  void _load() {
    final app = AppScope.of(context);
    _key = '${app.lang}|${app.dietParam}';
    _country ??= widget.country;
    _future = app.api.search(
      _query,
      country: _country,
      lang: app.lang,
      diet: app.dietParam,
    );
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = context.c;
    return Scaffold(
      appBar: sazonBar(context),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 40),
          children: [
            SearchField(
              controller: _q,
              onSubmit: (q) {
                if (q.trim().length < 2) return;
                setState(() {
                  _query = q.trim();
                  _country = null;
                  _load();
                });
              },
            ),
            const SizedBox(height: 20),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: '${app.t('resultsFor')} ',
                    style: displayStyle(26, c.ink),
                  ),
                  TextSpan(text: _query, style: displayStyle(26, c.accent)),
                ],
              ),
            ),
            const SizedBox(height: 14),
            FutureBuilder<SearchResult>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) {
                  return Loading(app.t('searching'));
                }
                if (snap.hasError) {
                  return ErrorBox(
                    message: friendlyError(app, snap.error!),
                    onRetry: () => setState(_load),
                  );
                }
                final res = snap.data!;
                if (res.hits.isEmpty) {
                  return Text(
                    app.t('noResults'),
                    style: TextStyle(color: c.muted),
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (res.country != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Text(
                          '${app.t('sourcesOf')} ${app.countryName(res.country!)}: ${recipeSources[res.country]}',
                          style: TextStyle(fontSize: 13, color: c.muted),
                        ),
                      ),
                    for (final h in res.hits) _ResultCard(hit: h),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.hit});
  final SearchHit hit;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = context.c;
    final n = dishName(hit.title, hit.originalTitle);
    final pill = switch (hit.country) {
      'QC' => (c.accentSoft, c.accent),
      'CO' => (c.maizeSoft, c.ink),
      _ => (c.chileSoft, c.chile),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: c.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: c.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => RecipeScreen(url: hit.url)),
          ),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 108,
                  child: Container(
                    color: c.sunk,
                    constraints: const BoxConstraints(minHeight: 96),
                    child: hit.image == null
                        ? Icon(Icons.soup_kitchen_outlined, color: c.muted)
                        : Image.network(
                            hit.image!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => Icon(
                              Icons.soup_kitchen_outlined,
                              color: c.muted,
                            ),
                          ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          n.main,
                          style: displayStyle(
                            17,
                            c.ink,
                            weight: FontWeight.w700,
                          ),
                        ),
                        if (n.translation != null)
                          Text(
                            '(${n.translation})',
                            style: TextStyle(fontSize: 13, color: c.muted),
                          ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: pill.$1,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                app.countryName(hit.country),
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: pill.$2,
                                ),
                              ),
                            ),
                            Text(
                              hit.sourceName,
                              style: TextStyle(fontSize: 13, color: c.muted),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
