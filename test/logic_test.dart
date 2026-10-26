import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sazon/state/app_state.dart';
import 'package:sazon/models/recipe.dart';
import 'package:sazon/services/shopping_plan.dart';
import 'package:sazon/utils/naming.dart';

Offer o(double p) => Offer(name: 'x', price: p, unit: '');

void main() {
  group('nombres', () {
    test('plato: nombre original primero y traducción entre paréntesis', () {
      final n = dishName('Pastel de carne y puré', 'Pâté chinois');
      expect(withParen(n), 'Pâté chinois (Pastel de carne y puré)');
    });
    test('plato: sin paréntesis si es el mismo nombre', () {
      expect(withParen(dishName('Poutine', 'Poutine')), 'Poutine');
      expect(withParen(dishName('Ajiaco colombiano', 'Receta de Ajiaco Colombiano')), 'Ajiaco colombiano');
      expect(withParen(dishName('Pastel de Choclo y Pollo (Pastel de Maíz y Pollo)', 'Pastel de Choclo y Pollo (Corn and Chicken Cake)')),
          'Pastel de Choclo y Pollo (Corn and Chicken Cake)');
    });
    test('ingrediente: francés primero si vive en Quebec y la app no está en francés', () {
      expect(withParen(ingredientName('cebollas', 'oignons jaunes', showFr: true)), 'oignons jaunes (cebollas)');
      expect(withParen(ingredientName('cebollas', 'oignons jaunes', showFr: false)), 'cebollas');
      expect(withParen(ingredientName('tofu', 'tofu', showFr: true)), 'tofu');
    });
    test('cantidades con fracciones', () {
      expect(qtyFmt(1.5), '1 ½');
      expect(qtyFmt(0.25), '¼');
      expect(qtyFmt(500), '500');
      expect(qtyFmt(null), '');
    });
  });

  group('plan de compra', () {
    const items = [
      BuyItem(id: '0', name: 'carne', fr: 'boeuf haché', query: 'boeuf haché'),
      BuyItem(id: '1', name: 'cebolla', fr: 'oignon', query: 'oignon'),
      BuyItem(id: '2', name: 'aceitunas', fr: 'olives', query: 'olives'),
    ];
    final prices = Prices(
      stores: ['Maxi', 'Metro', 'Super C'],
      offers: {
        '0': {'Maxi': o(5.44), 'Metro': o(9.99)},
        '1': {'Metro': o(3.99), 'Super C': o(2.49)},
        '2': {},
      },
      estimates: {
        '1': const Estimate(price: 4.94, size: '1 kg', source: 'statcan'),
        '2': const Estimate(price: 2.49, size: '398 ml', source: 'ai'),
      },
      aiUsed: true,
    );

    test('elige el súper más barato para la canasta y manda el resto al siguiente', () {
      final p = buildPlan(prices, items);
      expect(p.main, 'Maxi');
      expect(p.stops.first.rows.map((r) => r.item.id), ['0']);
      expect(p.stops[1].store, 'Super C');
      expect(p.stops[1].rows.map((r) => r.item.id), ['1']);
      expect(p.leftovers.single.$1.id, '2');
      expect(p.total, closeTo(5.44 + 2.49 + 2.49, 0.001));
    });

    test('respeta el súper elegido por el usuario', () {
      final p = buildPlan(prices, items, chosen: 'Metro');
      expect(p.main, 'Metro');
      expect(p.stops.first.rows.length, 2);
    });

    test('enlace de búsqueda en el sitio del súper', () {
      expect(storeSearchUrl('Maxi', 'boeuf haché').toString(), 'https://www.maxi.ca/fr/search?search-bar=boeuf+hach%C3%A9');
      expect(storeSearchUrl('Adonis', 'x'), isNull);
    });
  });

  test('receta desde JSON de la API', () {
    final r = Recipe.fromJson({
      'url': 'https://x',
      'source': 'Gourmet.cl',
      'title': 'Pastel de choclo',
      'originalTitle': 'Receta Pastel de Choclo',
      'summary': '',
      'aiUsed': true,
      'ingredients': [
        {'name': 'choclo', 'qty': 6, 'pantry': false, 'shopFr': 'maïs', 'fr': 'maïs en grains', 'availability': 'hard',
          'substitute': {'name': 'maíz congelado', 'why': 'parecido', 'shopFr': 'maïs surgelé'}},
      ],
      'steps': [{'text': 'Licuar', 'action': 'blend', 'minutes': null}],
    });
    expect(r.ingredients.single.substitute!.fr, 'maïs surgelé');
    expect(r.steps.single.action, 'blend');
  });

  group('perfil alimenticio', () {
    Recipe vegan() => Recipe.fromJson({
          'url': 'https://www.recetasnestle.cl/recetas/pastel-de-choclo',
          'source': 'Recetas Nestlé Chile',
          'title': 'Pastel de choclo',
          'summary': '',
          'aiUsed': true,
          'diet': ['gluten', 'vegan'],
          'dietAdapted': true,
          'dietOk': false,
          'dietNotes': ['Revisa que el caldo diga sin gluten.'],
          'ingredients': [
            {'name': 'carne molida', 'fr': 'bœuf haché', 'shopFr': 'boeuf haché', 'pantry': false, 'availability': 'common',
              'conflicts': ['vegan'], 'subReason': 'diet',
              'substitute': {'name': 'lentejas cocidas', 'why': 'textura parecida', 'fr': 'lentilles cuites', 'shopFr': 'lentilles'}},
            {'name': 'cebolla', 'fr': 'oignon', 'shopFr': 'oignon', 'pantry': false, 'availability': 'common', 'conflicts': []},
            {'name': 'miel', 'fr': 'miel', 'shopFr': 'miel', 'pantry': false, 'availability': 'common', 'conflicts': ['vegan']},
          ],
          'steps': [{'text': 'Cocinar', 'action': 'boil'}],
        });

    test('lee régimen, conflictos y consejos', () {
      final r = vegan();
      expect(r.diet, ['gluten', 'vegan']);
      expect(r.dietAdapted, isTrue);
      expect(r.dietNotes.single, contains('sin gluten'));
      expect(r.ingredients.first.conflicts, ['vegan']);
      expect(r.ingredients.first.subReason, 'diet');
    });

    test('el sustituto que cumple el régimen viene activado y entra a la compra', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final s = RecipeSession(vegan(), prefs, 'gluten,vegan');
      expect(s.useSub, {0});
      expect(s.effective(0).name, 'lentejas cocidas');
      expect(s.buyItems().first.query, 'lentilles');
      // sin sustituto (miel): se mantiene el original
      expect(s.effective(2).sub, isFalse);
    });

    test('lo elegido se guarda por régimen', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      RecipeSession(vegan(), prefs, 'gluten,vegan').toggleSub(0); // vuelve al original
      expect(RecipeSession(vegan(), prefs, 'gluten,vegan').useSub, isEmpty);
      expect(RecipeSession(vegan(), prefs, 'vegan').useSub, {0}); // otro régimen: valores por defecto
    });
  });
}
