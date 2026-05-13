<!-- # Strongline -->
<h1 align="center">Strongline</h1>

<div align="center">
A minimal, offline-first strength-training tracker built with Expo + React Native. Pick a program, log your sets, watch your progress.

> Dark UI, red accents, no accounts, no cloud — your data stays on your phone.

</div>

## ✨ Features

- **Today** — guided workout screen with per-set logging, rest timer, and the ability to add ad-hoc exercises to a session.
- **Programs** — bundled beginner / intermediate / advanced templates (e.g. PPL, full-body) plus a custom workout builder.
- **History** — calendar view of completed sessions, swipeable day-detail modal for multi-workout days, and one-tap **Repeat Workout** for any past session (template *or* custom).
- **Progress** — per-exercise volume/strength trends rendered with Victory Native.
- **Profile** — units (kg/lb, cm/in), BMI calculator with body-stats logging, and a weight/BMI trend chart on Home.
- **Splash** — animated red gradient logo on boot.

## 🛠️ Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Expo SDK 54, React Native 0.81, React 19 |
| Navigation | `expo-router` (file-based, tab layout) |
| UI | `react-native-paper` + custom theme in `theme.ts` |
| Storage | **`expo-sqlite`** via **`drizzle-orm`** (typed schema + migrations) |
| Settings | `@react-native-async-storage/async-storage` |
| Charts | `victory-native` |
| Icons / SVG | `@expo/vector-icons`, `react-native-svg` |
| Video tutorials | `react-native-youtube-iframe` |

## 📁 Project layout

```
app/                Expo Router routes
  _layout.tsx       Root: migrations + splash gate + providers
  (tabs)/           Tab screens: today, programs, history, progress, profile
components/         Reusable UI (Calendar, BMI, BodyStatsTrend, Splash, Logo, …)
contexts/           SettingsContext (units, active program)
data/               Seed data: exercises + bundled programs
db/                 Drizzle client, schema, query helpers
drizzle/            Auto-generated migrations (committed)
utils/              Small helpers: date, pendingWorkout intent store, …
assets/             Icons + splash PNGs
theme.ts            Color palette
app.json            Expo config (name: Strongline, slug: strongline)
```

## 🚀 Getting started

```bash
# 1. Install
npm install

# 2. Run the dev server
npm start

# Then either:
#   - Scan the QR code with the Expo Go app on your phone, or
#   - Press `i` for iOS simulator (macOS) / `a` for Android emulator / `w` for web
```

### ⚙️ Useful scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Metro bundler (Expo dev server) |
| `npm run ios` | Open in the iOS simulator (macOS only) |
| `npm run android` | Open in an Android emulator |
| `npm run web` | Run in the browser (limited — SQLite/native modules are stubbed) |
| `npm test` | Jest tests |
| `npx drizzle-kit generate` | Regenerate SQL migrations after schema changes |

## 🧠 How it works (in one minute)

1. On first boot, `app/_layout.tsx` runs drizzle migrations against the SQLite file `fitness.db`, then seeds exercises + bundled programs (`db/queries.ts → seedIfEmpty`). The custom splash holds for ≥1.5s.
2. Picking a program writes the active program id into `SettingsContext` (AsyncStorage).
3. Starting a workout inserts a `workoutSessions` row (in-progress = `durationSeconds IS NULL`); every set you tap inserts a `setLogs` row.
4. Finishing fills in `durationSeconds`, locking the session into History.
5. **Repeat Workout** uses a tiny module-level "pending intent" store (`utils/pendingWorkout.ts`) to hand off the chosen template or custom-session blueprint to the Today tab — robust against Expo Router's tab-param caching.

## 🗄️ Data model (drizzle / SQLite)

- `programs`, `workoutTemplates`, `templateExercises`, `exercises` — content catalog (seeded).
- `workoutSessions` — one row per workout (template-based **or** custom; `isCustom=true` stores its own `customExercises` JSON).
- `setLogs` — every logged set: weight, reps, completed flag.
- `bodyStats` — weight (kg) + optional height (cm) per day; powers BMI and the trend chart.

Everything lives in a single file: `fitness.db` inside the app's sandbox.

---

## ❓ FAQ

### 👥 Is it multi-user?

**No.** There are no accounts and no user table. The schema is single-tenant: every workout, set, and body-stat is global to the app install. If two people share one device, they'd be writing into the same history. If you wanted multi-user, you'd add a `users` table, a `userId` foreign key on each data table, and a login/profile-switcher.

### 💾 How does the database work? Where does it live?

