import '../models/recipe.dart';

/// Ingrediente a comprar (ya con el sustituto aplicado si el usuario lo eligió).
class BuyItem {
  final String id;
  final String name;
  final String fr;
  final String query;
  const BuyItem({
    required this.id,
    required this.name,
    required this.fr,
    required this.query,
  });
}

class PlanRow {
  final BuyItem item;
  final Offer offer;
  const PlanRow(this.item, this.offer);
}

class PlanStop {
  final String store;
  final bool main;
  final List<PlanRow> rows;
  const PlanStop(this.store, this.main, this.rows);
  double get total => rows.fold(0, (a, r) => a + r.offer.price);
}

class RankedStore {
  final String store;
  final int cover;
  final double cost;
  const RankedStore(this.store, this.cover, this.cost);
}

class ShoppingPlan {
  final List<RankedStore> ranked;
  final String? main;
  final List<PlanStop> stops;

  /// Lo que no está en oferta en ninguna parada: precio regular (StatCan o IA) si existe.
  final List<(BuyItem, Estimate?)> leftovers;
  final double total;
  const ShoppingPlan(
    this.ranked,
    this.main,
    this.stops,
    this.leftovers,
    this.total,
  );
}

/// Elige el supermercado más barato para la canasta completa (oferta si existe; si no, precio
/// regular estimado) y manda lo que no está en oferta ahí al siguiente más barato (máx. 3 paradas).
ShoppingPlan buildPlan(Prices prices, List<BuyItem> items, {String? chosen}) {
  Offer? offer(String id, String s) => prices.offers[id]?[s];
  double fallback(String id) {
    final est = prices.estimates[id]?.price;
    if (est != null) return est;
    final ps = (prices.offers[id]?.values.map((o) => o.price).toList() ?? [])
      ..sort();
    return ps.isEmpty ? 0 : ps[ps.length ~/ 2];
  }

  final ranked =
      [
        for (final s in prices.stores)
          RankedStore(
            s,
            items.where((it) => offer(it.id, s) != null).length,
            items.fold(
              0.0,
              (a, it) => a + (offer(it.id, s)?.price ?? fallback(it.id)),
            ),
          ),
      ].where((r) => r.cover > 0).toList()..sort((a, b) {
        final c = a.cost.compareTo(b.cost);
        return c != 0 ? c : b.cover.compareTo(a.cover);
      });

  final main = chosen != null && ranked.any((r) => r.store == chosen)
      ? chosen
      : (ranked.isEmpty ? null : ranked.first.store);
  final stops = <PlanStop>[];
  var rest = List<BuyItem>.of(items);
  if (main != null) {
    stops.add(
      PlanStop(main, true, [
        for (final it in items)
          if (offer(it.id, main) != null) PlanRow(it, offer(it.id, main)!),
      ]),
    );
    rest = items.where((it) => offer(it.id, main) == null).toList();
    for (final r in ranked) {
      if (r.store == main || rest.isEmpty || stops.length >= 3) continue;
      final take = rest.where((it) => offer(it.id, r.store) != null).toList();
      if (take.isEmpty) continue;
      stops.add(
        PlanStop(r.store, false, [
          for (final it in take) PlanRow(it, offer(it.id, r.store)!),
        ]),
      );
      rest = rest.where((it) => !take.contains(it)).toList();
    }
  }
  final leftovers = [for (final it in rest) (it, prices.estimates[it.id])];
  final total =
      stops.fold(0.0, (a, s) => a + s.total) +
      leftovers.fold(0.0, (a, l) => a + (l.$2?.price ?? 0));
  return ShoppingPlan(ranked, main, stops, leftovers, total);
}

/// Enlace a la búsqueda del producto en el sitio del supermercado (la app no lee ese precio).
Uri? storeSearchUrl(String? store, String query) {
  if (store == null || query.isEmpty) return null;
  final q = Uri.encodeQueryComponent(query);
  final rules = <RegExp, String>{
    RegExp(r'^maxi', caseSensitive: false):
        'https://www.maxi.ca/fr/search?search-bar=$q',
    RegExp(r'provigo', caseSensitive: false):
        'https://www.provigo.ca/fr/search?search-bar=$q',
    RegExp(r'super ?c', caseSensitive: false):
        'https://www.superc.ca/fr/epicerie-en-ligne/recherche?filter=$q',
    RegExp(r'^metro', caseSensitive: false):
        'https://www.metro.ca/fr/epicerie-en-ligne/recherche?filter=$q',
    RegExp(r'^iga', caseSensitive: false): 'https://www.iga.net/fr/search?k=$q',
    RegExp(r'walmart', caseSensitive: false):
        'https://www.walmart.ca/fr/search?q=$q',
    RegExp(r'costco', caseSensitive: false):
        'https://www.costco.ca/CatalogSearch?keyword=$q',
    RegExp(r'voil', caseSensitive: false):
        'https://voila.ca/products/search?q=$q',
  };
  for (final e in rules.entries) {
    if (e.key.hasMatch(store)) return Uri.parse(e.value);
  }
  return null;
}
