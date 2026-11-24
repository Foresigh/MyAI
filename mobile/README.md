# Arvo mobile app

The Arvo phone app for iOS and Android, built with [Expo](https://expo.dev) (SDK 58, Expo Router, TypeScript). It talks to the same backend as the website.

## What it does

- Chat with Arvo with streaming replies, saved chats, regenerate, copy and stop.
- Model picker. Models your plan doesn't include show a lock and the plan that unlocks them.
- Pictures: attach up to 3 from your library or the camera. Pictures need the Pro plan or above, the same as the website.
- Code blocks with Copy. Expo app code gets a **Run in Snack** button that opens it in Expo Snack.
- Settings: enter the email you subscribed with to unlock your paid plan.

## Run it on your phone

1. Install **Expo Go** from the App Store or Google Play.
2. In this folder:

   ```sh
   npm install
   npx expo start
   ```

3. Scan the QR code with your camera (iPhone) or the Expo Go app (Android).

To try it in a browser instead, run `npm run web`. The live backend only accepts browser requests from the Arvo website, so chat won't work in the browser version unless you add its address to the backend's `ALLOWED_ORIGINS`. Phones aren't affected by this.

## Settings

| Variable | Default | What it does |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | the live Railway backend | Point the app at another backend, for example a local one. |
| `EXPO_PUBLIC_WEB_URL` | none | The Arvo website. When set, "See plans" opens its pricing page. |

Put them in `mobile/.env.local` (not committed).

## Checks

```sh
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

## Publishing to the app stores

Builds run in the cloud with Expo's build service, so you don't need Xcode or Android Studio:

```sh
npx eas-cli@latest build --platform all
npx eas-cli@latest submit
```

You'll need an Expo account, plus an Apple Developer account for iOS and a Google Play developer account for Android. Before publishing, replace `com.arvo.app` in `app.json` with your own bundle identifier, and replace the icons in `assets/`.
