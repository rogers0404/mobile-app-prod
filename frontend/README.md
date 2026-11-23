# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

Copy `.env.example` to `.env` and fill the required values locally before starting
Expo. Keep `.env` untracked. `EXPO_PUBLIC_*` values are included in client code;
never put PayPal secrets, database credentials, or private server keys there.

`app.config.js` reads `GOOGLE_MAPS_ANDROID_API_KEY` and the optional
`GOOGLE_MAPS_IOS_API_KEY` for native Maps configuration. Use separate restricted
keys for each platform. Rebuild the native app after changing native keys; an
Expo Go session does not validate a standalone app's native key configuration.
If a native key is absent, its Maps configuration is omitted, so a standalone
Google Maps integration requires that key to be supplied at build time.

`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` serves existing client Maps/Geocoding calls.
Do not assume Android, iOS, web, and server restrictions are interchangeable.
See [security status and remaining provider actions](../documentation/BUGS.md#identity-and-access).

For backend development, copy `backend/.env.example` to `backend/.env` from the
repository root and configure local services. Do not overwrite existing local
environment files when following this setup.

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
