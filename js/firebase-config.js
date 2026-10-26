// ==========================================================
//  إعدادات Firebase
//  انسخ القيم من: Firebase Console ← Project settings ← Your apps ← SDK setup and configuration
//  هذه القيم ليست سرية، والحماية الحقيقية تكون في ملفي firestore.rules و storage.rules
// ==========================================================
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

// إعدادات عامة للتطبيق
export const APP = {
  name: "منصة طلبات GIS",
  // مركز الخريطة الافتراضي [خط العرض، خط الطول] — غيّره لمدينتك
  mapCenter: [23.5880, 58.3829],
  mapZoom: 12,
  // أقصى حجم للملف الواحد بالميجابايت (يجب أن يطابق storage.rules)
  maxFileMB: 50
};
