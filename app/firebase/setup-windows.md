# Windows Firebase Emulator Setup

LaundryOps now runs Firebase emulator tests from this workspace with a bundled local JDK.

## Step 1: Run The LaundryOps Rule Tests

In PowerShell, go to the app folder:

```powershell
cd "C:\Users\reoll\CODEX\projects\LaundryOps\app"
```

Run:

```powershell
npm.cmd run test:rules
```

That command:

1. Uses the local bundled JDK at `.tools/jdk11`.
2. Uses local Firebase config and emulator cache paths inside this workspace.
3. Starts Firestore and Storage emulators.
4. Runs automated rules tests in `firebase/rules.test.ts`.
5. Shuts everything down automatically.

## Step 2: Start The Emulator UI

To inspect the Firebase emulator dashboard, run:

```powershell
npm.cmd run firebase:emulators
```

Then open:

```text
http://127.0.0.1:4000
```

## Step 3: Connect A Real Firebase Dev Project Later

Do this only after local rules tests pass.

1. Copy `.firebaserc.example`.
2. Rename the copy to `.firebaserc`.
3. Replace `demo-laundryops-dev` with the real Firebase development project ID.
4. Keep production separate from development.

## Optional: Install System Java Later

This project no longer requires changing global Java to run local tests. If you want system-wide Java for other tools, install JDK 11 or newer separately.
