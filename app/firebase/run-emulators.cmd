@echo off
setlocal
set "APP_DIR=%~dp0.."
set "XDG_CONFIG_HOME=%APP_DIR%\.firebase-local-config"
set "FIREBASE_EMULATORS_PATH=%APP_DIR%\.firebase-local-emulators"
set "JAVA_HOME=%APP_DIR%\.tools\jdk11"
set "PATH=%JAVA_HOME%\bin;%PATH%"
call "%APP_DIR%\node_modules\.bin\firebase.cmd" emulators:start --project demo-laundryops-rules --only auth,firestore,storage
