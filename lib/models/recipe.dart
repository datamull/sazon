// Modelos que llegan desde la API de Netlify (/api/search, /api/recipe, /api/prices).

String _s(dynamic v) => v == null ? '' : v.toString();
double? _d(dynamic v) => v is num ? v.toDouble() : null;

class SearchHit {
  final String url;
  final String title;
  final String? originalTitle;
  final String sourceName;
  final String country;
  final String? image;

  const SearchHit({
    required this.url,
    required this.title,
    this.originalTitle,
    required this.sourceName,
    required this.country,
    this.image,
  });

  factory SearchHit.fromJson(Map<String, dynamic> j) => SearchHit(
    url: _s(j['url']),
    title: _s(j['title']).isEmpty ? _s(j['slugTitle']) : _s(j['title']),
    originalTitle: j['originalTitle'] as String?,
    sourceName: _s(j['sourceName']),
    country: _s(j['country']),
    image: j['image'] as String?,
  );
}

class Substitute {
  final String name;
  final String why;
  final String shopFr;
  final String fr;

  const Substitute({
    required this.name,
    required this.why,
    required this.shopFr,
    required this.fr,
  });

  factory Substitute.fromJson(Map<String, dynamic> j) => Substitute(
    name: _s(j['name']),
    why: _s(j['why']),
    shopFr: _s(j['shopFr']),
    fr: _s(j['fr']).isEmpty ? _s(j['shopFr']) : _s(j['fr']),
  );
}

class Ingredient {
  final String name;
  final double? qty;
  final String? unit;
  final String? note;
  final bool pantry;
  final String shopFr;
  final String fr;

  /// common | specialty | hard
  final String availability;
  final Substitute? substitute;

  /// regímenes del usuario que este ingrediente no cumple (gluten, lactose, vegetarian, vegan)
  final List<String> conflicts;

  /// availability | diet | both | null
  final String? subReason;

  const Ingredient({
    required this.name,
    this.qty,
    this.unit,
    this.note,
    required this.pantry,
    required this.shopFr,
    required this.fr,
    required this.availability,
    this.substitute,
    this.conflicts = const [],
    this.subReason,
  });

  factory Ingredient.fromJson(Map<String, dynamic> j) => Ingredient(
    name: _s(j['name']),
    qty: _d(j['qty']),
    unit: _s(j['unit']).isEmpty ? null : _s(j['unit']),
    note: _s(j['note']).isEmpty ? null : _s(j['note']),
    pantry: j['pantry'] == true,
    shopFr: _s(j['shopFr']),
    fr: _s(j['fr']).isEmpty ? _s(j['shopFr']) : _s(j['fr']),
    availability: _s(j['availability']).isEmpty
        ? 'common'
        : _s(j['availability']),
    substitute: j['substitute'] is Map<String, dynamic>
        ? Substitute.fromJson(j['substitute'])
        : null,
    conflicts: [for (final d in (j['conflicts'] as List? ?? [])) d.toString()],
    subReason: j['subReason'] as String?,
  );
}

class CookStep {
  final String text;
  final String action;
  final double? minutes;

  const CookStep({required this.text, required this.action, this.minutes});

  factory CookStep.fromJson(Map<String, dynamic> j) => CookStep(
    text: _s(j['text']),
    action: _s(j['action']).isEmpty ? 'mix' : _s(j['action']),
    minutes: _d(j['minutes']),
  );
}

class Recipe {
  final String url;
  final String source;
  final String? image;
  final String title;
  final String? originalTitle;
  final String summary;
  final String? servings;
  final String? time;
  final List<Ingredient> ingredients;
  final List<CookStep> steps;
  final bool aiUsed;
  final String? aiError;

  /// régimen con que se pidió la receta, y si la IA la adaptó
  final List<String> diet;
  final bool dietAdapted;
  final bool dietOk;
  final List<String> dietNotes;

  const Recipe({
    required this.url,
    required this.source,
    this.image,
    required this.title,
    this.originalTitle,
    required this.summary,
    this.servings,
    this.time,
    required this.ingredients,
    required this.steps,
    required this.aiUsed,
    this.aiError,
    this.diet = const [],
    this.dietAdapted = false,
    this.dietOk = true,
    this.dietNotes = const [],
  });

  factory Recipe.fromJson(Map<String, dynamic> j) => Recipe(
    url: _s(j['url']),
    source: _s(j['source']),
    image: j['image'] as String?,
    title: _s(j['title']),
    originalTitle: j['originalTitle'] as String?,
    summary: _s(j['summary']),
    servings: j['servings']?.toString(),
    time: j['time']?.toString(),
    ingredients: [
      for (final i in (j['ingredients'] as List? ?? []))
        Ingredient.fromJson(i as Map<String, dynamic>),
    ],
    steps: [
      for (final s in (j['steps'] as List? ?? []))
        CookStep.fromJson(s as Map<String, dynamic>),
    ],
    aiUsed: j['aiUsed'] == true,
    aiError: j['aiError'] as String?,
    diet: [for (final d in (j['diet'] as List? ?? [])) d.toString()],
    dietAdapted: j['dietAdapted'] == true,
    dietOk: j['dietOk'] != false,
    dietNotes: [for (final n in (j['dietNotes'] as List? ?? [])) n.toString()],
  );
}

/// Resultado de búsqueda: hasta 4 recetas del país de origen del plato.
class SearchResult {
  final String? country;
  final List<SearchHit> hits;
  const SearchResult(this.country, this.hits);
}

class Offer {
  final String name;
  final double price;
  final String unit;
  final DateTime? validTo;

  const Offer({
    required this.name,
    required this.price,
    required this.unit,
    this.validTo,
  });

  factory Offer.fromJson(Map<String, dynamic> j) => Offer(
    name: _s(j['name']),
    price: _d(j['price']) ?? 0,
    unit: _s(j['unit']),
    validTo: j['validTo'] == null ? null : DateTime.tryParse(_s(j['validTo'])),
  );
}

class Estimate {
  final double price;
  final String size;

  /// statcan | ai
  final String source;
  final String? product;
  final String? period;

  const Estimate({
    required this.price,
    required this.size,
    required this.source,
    this.product,
    this.period,
  });

  factory Estimate.fromJson(Map<String, dynamic> j) => Estimate(
    price: _d(j['price']) ?? 0,
    size: _s(j['size']),
    source: _s(j['source']).isEmpty ? 'ai' : _s(j['source']),
    product: j['product'] as String?,
    period: j['period'] as String?,
  );
}

class Prices {
  final List<String> stores;

  /// id de ingrediente → supermercado → oferta más barata
  final Map<String, Map<String, Offer>> offers;
  final Map<String, Estimate> estimates;
  final bool aiUsed;
  final String? statcanUrl;

  const Prices({
    required this.stores,
    required this.offers,
    required this.estimates,
    required this.aiUsed,
    this.statcanUrl,
  });

  factory Prices.fromJson(Map<String, dynamic> j) => Prices(
    stores: [for (final s in (j['stores'] as List? ?? [])) s.toString()],
    offers: {
      for (final e in (j['offers'] as Map<String, dynamic>? ?? {}).entries)
        e.key: {
          for (final o in (e.value as Map<String, dynamic>).entries)
            o.key: Offer.fromJson(o.value as Map<String, dynamic>),
        },
    },
    estimates: {
      for (final e in (j['estimates'] as Map<String, dynamic>? ?? {}).entries)
        e.key: Estimate.fromJson(e.value as Map<String, dynamic>),
    },
    aiUsed: j['aiUsed'] == true,
    statcanUrl: j['statcanUrl'] as String?,
  );
}
