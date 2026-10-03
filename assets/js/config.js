/**
 * App configuration.
 *
 * backend: 'local'    → everything lives in this browser's localStorage (instant MVP/demo).
 *          'firebase' → Firebase Auth + Firestore + Storage (real multi-device SaaS).
 *
 * To switch to Firebase: paste your web app config below and set backend to 'firebase'.
 * See README.md → "Firebase".
 */
export const APP_CONFIG = {
  appName: 'FitCheck',
  backend: 'local',

  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
};
