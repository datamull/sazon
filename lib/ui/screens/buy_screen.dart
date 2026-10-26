import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../models/recipe.dart';
import '../../services/shopping_plan.dart';
import '../../state/app_state.dart';
import '../../utils/naming.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'checklist_screen.dart';

/// Paso opcional: dónde comprar, con ofertas de las circulares y precios regulares.
class BuyScreen extends StatefulWidget {
  const BuyScreen({super.key, required this.session});
  final RecipeSession session;
  @override
  State<BuyScreen> createState() => _BuyScreenState();
}

class _BuyScreenState extends State<BuyScreen> {
  bool _loading = false;
  String? _error;
  final _postal = TextEditingController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final app = AppScope.of(context);
    if (_postal.text.isEmpty) _postal.text = app.postal;
    if (widget.session.prices == null &&
        !_loading &&
        _error == null &&
        app.country == 'QC' &&
        app.validPostal) {
      _load();
    }
  }

  @override
  void dispose() {
    _postal.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final app = AppScope.of(context);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = widget.session.buyItems();
      final p = await app.api.prices(app.postal, [
        for (final i in items) (id: i.id, name: i.name, query: i.query),
      ]);
      widget.session.setPrices(p);
    } catch (e) {
      _error = friendlyError(app, e);
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = context.c;
    final s = widget.session;
    Widget body;
    if (app.country != 'QC') {
      body = Note(app.t('pricesOnlyCA'));
    } else if (!app.validPostal) {
      body = _postalForm(app);
    } else if (_loading || (s.prices == null && _error == null)) {
      body = Loading(app.t('loadingPrices'));
    } else if (_error != null) {
      body = ErrorBox(message: _error!, onRetry: _load);
    } else {
      body = ListenableBuilder(
        listenable: s,
        builder: (context, _) => _PlanView(session: s),
      );
    }
    return Scaffold(
      appBar: sazonBar(context),
      bottomNavigationBar: Dock(
        children: [
          FilledButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => ChecklistScreen(session: s)),
            ),
            iconAlignment: IconAlignment.end,
            icon: const Icon(Icons.arrow_forward),
            label: Text(app.t('toChecklist')),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
        children: [
          Eyebrow(withParen(dishName(s.recipe.title, s.recipe.originalTitle))),
          const SizedBox(height: 4),
          Text(app.t('buyTitle'), style: displayStyle(28, c.ink)),
          const SizedBox(height: 12),
          body,
        ],
      ),
    );
  }

  Widget _postalForm(AppState app) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            app.t('postal'),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _postal,
                  textCapitalization: TextCapitalization.characters,
                  maxLength: 7,
                  decoration: const InputDecoration(
                    hintText: 'G1R 4S9',
                    counterText: '',
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: () async {
                  await app.save(postal: _postal.text);
                  if (app.validPostal) _load();
                },
                child: const Icon(Icons.search),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            app.t('postalHint'),
            style: TextStyle(fontSize: 13, color: c.muted),
          ),
        ],
      ),
    );
  }
}

class _PlanView extends StatelessWidget {
  const _PlanView({required this.session});
  final RecipeSession session;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = context.c;
    final items = session.buyItems();
    if (items.isEmpty) {
      return Text(app.t('nothingToBuy'), style: TextStyle(color: c.muted));
    }
    final prices = session.prices!;
    final plan = buildPlan(prices, items, chosen: session.mainStore);
    final money = NumberFormat.simpleCurrency(
      locale: app.lang == 'en' ? 'en_CA' : 'fr_CA',
      name: 'CAD',
    );
    final date = DateFormat.MMMd(app.lang == 'en' ? 'en' : app.lang);
    final month = DateFormat.yMMM(app.lang == 'en' ? 'en' : app.lang);

