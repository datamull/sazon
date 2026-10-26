import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../state/app_state.dart';
import '../../utils/naming.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Preparación paso a paso: ilustración del gesto, texto del paso, temporizador y botón Siguiente.
class CookScreen extends StatefulWidget {
  const CookScreen({super.key, required this.session});
  final RecipeSession session;
  @override
  State<CookScreen> createState() => _CookScreenState();
}

class _CookScreenState extends State<CookScreen> {
  int _step = 0;
  bool _done = false;
  Timer? _timer;
  int? _left;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _go(int step) {
    _timer?.cancel();
    setState(() {
      _left = null;
      _step = step;
    });
  }

  void _startTimer(double minutes) {
    _timer?.cancel();
    setState(() => _left = (minutes * 60).round());
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _left = _left! - 1);
      if (_left! <= 0) {
        t.cancel();
        SystemSound.play(SystemSoundType.alert);
        HapticFeedback.heavyImpact();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = context.c;
    final r = widget.session.recipe;
    if (_done) return _DoneView(onAgain: () => setState(() => _done = false));
    final n = r.steps.length;
    final st = r.steps[_step];
    final last = _step == n - 1;
    return Scaffold(
      appBar: sazonBar(context),
      bottomNavigationBar: Dock(children: [
        Row(children: [
          Expanded(
            flex: 2,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10)),
              onPressed: _step == 0 ? null : () => _go(_step - 1),
              icon: const Icon(Icons.arrow_back),
              label: FittedBox(child: Text(app.t('prev'), maxLines: 1)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 3,
            child: FilledButton.icon(
              onPressed: () => last ? setState(() => _done = true) : _go(_step + 1),
              iconAlignment: IconAlignment.end,
              icon: const Icon(Icons.arrow_forward),
              label: Text(app.t(last ? 'finish' : 'next')),
            ),
          ),
        ]),
      ]),
      body: GestureDetector(
        // deslizar para cambiar de paso
        onHorizontalDragEnd: (d) {
          final v = d.primaryVelocity ?? 0;
          if (v < -300 && !last) _go(_step + 1);
          if (v > 300 && _step > 0) _go(_step - 1);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 30),
          children: [
            Eyebrow(withParen(dishName(r.title, r.originalTitle))),
            const SizedBox(height: 8),
            Row(children: [
              for (var k = 0; k < n; k++)
                Expanded(
                  child: Container(
                    height: 5,
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    decoration: BoxDecoration(
                      color: k <= _step ? c.accent.withValues(alpha: k < _step ? 0.5 : 1) : c.sunk,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
            ]),
            const SizedBox(height: 16),
            AspectRatio(
              aspectRatio: 3 / 2,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: c.maizeSoft, borderRadius: BorderRadius.circular(22)),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 250),
                  child: StepArt(st.action, key: ValueKey('$_step-${st.action}')),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text.rich(TextSpan(style: TextStyle(fontSize: 14, color: c.muted), children: [
              TextSpan(text: '${app.t('step')} '),
              TextSpan(text: '${_step + 1}', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.ink)),
              TextSpan(text: ' ${app.t('of')} $n'),
            ])),
            const SizedBox(height: 6),
            Text(st.text, style: TextStyle(fontSize: 22, height: 1.35, fontWeight: FontWeight.w500, color: c.ink)),
            if (st.minutes != null) ...[
              const SizedBox(height: 18),
              Row(children: [
                OutlinedButton.icon(
                  onPressed: () => _startTimer(st.minutes!),
                  icon: const Icon(Icons.timer_outlined),
                  label: Text('${app.t('timer')} · ${qtyFmt(st.minutes)} ${app.t('min')}'),
                ),
                const SizedBox(width: 14),
                if (_left != null)
                  Text(
                    _left! <= 0 ? app.t('timeUp') : '${_left! ~/ 60}:${(_left! % 60).toString().padLeft(2, '0')}',
                    style: displayStyle(28, _left! <= 0 ? c.chile : c.ink),
                  ),
              ]),
            ],
          ],
        ),
      ),
    );
  }
}

class _DoneView extends StatelessWidget {
  const _DoneView({required this.onAgain});
  final VoidCallback onAgain;
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final c = context.c;
    return Scaffold(
      appBar: sazonBar(context),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          AspectRatio(
            aspectRatio: 3 / 2,
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: c.maizeSoft, borderRadius: BorderRadius.circular(22)),
              child: const StepArt('serve'),
            ),
          ),
          const SizedBox(height: 18),
          Text(app.t('doneTitle'), textAlign: TextAlign.center, style: displayStyle(28, c.ink)),
          const SizedBox(height: 6),
          Text(app.t('doneMsg'), textAlign: TextAlign.center, style: TextStyle(color: c.muted)),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: () => Navigator.popUntil(context, (r) => r.isFirst),
            child: Text(app.t('another')),
          ),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: onAgain, child: Text(app.t('backRecipe'))),
        ],
      ),
    );
  }
}
