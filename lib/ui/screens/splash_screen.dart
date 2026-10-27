import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../data/splash_art.dart';
import '../../l10n/strings_data.dart';
import '../../models/recipe.dart';
import '../../state/app_state.dart';
import '../../utils/naming.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'home_screen.dart';
import 'recipe_screen.dart';
import 'results_screen.dart';

// Colores fijos de la portada (un solo mundo visual, igual en claro y oscuro).
const _green = Color(0xFF2F6B3F);
const _cream = Color(0xFFF4F6EE);
const _maize = Color(0xFFE9B949);
const _ink = Color(0xFF1F2A1F);

/// Plato del día: rota cada día entre los 4 países (el mismo para todos ese día, igual que en la web).
({String country, PopularDish dish}) dailyDish([DateTime? now]) {
  final d = now ?? DateTime.now();
  final day =
      DateTime.utc(d.year, d.month, d.day).millisecondsSinceEpoch ~/ 86400000;
  final country = popularCountries[day % 4];
  final list = popularDishes[country]!;
  return (country: country, dish: list[(day ~/ 4) % list.length]);
}

/// Portada: olla animada (2,6 s) y luego el plato del día con "Cocinar hoy".
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  static const introMs = 2600;
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: introMs),
  );
  late final AnimationController _loop = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );
  final _daily = dailyDish();
  SearchHit? _hit;
  bool _showDaily = false;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final reduce = MediaQuery.of(context).disableAnimations;
    if (reduce) {
      _intro.value = 1;
    } else {
      _intro.forward();
      Future.delayed(const Duration(milliseconds: 1050), () {
        if (mounted) _loop.repeat();
      });
    }
    _prepare(reduce ? 300 : introMs);
  }

  /// Busca la receta del plato del día (adaptada al perfil) mientras corre la animación.
  Future<void> _prepare(int minMs) async {
    final app = AppScope.of(context);
    final found = () async {
      try {
        final res = await app.api.search(
          _daily.dish.q,
          country: _daily.country,
          lang: app.lang,
          diet: app.dietParam,
        );
        _hit =
            res.hits.where((h) => h.image != null).firstOrNull ??
            res.hits.firstOrNull;
        if (_hit?.image != null && mounted) {
          await precacheImage(
            NetworkImage(_hit!.image!),
            context,
          ).timeout(const Duration(milliseconds: 1500), onTimeout: () {});
        }
      } catch (_) {}
    }();
    // si la receta llega tarde (servidor recién despierto), la portada se actualiza sola
    unawaited(
      found.then((_) {
        if (mounted && _showDaily) setState(() {});
      }),
    );
    await Future.wait([
      Future.delayed(Duration(milliseconds: minMs)),
      found.timeout(Duration(milliseconds: minMs + 6000), onTimeout: () {}),
    ]);
    if (mounted) setState(() => _showDaily = true);
  }

  void _skipAnimation() {
    if (!_showDaily && _intro.isAnimating) _intro.value = 1;
  }

  void _goHome() => Navigator.of(context).pushReplacement(
    PageRouteBuilder(
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (_, a, _) =>
          FadeTransition(opacity: a, child: const HomeScreen()),
    ),
  );

  void _cookToday() {
    final nav = Navigator.of(context);
    _goHome();
    final next = _hit != null
        ? MaterialPageRoute(builder: (_) => RecipeScreen(url: _hit!.url))
        : MaterialPageRoute(
            builder: (_) =>
                ResultsScreen(query: _daily.dish.q, country: _daily.country),
          );
    nav.push(next);
  }

  @override
  void dispose() {
    _intro.dispose();
    _loop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return Scaffold(
      backgroundColor: _green,
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 500),
        child: _showDaily
            ? _DailyView(
                key: const ValueKey('daily'),
                country: _daily.country,
                dish: _daily.dish,
                hit: _hit,
                onCook: _cookToday,
                onAll: _goHome,
              )
            : GestureDetector(
                key: const ValueKey('intro'),
                behavior: HitTestBehavior.opaque,
                onTap: _skipAnimation,
                child: Stack(
                  children: [
                    Center(
                      child: _Intro(
                        intro: _intro,
                        loop: _loop,
                        tagline: app.t('tagline'),
                      ),
                    ),
                    Positioned(
                      right: 8,
                      bottom: 8,
                      child: SafeArea(
                        child: TextButton(
                          onPressed: _goHome,
                          style: TextButton.styleFrom(
                            foregroundColor: _cream.withValues(alpha: 0.8),
                          ),
                          child: Text(
                            app.t('skip'),
                            style: const TextStyle(
                              decoration: TextDecoration.none,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

/// Olla animada: caen los 4 ingredientes, burbujea, sale vapor y aparece "Sazón".
class _Intro extends StatelessWidget {
  const _Intro({
    required this.intro,
    required this.loop,
    required this.tagline,
  });
  final AnimationController intro;
  final AnimationController loop;
  final String tagline;

  static const _ms = _SplashScreenState.introMs;
  double _seg(double t, double startMs, double durMs) =>
      ((t * _ms - startMs) / durMs).clamp(0.0, 1.0);

  @override
  Widget build(BuildContext context) {
    final width = math.min(MediaQuery.of(context).size.width * 0.7, 300.0);
    return AnimatedBuilder(
      animation: Listenable.merge([intro, loop]),
      builder: (context, _) {
        final t = intro.value;
        final stageH = width * splashStageH / splashStageW;
        final k = width / splashStageW;
        Widget part(
          String key, {
          double dx = 0,
          double dy = 0,
          double rot = 0,
          double opacity = 1,
          double scale = 1,
        }) {
          final p = splashParts[key]!;
          return Positioned(
            left: p.x * k,
            top: p.y * k,
            width: p.w * k,
            height: p.h * k,
            child: Opacity(
              opacity: opacity.clamp(0.0, 1.0),
              child: Transform.translate(
                offset: Offset(dx, dy),
                child: Transform.rotate(
                  angle: rot * math.pi / 180,
                  child: Transform.scale(
                    scale: scale,
                    child: SvgPicture.string(p.svg),
                  ),
                ),
              ),
            ),
          );
        }

        // caída de cada ingrediente (igual que la animación CSS de la web)
        final drops = <Widget>[];
        for (var i = 0; i < splashDrops.length; i++) {
          final p = splashParts[splashDrops[i]]!;
          final s = _seg(t, 150 + i * 160, 620);
          if (s <= 0 || s >= 1) continue;
          final fall = Curves.easeIn.transform(math.min(s / 0.78, 1));
          final y = s < 0.78
              ? (-3.4 + fall * 3.58) * p.h * k
              : (0.18 + (s - 0.78) / 0.22 * 0.52) * p.h * k;
          drops.add(
            part(
              splashDrops[i],
              dy: y,
              rot: p.rot - 40 * (1 - fall),
              opacity: s < 0.78 ? 1 : 1 - (s - 0.78) / 0.22,
            ),
          );
        }
        // la olla "rebota" al recibir los ingredientes
        final b = _seg(t, 550, 750);
        final bump = b > 0 && b < 1
            ? math.sin(b * math.pi * 4) * (1 - b) * 0.06
            : 0.0;
        // burbujas y vapor
        final steam = _seg(t, 1150, 700);
        final sway = math.sin(loop.value * 2 * math.pi) * 2;
        final bubbles = <Widget>[];
        if (t * _ms > 1050) {
          for (var i = 0; i < 3; i++) {
            final v = (loop.value + i * 0.3) % 1.0;
            bubbles.add(
              Positioned(
                left: width * (0.40 + i * 0.10),
                top: stageH * 0.44 - v * width * 0.09,
                child: Opacity(
                  opacity: (v < 0.3 ? v / 0.3 : 1 - (v - 0.3) / 0.7) * 0.9,
                  child: Container(
                    width: width * 0.035,
                    height: width * 0.035,
                    decoration: const BoxDecoration(
                      color: _cream,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
            );
          }
        }
        final word = Curves.easeOut.transform(_seg(t, 1350, 550));
        final tag = Curves.easeOut.transform(_seg(t, 1550, 550));

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: width,
              height: stageH,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  if (steam > 0)
                    part('steam', opacity: steam, dy: (1 - steam) * 12 + sway),
                  ...drops,
                  ...bubbles,
                  Positioned.fill(
                    child: Transform(
                      alignment: const Alignment(0, 0.4),
                      transform: Matrix4.diagonal3Values(1 + bump, 1 - bump, 1),
                      child: Stack(children: [part('potBody'), part('rim')]),
                    ),
                  ),
                ],
              ),
            ),
            Transform.translate(
              offset: Offset(0, -6 + (1 - word) * 10),
              child: Opacity(
                opacity: word,
                child: Text(
                  'Sazón',
                  style: displayStyle(56, _cream).copyWith(
                    letterSpacing: -1.6,
                    decoration: TextDecoration.none,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Transform.translate(
              offset: Offset(0, (1 - tag) * 10),
              child: Opacity(
                opacity: tag,
                child: Text(
                  tagline,
                  style: const TextStyle(
                    fontFamily: body,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: _maize,
                    decoration: TextDecoration.none,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Plato del día: foto grande, nombre original y traducción, perfil y "Cocinar hoy".
class _DailyView extends StatelessWidget {
  const _DailyView({
    super.key,
    required this.country,
    required this.dish,
    required this.hit,
    required this.onCook,
    required this.onAll,
  });
  final String country;
  final PopularDish dish;
  final SearchHit? hit;
  final VoidCallback onCook;
  final VoidCallback onAll;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final label = dish.labels[app.lang] ?? dish.q;
    final tr = plain(label) != plain(dish.q) ? label : null;
    final photo = hit?.image;
    final eyebrow =
        '${app.name.isNotEmpty ? '${app.t('hello')}, ${app.name} · ' : ''}${app.t('dishOfDay')}'
            .toUpperCase();
    const marks = {'QC': '⚜', 'CL': '★', 'MX': '◆', 'CO': '●'};

    return Stack(
      fit: StackFit.expand,
      children: [
        if (photo != null)
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 1.08, end: 1),
            duration: const Duration(seconds: 6),
            curve: Curves.easeOut,
            builder: (_, s, child) => Transform.scale(scale: s, child: child),
            child: Image.network(
              photo,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const ColoredBox(color: _green),
            ),
          )
        else
          Align(
            alignment: const Alignment(0, -0.55),
            child: FractionallySizedBox(
              widthFactor: 0.8,
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8ECC8),
                  borderRadius: BorderRadius.circular(26),
                ),
                child: const AspectRatio(
                  aspectRatio: 3 / 2,
                  child: StepArt('serve'),
                ),
              ),
            ),
          ),
        if (photo != null)
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0, 0.22, 0.42, 0.72, 1],
                colors: [
                  Color(0x8C0E1810),
                  Color(0x000E1810),
                  Color(0x260E1810),
                  Color(0xE00E1810),
                  Color(0xFF142016),
                ],
              ),
            ),
          ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: _cream,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.soup_kitchen_outlined,
                        size: 20,
                        color: _green,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text('Sazón', style: displayStyle(22, _cream)),
                  ],
                ),
                const Spacer(),
                Text(
                  eyebrow,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.2,
                    color: _maize,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: _cream.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${marks[country]} ${app.countryName(country)}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: _cream,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  dish.q,
                  style: displayStyle(
                    48,
                    _cream,
                  ).copyWith(height: 0.98, letterSpacing: -1.4),
                ),
                if (tr != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '($tr)',
                      style: displayStyle(
                        20,
                        _cream.withValues(alpha: 0.78),
                        weight: FontWeight.w600,
                      ),
                    ),
                  ),
                if (hit != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      '${withParen(dishName(hit!.title, hit!.originalTitle))} · ${hit!.sourceName}',
                      style: TextStyle(
                        fontSize: 14,
                        color: _cream.withValues(alpha: 0.8),
                      ),
                    ),
                  ),
                if (app.diet.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0x387FC28F),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.eco_outlined,
                          size: 18,
                          color: Color(0xFFA8D5A2),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text.rich(
                            TextSpan(
                              style: const TextStyle(
                                fontSize: 14,
                                color: _cream,
                              ),
                              children: [
                                TextSpan(text: '${app.t('willAdapt')}: '),
                                TextSpan(
                                  text: app.dietNames(app.diet),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: _maize,
                      foregroundColor: _ink,
                      minimumSize: const Size(48, 56),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      textStyle: displayStyle(18, _ink),
                    ),
                    onPressed: onCook,
                    iconAlignment: IconAlignment.end,
                    icon: const Icon(Icons.arrow_forward),
                    label: Text(app.t('cookToday')),
                  ),
                ),
                const SizedBox(height: 4),
                SizedBox(
                  width: double.infinity,
                  child: TextButton(
                    style: TextButton.styleFrom(
                      foregroundColor: _cream,
                      minimumSize: const Size(48, 46),
                    ),
                    onPressed: onAll,
                    child: Text(app.t('seeAll')),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