- It's a local **SQLite** file (`fitness.db`) created by `expo-sqlite` inside your app's private sandbox on the device. Nothing is uploaded anywhere.
- Schema is defined in TypeScript (`db/schema.ts`) and applied via committed migrations in `drizzle/`. On every launch, `useMigrations` brings the DB up to date.
- **Backups:** there's no built-in export. The DB will survive app updates but will be wiped if you uninstall the app. If you sideload via Xcode/Android Studio you can pull the file off the device for backup.

### 📱 Can I install it on my phone without using Expo Go?

Yes — Expo Go is just a convenient dev container. For a "real" install you have a few paths:

1. **Development build** (`expo-dev-client`) — like Expo Go but with your app's exact native modules. Useful while still iterating.
2. **EAS Build** — Expo's cloud build service produces an `.ipa` (iOS) or `.apk`/`.aab` (Android). Free tier has limited concurrent builds. You then install via TestFlight (iOS), or sideload the APK (Android).
3. **Local native build** — `npx expo prebuild` generates the `ios/` and `android/` folders; you build them yourself with Xcode or Android Studio.

### 🍎 Using MacBook + Xcode + free iPhone install — does that work?

**Yes, with caveats.** This is the classic "free Apple developer account sideload" flow:

1. On the Mac: install Xcode (free from the App Store).
2. Clone this repo and run `npm install`.
3. Generate the native iOS project:
   ```bash
   npx expo prebuild --platform ios
   cd ios && pod install && cd ..
   ```
4. Open `ios/Strongline.xcworkspace` in Xcode.
5. Sign in to Xcode with any free Apple ID under **Xcode → Settings → Accounts**.
6. In the project's **Signing & Capabilities** tab, pick that Apple ID as the **Team** and let Xcode auto-generate a provisioning profile. Change the **Bundle Identifier** to something unique (e.g. `com.yourname.strongline`) — the default may already be claimed.
7. Plug in the iPhone, trust the Mac, select the device as the run target, and hit **▶ Run**.
8. On the iPhone, after install, go to **Settings → General → VPN & Device Management → Developer App** and trust the certificate.

**The catches (Apple, not us):**
- Free Apple ID provisioning profiles **expire after 7 days**. To keep using the app, plug back into the Mac and rebuild — Xcode resigns it.
- Limit of **3 apps** signed with a free account on a given device at a time.
- A paid Apple Developer Program account ($99/year) lifts the 7-day limit and lets you distribute via TestFlight (90-day install, up to 10,000 testers).

For Android, it's even simpler — `eas build -p android --profile preview` (or `npx expo run:android` against a connected device) produces an APK you can install directly with no signing dance.

### 🪟 Windows laptop + iPhone? Use AltStore

If you don't have a Mac but still want the app on an iPhone, **AltStore** (or its newer counterpart **AltStore PAL** in the EU / **SideStore**) is the most popular free workaround:

1. **Build an `.ipa` on the cloud** — you don't need a Mac for this. Run:
   ```bash
   npm install -g eas-cli
   eas login          # free Expo account
   eas build -p ios --profile preview
   ```
   Pick **"simulator: no"** and let EAS auto-generate credentials with your free Apple ID. The build runs on Expo's macOS workers and produces a downloadable `.ipa`.
2. **Install AltServer on Windows** from [altstore.io](https://altstore.io) and the **AltStore** companion app on the iPhone (AltServer pushes it over USB the first time).
3. **Sideload the `.ipa`** — open AltStore on the iPhone, tap **+**, and pick the `.ipa` file you downloaded from EAS. AltStore signs it with your free Apple ID.
4. Trust the developer profile under **Settings → General → VPN & Device Management** on the iPhone.

**Same Apple-imposed limits as the Xcode flow apply:** the app must be **refreshed every 7 days** (AltStore can do this automatically over Wi-Fi while AltServer is running on your Windows laptop), and you can only have 3 sideloaded apps signed by a free Apple ID at once.

---

## 🙏 Credits & inspiration

The bundled program structures take cues from well-known linear- and weekly-progression routines popularised by the broader strength-training community — including the **5×5** novice template, classic three-lift novice barbell programs, and the intermediate **Madcow 5×5** weekly progression. Names, descriptions, and all UI copy in this app are original; no content, branding, or imagery has been copied from any third-party app or book. Trademarks for specific commercial programs (e.g. *StrongLifts™*, *Starting Strength®*) belong to their respective owners and are not affiliated with this project.

## 📜 License

Released under the MIT License — see [`LICENSE.md`](./LICENSE.md).
