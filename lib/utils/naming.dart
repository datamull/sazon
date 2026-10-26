// Formato de nombres y cantidades (mismas reglas que la web).

String plain(String? t) => (t ?? '')
    .toLowerCase()
    .replaceAll(RegExp('[àáâä]'), 'a')
    .replaceAll(RegExp('[èéêë]'), 'e')
    .replaceAll(RegExp('[ìíîï]'), 'i')
    .replaceAll(RegExp('[òóôö]'), 'o')
    .replaceAll(RegExp('[ùúûü]'), 'u')
    .replaceAll('ç', 'c')
    .replaceAll('ñ', 'n')
    .replaceAll('œ', 'oe')
    .replaceAll(RegExp('[^a-z0-9]+'), ' ')
    .trim();

/// Quita "Receta de", "Recette", "Recipe for" del nombre publicado por el sitio.
String cleanOriginal(String? t) {
  final s = (t ?? '').replaceFirst(RegExp(r'^(receta|recette|recipe)\s+(de\s+|du\s+|for\s+)?', caseSensitive: false), '').trim();
  return s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

String _noParen(String t) => t.replaceAll(RegExp(r'\s*\([^)]*\)\s*$'), '').trim();

/// Nombre original del plato y su traducción (null si son iguales).
({String main, String? translation}) dishName(String translated, String? original) {
  final o = cleanOriginal(original);
  if (o.isEmpty || plain(o) == plain(translated)) return (main: translated, translation: null);
  // "Pastel de choclo (Corn cake)" y "Pastel de choclo (Pastel de maíz)": mismo plato, sin repetir
  if (plain(_noParen(o)) == plain(_noParen(translated))) return (main: o, translation: null);
  return (main: o, translation: translated);
}

/// Ingrediente: nombre en francés primero cuando corresponde, traducción entre paréntesis.
({String main, String? translation}) ingredientName(String name, String fr, {required bool showFr}) {
  if (showFr && fr.isNotEmpty && plain(fr) != plain(name)) return (main: fr, translation: name);
  return (main: name, translation: null);
}

String withParen(({String main, String? translation}) n) => n.translation == null ? n.main : '${n.main} (${n.translation})';

const _fractions = {25: '¼', 33: '⅓', 50: '½', 66: '⅔', 67: '⅔', 75: '¾'};

String qtyFmt(double? q) {
  if (q == null) return '';
  final whole = q.floor();
  final frac = ((q - whole) * 100).round();
  final f = frac == 0 ? '' : (_fractions[frac] ?? (q - whole).toStringAsFixed(2).replaceFirst(RegExp(r'^0'), ''));
  final w = whole == 0 ? '' : '$whole';
  if (w.isEmpty && f.isEmpty) return '0';
  return [w, f].where((x) => x.isNotEmpty).join(' ');
}
