'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'zh-Hant';

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
} | null>(null);

const errorTranslations: Record<string, string> = {
  'Connect Supabase before creating or joining a room.': '請先連接 Supabase，才能建立或加入房間。',
  'Connect Supabase before entering a room.': '請先連接 Supabase，才能進入房間。',
  'Room request failed.': '房間請求失敗。',
  'Could not create room.': '未能建立房間。',
  'Could not join room.': '未能加入房間。',
  'Could not load room.': '未能載入房間。',
  'Room action failed.': '房間操作失敗。',
  'Move rejected.': '這一步無法落子。',
  'Room not found or expired.': '找不到房間，或房間已過期。',
  'Join this room before reading its state.': '請先加入房間。',
  'Enter a display name before joining.': '請輸入顯示名稱。',
  'A guest session is required.': '需要訪客工作階段。',
  'The guest session is invalid or expired.': '訪客工作階段無效或已過期。',
  'The game has not started or is already finished.': '遊戲尚未開始，或已經結束。',
  'You are not a member of this room.': '你不是這個房間的玩家。',
  'Game is over.': '遊戲已結束。',
  'Cell must be between 0 and 8.': '棋格位置無效。',
  'Cell is already occupied.': '這個棋格已有棋子。',
  'It is not this player’s turn.': '還未輪到這位玩家。',
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = window.localStorage.getItem('playroom-language');
    const preferred = saved === 'zh-Hant' || (!saved && navigator.language.toLowerCase().startsWith('zh')) ? 'zh-Hant' : 'en';
    setLanguageState(preferred);
    document.documentElement.lang = preferred;
  }, []);

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);
    window.localStorage.setItem('playroom-language', nextLanguage);
    document.documentElement.lang = nextLanguage;
  }

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider.');
  return context;
}

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="language-toggle" aria-label="Language / 語言">
      <button aria-pressed={language === 'en'} onClick={() => setLanguage('en')} type="button">EN</button>
      <button aria-pressed={language === 'zh-Hant'} onClick={() => setLanguage('zh-Hant')} type="button">中文</button>
    </div>
  );
}

export function translateError(message: string, language: Language) {
  return language === 'zh-Hant' ? errorTranslations[message] ?? message : message;
}