    Widget row(
      BuyItem it,
      double? price,
      String sub, {
      Estimate? est,
      bool isEst = false,
      String? store,
    }) {
      final link = storeSearchUrl(store, it.query);
      final n = ingredientName(it.name, it.fr, showFr: app.showFr);
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.line)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    n.main,
                    style: TextStyle(fontWeight: FontWeight.w600, color: c.ink),
                  ),
                  if (n.translation != null)
                    Text(
                      '(${n.translation})',
                      style: TextStyle(fontSize: 13, color: c.muted),
                    ),
                  if (sub.isNotEmpty)
                    Text(sub, style: TextStyle(fontSize: 13, color: c.muted)),
                  if (isEst && price != null)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: est?.source == 'statcan' ? c.accentSoft : c.sunk,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        est?.source == 'statcan'
                            ? '${app.t('statAvg')} · ${est?.period != null ? month.format(DateTime.parse('${est!.period}-15')) : ''}'
                            : app.t('aiEst'),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: est?.source == 'statcan' ? c.accent : c.muted,
                        ),
                      ),
                    ),
                  if (link != null)
                    InkWell(
                      onTap: () =>
                          launchUrl(link, mode: LaunchMode.externalApplication),
                      child: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${app.t('seeAt')} $store',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: c.accent,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(Icons.open_in_new, size: 13, color: c.accent),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              price == null
                  ? '—'
                  : '${isEst ? '${app.t('est')} ' : ''}${money.format(price)}',
              style: TextStyle(
                fontWeight: isEst ? FontWeight.w600 : FontWeight.w700,
                color: isEst ? c.muted : c.ink,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      );
    }

    Widget card({
      required Widget badge,
      required String eyebrow,
      required String title,
      String? subtitle,
      String? total,
      required List<Widget> rows,
      bool main = false,
    }) => Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: main ? c.accent : c.line,
          width: main ? 2 : 1,
        ),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: c.line)),
            ),
            child: Row(
              children: [
                badge,
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (eyebrow.isNotEmpty) Eyebrow(eyebrow),
                      Text(
                        title,
                        style: displayStyle(20, c.ink, weight: FontWeight.w700),
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle,
                          style: TextStyle(fontSize: 13, color: c.muted),
                        ),
                    ],
                  ),
                ),
                if (total != null) Text(total, style: displayStyle(18, c.ink)),
              ],
            ),
          ),
          ...rows,
        ],
      ),
    );

    Widget badge(String text, Color bg, Color fg) => Container(
      width: 34,
      height: 34,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      child: Text(text, style: displayStyle(16, fg)),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            color: c.ink,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(app.t('total'), style: TextStyle(color: c.bg)),
              ),
              Text(money.format(plan.total), style: displayStyle(28, c.bg)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        for (var k = 0; k < plan.stops.length; k++)
          card(
            main: plan.stops[k].main,
            badge: badge('${k + 1}', c.accentSoft, c.accent),
            eyebrow: app.t(plan.stops[k].main ? 'mainStore' : 'secondStop'),
            title: plan.stops[k].store,
            total: money.format(plan.stops[k].total),
            rows: [
              for (final r in plan.stops[k].rows)
                row(
                  r.item,
                  r.offer.price,
                  [
                    r.offer.name,
                    r.offer.unit,
                    if (r.offer.validTo != null)
                      '${app.t('validTo')} ${date.format(r.offer.validTo!.toLocal())}',
                  ].where((x) => x.isNotEmpty).join(' · '),
                  store: plan.stops[k].store,
                ),
            ],
          ),
        if (plan.leftovers.isNotEmpty)
          card(
            badge: Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: c.maizeSoft,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.info_outline, size: 18, color: c.ink),
            ),
            eyebrow: '',
            title: app.t('noOffer'),
            subtitle: app.t('noOfferHint'),
            rows: [
              for (final l in plan.leftovers)
                row(
                  l.$1,
                  l.$2?.price,
                  [
                    l.$2?.product ?? '',
                    l.$2?.size ?? '',
                  ].where((x) => x.isNotEmpty).join(' · '),
                  est: l.$2,
                  isEst: true,
                  store: plan.main,
                ),
            ],
          ),
        if (plan.ranked.length > 1)
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: Text(
                app.t('otherStores'),
                style: TextStyle(fontWeight: FontWeight.w700, color: c.accent),
              ),
              children: [
                for (final r in plan.ranked)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Material(
                      color: r.store == plan.main ? c.accentSoft : c.surface,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: r.store == plan.main ? c.accent : c.line,
                          width: 1.5,
                        ),
                      ),
                      child: ListTile(
                        onTap: () => session.chooseMain(r.store),
                        title: Text(
                          r.store,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          '${r.cover}/${items.length} ${app.t('covers')}',
                        ),
                        trailing: Text(
                          money.format(r.cost),
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 10),
        Text(
          app.t('pricesNote'),
          style: TextStyle(fontSize: 13, color: c.muted),
        ),
        if (prices.statcanUrl != null)
          InkWell(
            onTap: () => launchUrl(
              Uri.parse(prices.statcanUrl!),
              mode: LaunchMode.externalApplication,
            ),
            child: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Statistique Canada, 18-10-0245-01',
                style: TextStyle(
                  fontSize: 13,
                  color: c.accent,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
