import { useEffect, useState } from 'react';
import {
    fetchAvailableWeeks,
    fetchAndParseSchedule,
    type Lesson,
    type SheetWeek,
} from './api/schedule';

type Language = 'ua' | 'ru';
type Theme = 'light' | 'dark';

const translations = {
    ua: {
        faculty: 'ННІ ЕП • ЧНУ',
        title: 'Розклад ФБ-26',
        autoUpdate: 'Автоматичне оновлення з таблиці',
        loading: 'Завантаження розкладу...',
        noLessons: 'Пар не знайдено на цей тиждень.',
        lessonWord: 'пара',
        themeLight: 'Світла',
        themeDark: 'Темна',
        weekLabel: 'Тиждень:',
        days: {
            'ПОНЕДІЛОК': 'ПОНЕДІЛОК',
            'ВІВТОРОК': 'ВІВТОРОК',
            'СЕРЕДА': 'СЕРЕДА',
            'ЧЕТВЕР': 'ЧЕТВЕР',
            "П'ЯТНИЦЯ": "П'ЯТНИЦЯ",
            'СУБОТА': 'СУБОТА',
        } as Record<string, string>,
    },
    ru: {
        faculty: 'УНИ ЭП • ЧНУ',
        title: 'Расписание ФБ-26',
        autoUpdate: 'Автоматическое обновление из таблицы',
        loading: 'Загрузка расписания...',
        noLessons: 'Пар не найдено на эту неделю.',
        lessonWord: 'пара',
        themeLight: 'Светлая',
        themeDark: 'Темная',
        weekLabel: 'Неделя:',
        days: {
            'ПОНЕДІЛОК': 'ПОНЕДЕЛЬНИК',
            'ВІВТОРОК': 'ВТОРНИК',
            'СЕРЕДА': 'СРЕДА',
            'ЧЕТВЕР': 'ЧЕТВЕРГ',
            "П'ЯТНИЦЯ": 'ПЯТНИЦА',
            'СУБОТА': 'СУББОТА',
        } as Record<string, string>,
    },
};

