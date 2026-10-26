import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'state/app_state.dart';
import 'ui/screens/home_screen.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Future.wait([
    initializeDateFormatting('es'),
    initializeDateFormatting('fr'),
    initializeDateFormatting('en'),
  ]);
  final prefs = await SharedPreferences.getInstance();
  runApp(SazonApp(state: AppState(prefs)));
}

class SazonApp extends StatelessWidget {
  const SazonApp({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: state,
      child: ListenableBuilder(
        listenable: state,
        builder: (context, _) => MaterialApp(
          title: 'Sazón',
          debugShowCheckedModeBanner: false,
          locale: Locale(state.lang),
          supportedLocales: const [Locale('es'), Locale('fr'), Locale('en')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          theme: buildTheme(SazonColors.light, Brightness.light),
          darkTheme: buildTheme(SazonColors.dark, Brightness.dark),
          home: const HomeScreen(),
        ),
      ),
    );
  }
}
