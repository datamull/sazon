import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/recipe.dart';

/// Servidor de Sazón (funciones de Netlify). Se puede cambiar al compilar:
/// flutter build ipa --dart-define=API_BASE=https://otro-sitio.netlify.app
const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'https://sazon-cocina.netlify.app');

class ApiException implements Exception {
  final String message;
  final String? code;
  ApiException(this.message, [this.code]);
  @override
  String toString() => message;
}

class SazonApi {
  SazonApi({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;

  // Recetas ya adaptadas en esta sesión (idioma + país + url)
  final Map<String, Recipe> _cache = {};

  Future<Map<String, dynamic>> _get(String path, Map<String, String> params, Duration timeout) async {
    final uri = Uri.parse('$apiBase$path').replace(queryParameters: {...params, 'v': '3'});
    return _decode(await _client.get(uri).timeout(timeout));
  }

  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic>? body;
    try {
      body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    } catch (_) {}
    if (res.statusCode >= 400 || body == null) {
      final err = body?['error'] as Map<String, dynamic>?;
      throw ApiException(err?['message']?.toString() ?? 'HTTP ${res.statusCode}', err?['code']?.toString());
    }
    return body;
  }

  Future<List<SearchHit>> search(String q, {String? country, required String lang}) async {
    final d = await _get('/api/search', {'q': q, 'lang': lang, 'country': ?country}, const Duration(seconds: 45));
    return [for (final r in (d['results'] as List? ?? [])) SearchHit.fromJson(r as Map<String, dynamic>)];
  }

  Future<Recipe> recipe(String url, {required String lang, required String country}) async {
    final key = '$lang|$country|$url';
    final hit = _cache[key];
    if (hit != null) return hit;
    final r = Recipe.fromJson(await _get('/api/recipe', {'url': url, 'lang': lang, 'country': country}, const Duration(seconds: 90)));
    if (r.aiUsed) _cache[key] = r;
    return r;
  }

  Future<Prices> prices(String postal, List<({String id, String name, String query})> items) async {
    final res = await _client
        .post(
          Uri.parse('$apiBase/api/prices'),
          headers: {'content-type': 'application/json'},
          body: jsonEncode({
            'postal': postal,
            'items': [for (final i in items) {'id': i.id, 'name': i.name, 'query': i.query}],
          }),
        )
        .timeout(const Duration(seconds: 90));
    return Prices.fromJson(_decode(res));
  }
}
