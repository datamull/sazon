import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../data/step_art.dart';
import '../../state/app_state.dart';
import '../screens/settings_sheet.dart';
import '../theme.dart';

/// Barra superior con la marca y el botón de ajustes.
PreferredSizeWidget sazonBar(
  BuildContext context, {
  List<Widget> actions = const [],
}) {
  final c = context.c;
  return AppBar(
    titleSpacing: 0,
    title: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: c.accent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            Icons.soup_kitchen_outlined,
            size: 20,
            color: c.accentInk,
          ),
        ),
        const SizedBox(width: 8),
        Text('Sazón', style: displayStyle(22, c.ink)),
      ],
    ),
    actions: [
      ...actions,
      IconButton(
        tooltip: AppScope.of(context).t('settings'),
        icon: const Icon(Icons.tune),
        onPressed: () => showSettingsSheet(context),
      ),
      const SizedBox(width: 4),
    ],
  );
}

class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Text(
    text.toUpperCase(),
    style: TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w600,
      letterSpacing: 1.1,
      color: context.c.muted,
    ),
  );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.count});
  final String text;
  final int? count;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Flexible(child: Text(text, style: displayStyle(26, c.ink))),
        if (count != null) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: c.sunk,
              borderRadius: BorderRadius.circular(13),
            ),
            child: Text(
              '$count',
              style: TextStyle(fontWeight: FontWeight.w600, color: c.ink),
            ),
          ),
        ],
      ],
    );
  }
}

class Note extends StatelessWidget {
  const Note(this.text, {super.key, this.warn = false});
  final String text;
  final bool warn;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: warn ? c.maizeSoft : c.accentSoft,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline, size: 20, color: c.ink),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: TextStyle(fontSize: 14, color: c.ink)),
          ),
        ],
      ),
    );
  }
}

class ErrorBox extends StatelessWidget {
  const ErrorBox({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.chileSoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(message, style: TextStyle(color: c.ink)),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: onRetry,
            child: Text(AppScope.of(context).t('retry')),
          ),
        ],
      ),
    );
  }
}

/// Ilustración del gesto de un paso (picar, freír, hornear…), con un leve movimiento.
class StepArt extends StatefulWidget {
  const StepArt(this.action, {super.key, this.animate = true});
  final String action;
  final bool animate;
  @override
  State<StepArt> createState() => _StepArtState();
}

class _StepArtState extends State<StepArt> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );

  @override
  void initState() {
    super.initState();
    if (widget.animate) _ctrl.repeat(reverse: true);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) _ctrl.stop();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final art = (dark ? stepArtDark : stepArtLight);
    final svg = art[widget.action] ?? art['mix']!;
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, child) => Transform.translate(
        offset: Offset(0, -4 * Curves.easeInOut.transform(_ctrl.value)),
        child: child,
      ),
      child: SvgPicture.string(svg, fit: BoxFit.contain),
    );
  }
}

class Loading extends StatelessWidget {
  const Loading(this.message, {super.key});
  final String message;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 24),
    child: Column(
      children: [
        const SizedBox(width: 180, height: 120, child: StepArt('boil')),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(color: context.c.muted),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: 120,
          child: LinearProgressIndicator(
            color: context.c.accent,
            backgroundColor: context.c.sunk,
          ),
        ),
      ],
    ),
  );
}

/// Botón principal anclado abajo.
class Dock extends StatelessWidget {
  const Dock({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      decoration: BoxDecoration(
        color: c.bg,
        border: Border(top: BorderSide(color: c.line)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          ),
        ),
      ),
    );
  }
}

String friendlyError(AppState app, Object e) {
  final msg = e.toString();
  if (msg.contains('TimeoutException') ||
      msg.contains('SocketException') ||
      msg.contains('ClientException')) {
    return app.t('error');
  }
  return msg;
}
