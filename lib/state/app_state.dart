import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../l10n/strings_data.dart';
import '../models/recipe.dart';
import '../services/api.dart';
import '../services/shopping_plan.dart';

/// Ajustes del usuario + acceso a la API. Se guarda en el teléfono.
class AppState extends ChangeNotifier {
  AppState(this._prefs, {SazonApi? api}) : api = api ?? SazonApi() {
    lang = _prefs.getString('lang') ?? _deviceLang();
    country = _prefs.getString('country') ?? 'QC';
    postal = _prefs.getString('postal') ?? '';
  }

  final SharedPreferences _prefs;
  final SazonApi api;
  late String lang;
  late String country;
  late String postal;

  static String _deviceLang() {
    final l = WidgetsBinding.instance.platformDispatcher.locale.languageCode;
    return const ['es', 'fr', 'en'].contains(l) ? l : 'es';
  }

  String t(String key) => uiStrings[lang]?[key] ?? uiStrings['es']![key] ?? key;
  String countryName(String c) => t('country$c');

  bool get validPostal => RegExp(r'^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$').hasMatch(postal.trim());

  Future<void> save({String? lang, String? country, String? postal}) async {
    if (lang != null) this.lang = lang;
    if (country != null) this.country = country;
    if (postal != null) this.postal = postal.trim().toUpperCase();
    await _prefs.setString('lang', this.lang);
    await _prefs.setString('country', this.country);
    await _prefs.setString('postal', this.postal);
    notifyListeners();
  }

  /// Nombres para comprar en Quebec: si la app no está en francés, el nombre en francés va primero.
  bool get showFr => country == 'QC' && lang != 'fr';

  RecipeSession session(Recipe r) => RecipeSession(r, _prefs);
}

/// Lo que el usuario marca en una receta: sustitutos elegidos y lo que ya tiene.
class RecipeSession extends ChangeNotifier {
  RecipeSession(this.recipe, this._prefs) {
    final subs = _prefs.getString('subs:${recipe.url}');
    if (subs != null) {
      useSub = Set<int>.from(jsonDecode(subs) as List);
    } else {
      // por defecto, sustituto activado si el original es muy difícil de encontrar
      for (var i = 0; i < recipe.ingredients.length; i++) {
        final ing = recipe.ingredients[i];
        if (ing.substitute != null && ing.availability == 'hard') useSub.add(i);
      }
    }
    final have = _prefs.getString('have:${recipe.url}');
    if (have != null) this.have = Set<int>.from(jsonDecode(have) as List);
  }

  final Recipe recipe;
  final SharedPreferences _prefs;
  Set<int> useSub = {};
  Set<int> have = {};
  Prices? prices;
  String? mainStore;

  void toggleSub(int i) {
    useSub.contains(i) ? useSub.remove(i) : useSub.add(i);
    prices = null; // la canasta cambió
    _prefs.setString('subs:${recipe.url}', jsonEncode(useSub.toList()));
    notifyListeners();
  }

  void toggleHave(int i) {
    have.contains(i) ? have.remove(i) : have.add(i);
    _prefs.setString('have:${recipe.url}', jsonEncode(have.toList()));
    notifyListeners();
  }

  void setPrices(Prices? p) {
    prices = p;
    mainStore = null;
    notifyListeners();
  }

  void chooseMain(String s) {
    mainStore = s;
    notifyListeners();
  }

  /// Nombre efectivo (sustituto si está activado).
  ({String name, String fr, String query, bool sub}) effective(int i) {
    final ing = recipe.ingredients[i];
    final s = ing.substitute;
    if (useSub.contains(i) && s != null) return (name: s.name, fr: s.fr, query: s.shopFr, sub: true);
    return (name: ing.name, fr: ing.fr, query: ing.shopFr, sub: false);
  }

  List<BuyItem> buyItems() => [
        for (var i = 0; i < recipe.ingredients.length; i++)
          if (!recipe.ingredients[i].pantry)
            BuyItem(id: '$i', name: effective(i).name, fr: effective(i).fr, query: effective(i).query),
      ];
}

/// Acceso a AppState desde cualquier pantalla.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);

  static AppState of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