function App() {
    const [schedule, setSchedule] = useState<Lesson[]>([]);
    const [weeks, setWeeks] = useState<SheetWeek[]>([]);
    const [selectedWeek, setSelectedWeek] = useState<SheetWeek | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [lang, setLang] = useState<Language>(() => {
        return (localStorage.getItem('schedule_lang') as Language) || 'ua';
    });

    const [theme, setTheme] = useState<Theme>(() => {
        return (localStorage.getItem('schedule_theme') as Theme) || 'light';
    });

    // 1. Спочатку завантажуємо список доступних вкладок
    useEffect(() => {
        fetchAvailableWeeks().then((foundWeeks) => {
            setWeeks(foundWeeks);
            // За замовчуванням вибираємо найостанніший (найбільший) тиждень
            const latest = foundWeeks[foundWeeks.length - 1] || null;
            setSelectedWeek(latest);
        });
    }, []);

    // 2. Коли змінюється вибраний тиждень — завантажуємо його розклад
    useEffect(() => {
        if (!selectedWeek) return;
        setIsLoading(true);
        fetchAndParseSchedule(selectedWeek.gid).then((data) => {
            setSchedule(data);
            setIsLoading(false);
        });
    }, [selectedWeek]);

    const toggleLanguage = () => {
        const nextLang: Language = lang === 'ua' ? 'ru' : 'ua';
        setLang(nextLang);
        localStorage.setItem('schedule_lang', nextLang);
    };

    const toggleTheme = () => {
        const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
        setTheme(nextTheme);
        localStorage.setItem('schedule_theme', nextTheme);
    };

    const t = translations[lang];
    const isDark = theme === 'dark';

    const groupedSchedule = schedule.reduce((acc, lesson) => {
        if (!acc[lesson.day]) {
            acc[lesson.day] = [];
        }
        acc[lesson.day].push(lesson);
        return acc;
    }, {} as Record<string, Lesson[]>);

    // Беремо останні дві вкладки для швидкого перемикання (найновіша та попередня)
    const quickWeeks = weeks.slice(-2);

    return (
        <main
            className={`min-h-screen transition-colors duration-200 ${
                isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
            }`}
        >
            <div className="mx-auto max-w-md px-4 py-6">
                {/* Кнопки Налаштувань */}
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={toggleLanguage}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition border ${
                            isDark
                                ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                        }`}
                    >
                        <span className={lang === 'ua' ? 'text-indigo-500 font-bold' : 'opacity-60'}>UA</span>
                        <span className="opacity-40">/</span>
                        <span className={lang === 'ru' ? 'text-indigo-500 font-bold' : 'opacity-60'}>RU</span>
                    </button>

                    <button
                        onClick={toggleTheme}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                            isDark
                                ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                        }`}
                    >
                        {isDark ? (
                            <>
                                <span>☀️</span>
                                <span className="text-slate-200">{t.themeLight}</span>
                            </>
                        ) : (
                            <>
                                <span>🌙</span>
                                <span className="text-slate-700">{t.themeDark}</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Заголовок */}
                <header className="mb-4 text-center">
          <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
                  isDark
                      ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/40'
                      : 'bg-indigo-100 text-indigo-700'
              }`}
          >
            {t.faculty}
          </span>
                    <h1 className={`mt-2 text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {t.title}
                    </h1>
                    <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t.autoUpdate}
                    </p>
                </header>

                {/* Перемикач тижнів (найновіший та попередній) */}
                {quickWeeks.length > 0 && (
                    <div className="mb-6 flex items-center justify-center gap-2">
                        {quickWeeks.map((w) => {
                            const isActive = selectedWeek?.gid === w.gid;
                            return (
                                <button
                                    key={w.gid}
                                    onClick={() => setSelectedWeek(w)}
                                    className={`flex-1 max-w-[170px] py-2 px-3 rounded-xl text-xs font-bold transition shadow-sm border ${
                                        isActive
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20'
                                            : isDark
                                                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {w.name}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Стан завантаження */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center pt-20 text-slate-400">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                        <p className="mt-3 text-sm">{t.loading}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.keys(groupedSchedule).map((dayKey) => {
                            const displayDay = t.days[dayKey] || dayKey;

                            return (
                                <section key={dayKey}>
                                    <h2
                                        className={`mb-3 text-sm font-bold uppercase tracking-wider ${
                                            isDark ? 'text-slate-400' : 'text-slate-500'
                                        }`}
                                    >
                                        {displayDay}
                                    </h2>
                                    <div className="space-y-3">
                                        {groupedSchedule[dayKey].map((lesson) => (
                                            <article
                                                key={lesson.id}
                                                className={`flex items-start gap-4 rounded-2xl p-4 shadow-sm border transition ${
                                                    isDark
                                                        ? 'bg-slate-900 border-slate-800/90 text-slate-100'
                                                        : 'bg-white border-slate-200/70 text-slate-800'
                                                }`}
                                            >
                                                <div
                                                    className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 font-bold min-w-[58px] ${
                                                        isDark
                                                            ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/50'
                                                            : 'bg-indigo-50 text-indigo-600'
                                                    }`}
                                                >
                          <span className="text-base leading-none">
                            {lesson.time.replace(/ пара/i, '')}
                          </span>
                                                    <span
                                                        className={`text-[10px] font-medium uppercase mt-1 ${
                                                            isDark ? 'text-indigo-400/80' : 'text-indigo-400'
                                                        }`}
                                                    >
                            {t.lessonWord}
                          </span>
                                                </div>

                                                <div className="flex-1">
                                                    <p
                                                        className={`text-sm font-medium leading-snug whitespace-pre-wrap ${
                                                            isDark ? 'text-slate-100' : 'text-slate-800'
                                                        }`}
                                                    >
                                                        {lesson.subject}
                                                    </p>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}

                        {schedule.length === 0 && (
                            <div
                                className={`rounded-2xl border border-dashed p-8 text-center text-sm ${
                                    isDark
                                        ? 'border-slate-800 text-slate-400'
                                        : 'border-slate-300 text-slate-500'
                                }`}
                            >
                                {t.noLessons}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}

export default App;