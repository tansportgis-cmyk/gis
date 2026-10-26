// ==========================================================
//  إعدادات Firebase
//  انسخ القيم من: Firebase Console ← Project settings ← Your apps ← SDK setup and configuration
//  هذه القيم ليست سرية، والحماية الحقيقية تكون في ملفي firestore.rules و storage.rules
// ==========================================================
export const firebaseConfig = {
  apiKey: "AIzaSyB2ntPueOOOvJxrk8-B8ucMIbcUFN7DgL8",
  authDomain: "gisoman-c0c3c.firebaseapp.com",
  projectId: "gisoman-c0c3c",
  storageBucket: "gisoman-c0c3c.firebasestorage.app",
  messagingSenderId: "379981386580",
  appId: "1:379981386580:web:f91ba6d1fc958a62e26ec1"
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
