import 'package:flutter/material.dart';

import '../../state/app_state.dart';
import '../../utils/naming.dart';
import '../theme.dart';

/// Fila de ingrediente: cantidad, nombre en francés (si vives en Quebec) y traducción entre paréntesis,
/// aviso de sustituto y, en el checklist, la casilla "lo tengo".
class IngredientRow extends StatelessWidget {
  const IngredientRow({
    super.key,
    required this.session,
    required this.index,
    this.withCheck = false,
  });
  final RecipeSession session;
  final int index;
  final bool withCheck;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = context.c;
    final ing = session.recipe.ingredients[index];
    final e = session.effective(index);
    final n = ingredientName(e.name, e.fr, showFr: app.showFr);
    final amount = [
      qtyFmt(ing.qty),
      ing.unit ?? '',
    ].where((x) => x.isNotEmpty).join(' ');
    final done = withCheck && session.have.contains(index);

    final label = Wrap(
      spacing: 8,
      runSpacing: 2,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (amount.isNotEmpty)
          Text(
            amount,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: c.ink,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        Text(
          n.main,
          style: TextStyle(
            fontSize: 16,
            fontWeight: e.sub ? FontWeight.w700 : FontWeight.w500,
            color: done ? c.muted : (e.sub ? c.accent : c.ink),
            decoration: done ? TextDecoration.lineThrough : null,
          ),
        ),
        if (n.translation != null)
          Text(
            '(${n.translation})',
            style: TextStyle(fontSize: 14, color: c.muted),
          ),
        if (e.sub)
          Text(
            withParen(ingredientName(ing.name, ing.fr, showFr: app.showFr)),
            style: TextStyle(
              fontSize: 13,
              color: c.muted,
              decoration: TextDecoration.lineThrough,
            ),
          ),
        if (ing.note != null)
          Text(ing.note!, style: TextStyle(fontSize: 14, color: c.muted)),
        if (ing.pantry)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: c.sunk,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              app.t('pantry').toUpperCase(),
              style: TextStyle(
                fontSize: 10,
                letterSpacing: 0.8,
                color: c.muted,
              ),
            ),
          ),
        // en el checklist: aviso si dejaste el original y no cumple tu régimen
        if (withCheck && ing.conflicts.isNotEmpty && !e.sub)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: c.chileSoft,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '${app.t('notSuitable')} ${app.dietNames(ing.conflicts)}',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: c.chile,
              ),
            ),
          ),
      ],
    );

    final sub = ing.substitute;
    final dietTxt = ing.conflicts.isEmpty
        ? ''
        : '${app.t('notSuitable')} ${app.dietNames(ing.conflicts)}.';
    final availTxt = ing.availability == 'common'
        ? ''
        : '${app.t(ing.availability == 'hard' ? 'hard' : 'specialty')} ${app.countryName(app.country)}.';
    final headline = [dietTxt, availTxt].where((x) => x.isNotEmpty).join(' ');
    // colores: verde si es por tu régimen, rojo si es difícil de encontrar, amarillo si es de tienda especializada
    final (Color bg, Color edge) = ing.conflicts.isNotEmpty
        ? (c.accentSoft, c.accent)
        : ing.availability == 'hard'
        ? (c.chileSoft, c.chile)
        : (c.maizeSoft, c.maize);
    Widget box(List<Widget> children) => Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
      decoration: BoxDecoration(
        color: bg,
        border: Border(left: BorderSide(color: edge, width: 3)),
        borderRadius: const BorderRadius.horizontal(right: Radius.circular(10)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
    Widget? flag;
    if (!withCheck && sub != null && headline.isNotEmpty) {
      flag = box([
        Text.rich(
          TextSpan(
            style: TextStyle(fontSize: 14, color: c.ink),
            children: [
              TextSpan(
                text: '$headline ',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              TextSpan(text: '${app.t('substitute')}: '),
              TextSpan(
                text: withParen(
                  ingredientName(sub.name, sub.fr, showFr: app.showFr),
                ),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              TextSpan(text: ' — ${sub.why}'),
            ],
          ),
        ),
        TextButton(
          style: TextButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: const Size(0, 36),
          ),
          onPressed: () => session.toggleSub(index),
          child: Text(
            app.t(session.useSub.contains(index) ? 'useOriginal' : 'useSub'),
          ),
        ),
      ]);
    } else if (!withCheck && ing.conflicts.isNotEmpty) {
      // no cumple el régimen y no hay un buen sustituto
      flag = box([
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text.rich(
            TextSpan(
              style: TextStyle(fontSize: 14, color: c.ink),
              children: [
                TextSpan(
                  text: '$dietTxt ',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                TextSpan(text: app.t('noDietSub')),
              ],
            ),
          ),
        ),
      ]);
    }

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [label, ?flag],
    );

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.line)),
      ),
      padding: EdgeInsets.symmetric(vertical: withCheck ? 4 : 12),
      child: withCheck
          ? InkWell(
              onTap: () => session.toggleHave(index),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      value: done,
                      onChanged: (_) => session.toggleHave(index),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: content,
                      ),
                    ),
                  ],
                ),
              ),
            )
          : content,
    );
  }
}
