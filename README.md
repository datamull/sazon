# Sazón — app iPhone

App Flutter de Sazón: recetas de Quebec, Chile, México y Colombia traídas en vivo de sus sitios, con nombres en francés para comprar en Quebec, plan de compra con precios, checklist y preparación paso a paso.

Usa como servidor las funciones de Vercel de la carpeta `sitio/` (`https://sazon-sitio.vercel.app`). La clave de Gemini vive solo en Vercel, nunca en la app.

## Estructura
- `lib/models/recipe.dart` — datos que llegan de la API
- `lib/services/api.dart` — conexión con el servidor (`API_BASE` se puede cambiar al compilar)
- `lib/services/shopping_plan.dart` — súper más barato + siguiente parada, enlaces «Ver en»
- `lib/state/app_state.dart` — ajustes (idioma, país, código postal) y lo que marcas en cada receta
- `lib/ui/screens/` — inicio, resultados, receta, dónde comprar, checklist, paso a paso, ajustes
- `lib/data/step_art.dart` y `lib/l10n/strings_data.dart` — generados desde la web (`tool/export_art.cjs`) para que ambas se vean y digan lo mismo
- `test/logic_test.dart` — pruebas de nombres, cantidades y plan de compra

## Probar en tu PC (Ubuntu)
```
flutter pub get
flutter test
flutter run -d linux     # necesita: sudo apt install clang cmake ninja-build libgtk-3-dev
```

## Publicar en el App Store con Codemagic
Una sola vez:
1. **developer.apple.com → Identifiers → +** → App IDs → App → Bundle ID explícito `com.sebamuller.sazon` (descripción «Sazón»).
2. **App Store Connect → Apps → + Nueva app** → iOS, nombre «Sazón» (o el que esté libre), idioma principal, Bundle ID `com.sebamuller.sazon`, SKU `sazon`.
3. Sube este proyecto a un repositorio de GitHub.
4. **Codemagic → Add application** → ese repositorio → tipo Flutter → usa `codemagic.yaml`. La clave de App Store Connect en Codemagic se llama `Datamull`.

Cada versión: sube los cambios y ejecuta el flujo **«Sazón · iOS App Store»**. La build llega a TestFlight; desde ahí la envías a revisión en App Store Connect.

Para cambiar el número de versión visible, edita `version:` en `pubspec.yaml` (el número de build lo pone Codemagic).
