# trivora-passenger-app — Passenger mobile app

Expo 54, React Native 0.81, React 19, TypeScript. `react-native-svg`, `lucide-react-native`. No `react-navigation` — `App.tsx` holds a `TabKey` state machine and switches screens/tabs manually; each screen is a full-screen component swapped by state, not a route.

Scope: only this folder. Don't inspect `trivora/` (Laravel) or `trivora-driver-app/` unless the task explicitly involves an API contract shared with them.

## Structure

- `src/screens/` — `OnboardingScreen`, `AuthScreen`, `HomeScreen`, `DestinationRouteScreen`, `RideConfirmationScreen`, `SearchingDriversScreen`, `DriverEnRouteScreen`, `ActiveRideScreen`, `TripCompletedScreen`, `RateReviewScreen`, `HistoryScreen`, `ProfileScreen`, `ActivityScreen`
- `src/context/` — `AuthContext` (auth state, `useAuth()`), `BookingContext` (booking/ride state, `useBooking()`)
- `src/components/` — shared UI: `TrivoraMap` (has `.native.tsx`/`.web.tsx` platform variants + `TrivoraMap.types.ts`), `PinLocationModal`/`PinLocationSheet` (also platform-split), `DestinationPickerModal`, `RideProgressStepper`, `RouteSummaryStrip`, `TripReceiptModal`, `SOSModal`, `InAppCallModal`, `InAppChatModal`, `NotificationsModal`, `Toast`, `EmptyState`, `PrimaryActionButton`, `FloatingIconButton`, `BrandLockup`
- `src/components/icons/index.ts` — single icon barrel; re-export new icons here rather than importing icon libs directly in screens
- `src/constants/theme.ts` — design tokens; `src/constants/todaRoutes.ts` — TODA route data
- `src/services/api.ts`, `src/services/routingService.ts`
- `src/types/index.ts`

## Design tokens (`src/constants/theme.ts`)

Brand `primary: #1B3A69`. `RADIUS` xs4/sm8/md12/lg16/xl20/xxl28/full. `SPACING` xxs2/xs4/sm8/md16/lg24/xl32/xxl40. `TYPOGRAPHY` scale: display/h1/h2/h3/bodyLarge/body/bodySmall/caption/micro/label. Also `CATEGORY_COLORS` (place/category accent colors). Always pull values from `theme.ts` — never inline hex/pixel values.

## Conventions

- New screens: `XScreen.tsx` PascalCase under `src/screens/`, wired into `App.tsx`'s tab/state machine — don't add `react-navigation`.
- App-wide state → React Context + a `useX()` hook (no Redux); local UI state → `useState`.
- Styling via `StyleSheet.create` referencing `theme.ts` tokens.
- A component needing different native vs. web behavior follows the existing `.native.tsx`/`.web.tsx` split (see `TrivoraMap`, `PinLocationModal`).

## Commands

`npm start`, `npm run android`, `npm run ios`, `npm run web` (Expo CLI). No test suite configured — verify by running the app for UI changes.
