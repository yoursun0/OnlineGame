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
  'Room not found or no longer open.': '找不到房間，或房間已不再開放。',
  'Request failed.': '請求失敗。',
  'Use a room code like TIK-7Q4.': '請輸入類似 TIK-7Q4 的房號。',
  'Use a room code like TIK-7Q4 or CON-K8P.': '請輸入類似 TIK-7Q4 或 CON-K8P 的房號。',
  'That game is not available.': '這款遊戲尚未開放。',
  'Connect Four is turn-based only.': '四子棋只支援回合制。',
  'Choose a valid column.': '請選擇有效的直欄。',
  'Column must be between 0 and 6.': '直欄必須介乎 0 到 6。',
  'That column is full.': '這一欄已經滿了。',
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
  'Replay is only available after the game ends.': '遊戲結束後才能重玩。',
  'Both players must still be in the room to replay.': '兩位玩家都還在房間裡才能重玩。',
  'A replay needs a fresh game state.': '重玩需要新的棋局狀態。',
  'Use a room code like TIK-7Q4, CON-K8P, or LAD-ZHW.': '請輸入類似 TIK-7Q4、CON-K8P 或 LAD-ZHW 的房號。',
  '小朋友落樓梯 is realtime only.': '小朋友落樓梯只支援即時模式。',
  'Only the host simulator may write Checkpoints.': '只有房主模擬器可以寫入 Checkpoint。',
  'Checkpoint shape is invalid.': 'Checkpoint 格式無效。',
  'This room is not a downstairs well.': '這個房間不是落樓梯井。',
  'Solo LAD rooms are the only downstairs start supported in this release.': '此版本只支援單人 LAD 開局。',
  'Could not save well Checkpoint.': '未能保存井況 Checkpoint。',
  'Could not quit well.': '未能退出井況。',
  'All players must be ready before starting.': '所有玩家都要準備好才能開始。',
  'Finish reason must be hp, fall, or quit.': '結束原因必須是生命、墜落或退出。',
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
