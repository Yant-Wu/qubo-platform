import type { AppLanguage } from '../types/i18n';
import { LANGUAGE_BUTTON_LABEL, NEXT_LANGUAGE } from '../types/i18n';

interface Props {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  className?: string;
  title?: string;
}

export default function LanguageToggle({ lang, setLang, className, title }: Props) {
  return (
    <button
      type="button"
      onClick={() => setLang(NEXT_LANGUAGE[lang])}
      title={title}
      className={className}
    >
      {LANGUAGE_BUTTON_LABEL[lang]}
    </button>
  );
}
