import Papa from 'papaparse';

const BASE_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQefLGaOwFFyQ26xl8h3M1qPYLMLIZkFusiPt-bFlTEZHT4KSfdL0EFTM94NXyPXOfn5tMT-mUuKYZD/pub';

export interface Lesson {
    id: string;
    day: string;
    time: string;
    subject: string;
}

export interface SheetWeek {
    name: string;
    gid: string;
    weekNumber: number;
}

const TARGET_GROUP = 'ФБ-26';
const ALLOWED_ELECTIVES = ['ЕП-ist4', 'ЕП-ikt1-2'];

// Список доступных недель с точными gid
export const fetchAvailableWeeks = async (): Promise<SheetWeek[]> => {
    return [
        {
            name: '7 тиждень',
            gid: '1083132043',
            weekNumber: 7,
        },
        {
            name: '8 тиждень',
            gid: '769203663',
            weekNumber: 8,
        },
    ];
};

export const fetchAndParseSchedule = async (gid?: string): Promise<Lesson[]> => {
    try {
        const url = gid ? `${BASE_CSV_URL}?gid=${gid}&single=true&output=csv` : `${BASE_CSV_URL}?output=csv`;
        const response = await fetch(url);
        const csvText = await response.text();

        return new Promise((resolve) => {
            Papa.parse(csvText, {
                header: false,
                skipEmptyLines: false,
                complete: (results) => {
                    const rawData = results.data as string[][];
                    const schedule = parseRawData(rawData);
                    resolve(schedule);
                },
            });
        });
    } catch (error) {
        console.error('Помилка завантаження розкладу:', error);
        return [];
    }
};

const cleanText = (str: string) =>
    str.replace(/[\r\n\s]+/g, '').toUpperCase();

const cleanForeignLanguage = (text: string): string => {
    if (text.includes('Іноземна') && text.includes('Глущенко')) {
        return 'Іноземна мова за професійним спрямуванням\nвикл. Глущенко А.В.\nпр.ауд. 719';
    }
    return text;
};

const parseRawData = (rawData: string[][]): Lesson[] => {
    const schedule: Lesson[] = [];
    let groupColIndex = -1;
    let headerRowIndex = -1;

    const targetClean = cleanText(TARGET_GROUP);

    // 1. Пошук колонки групи ФБ-26
    for (let i = 0; i < Math.min(30, rawData.length); i++) {
        const row = rawData[i];
        if (!row) continue;

        const foundIndex = row.findIndex((cell) =>
            cleanText(cell || '').includes(targetClean)
        );

        if (foundIndex !== -1) {
            groupColIndex = foundIndex;
            headerRowIndex = i;
            break;
        }
    }

    if (groupColIndex === -1) {
        console.error(`Групу ${TARGET_GROUP} не знайдено!`);
        return [];
    }

    const daysMap: Record<string, string> = {
        'ПОНЕДІЛОК': 'ПОНЕДІЛОК',
        'ВІВТОРОК': 'ВІВТОРОК',
        'СЕРЕДА': 'СЕРЕДА',
        'ЧЕТВЕР': 'ЧЕТВЕР',
        "П'ЯТНИЦЯ": "П'ЯТНИЦЯ",
        'ПЯТНИЦЯ': "П'ЯТНИЦЯ",
        'СУБОТА': 'СУБОТА',
    };

    let currentDay = '';
    let currentTime = '';

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        // Пошук дня тижня
        for (let c = 0; c < Math.min(3, row.length); c++) {
            const cellClean = cleanText(row[c] || '');
            for (const dayKey of Object.keys(daysMap)) {
                if (cellClean.includes(dayKey)) {
                    currentDay = daysMap[dayKey];
                    currentTime = '';
                    break;
                }
            }
        }

        // Пошук номеру пари
        for (let c = 0; c < Math.min(3, row.length); c++) {
            const cellClean = cleanText(row[c] || '');
            if (/^[IІVХX]+$/.test(cellClean)) {
                const normalizedNumeral = cellClean.replace(/І/g, 'I');
                currentTime = `${normalizedNumeral} пара`;
                break;
            } else if (/^[1-8]$/.test(cellClean)) {
                currentTime = `${cellClean} пара`;
                break;
            }
        }

        let subject = (row[groupColIndex] || '').trim();

        // Якщо в колонці групи порожньо:
        if (!subject) {
            // 1. Пошук вибіркових дисциплін
            const electiveCell = row.find((cell) => {
                if (!cell) return false;
                const normalized = cell.toLowerCase().replace(/\s+/g, '');
                return (
                    normalized.includes('еп-ikt1-2') ||
                    (normalized.includes('ikt1-2') && normalized.includes('сторожук')) ||
                    normalized.includes('еп-ist4') ||
                    (normalized.includes('ist4') && normalized.includes('івангород'))
                );
            });

            if (electiveCell) {
                subject = electiveCell.trim();
            } else {
                // 2. Пошук іноземної мови або спільних потокових пар
                const streamCell = row
                    .slice(2, groupColIndex + 2)
                    .reverse()
                    .find((c) => c && c.trim().length > 5);

                if (
                    streamCell &&
                    !streamCell.includes('ЕП-') &&
                    !streamCell.toLowerCase().includes('тобілевич') &&
                    (streamCell.toLowerCase().includes('лек') ||
                        streamCell.toLowerCase().includes('іноземна') ||
                        streamCell.toLowerCase().includes('глущенко') ||
                        streamCell.toLowerCase().includes('трубенко') ||
                        streamCell.toLowerCase().includes('денисенко') ||
                        streamCell.toLowerCase().includes('математ'))
                ) {
                    subject = cleanForeignLanguage(streamCell.trim());
                }
            }
        } else {
            // Якщо в колонці групи щось є, але це чужа вибіркова дисципліна — фільтруємо
            if (subject.includes('ЕП-')) {
                const normalized = subject.toLowerCase().replace(/\s+/g, '');
                const isMatch =
                    normalized.includes('еп-ikt1-2') ||
                    normalized.includes('еп-ist4') ||
                    normalized.includes('сторожук') ||
                    normalized.includes('івангород');

                if (!isMatch) continue;
            } else if (subject.toLowerCase().includes('іноземна')) {
                subject = cleanForeignLanguage(subject);
            }
        }

        if (!subject) continue;

        if (currentDay) {
            schedule.push({
                id: `${currentDay}-${currentTime || 'пара'}-${i}`,
                day: currentDay,
                time: currentTime || 'Пара',
                subject: subject,
            });
        }
    }

    return schedule;
};