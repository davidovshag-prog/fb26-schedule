
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

const WORKER_URL =
    'https://fb26-schedule-proxy.davidovshag.workers.dev';

const TARGET_GROUP = 'Фб-26';
const TARGET_ELECTIVE = 'ЕП-ikt12-1';

const SATURDAY_ELECTIVES = [
    'ЕП-ist4-1',
    'ЕП-ist4-2',
    'ЕП-ist4-3',
];

export const fetchAvailableWeeks = async (): Promise<SheetWeek[]> => {
    const response = await fetch(`${WORKER_URL}/?action=weeks`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(
            `Не вдалося завантажити список тижнів: HTTP ${response.status}`
        );
    }

    const data: { weeks?: SheetWeek[] } = await response.json();

    if (!Array.isArray(data.weeks)) {
        throw new Error('Worker повернув некоректний список тижнів');
    }

    return data.weeks
        .filter(
            (week) =>
                typeof week.name === 'string' &&
                /^\d+$/.test(week.gid) &&
                Number.isInteger(week.weekNumber)
        )
        .sort((a, b) => a.weekNumber - b.weekNumber);
};

const cleanText = (value: string): string =>
    (value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[\r\n\s]+/g, ' ')
        .trim();

const normalize = (value: string): string =>
    cleanText(value).toLocaleUpperCase('uk-UA');

const normalizeDay = (value: string): string => {
    const day = normalize(value).replace(/\s/g, '');

    const days: Record<string, string> = {
        ПОНЕДІЛОК: 'ПОНЕДІЛОК',
        ВІВТОРОК: 'ВІВТОРОК',
        СЕРЕДА: 'СЕРЕДА',
        ЧЕТВЕР: 'ЧЕТВЕР',
        "П'ЯТНИЦЯ": "П'ЯТНИЦЯ",
        ПЯТНИЦЯ: "П'ЯТНИЦЯ",
        СУБОТА: 'СУБОТА',
    };

    return days[day] || '';
};

const normalizeTime = (value: string): string => {
    const time = normalize(value)
        .replace(/[ІI]/g, 'I')
        .replace(/\s/g, '');

    const numbers: Record<string, string> = {
        I: 'I',
        II: 'II',
        III: 'III',
        IV: 'IV',
        V: 'V',
        VI: 'VI',
        VII: 'VII',
        VIII: 'VIII',
        '1': 'I',
        '2': 'II',
        '3': 'III',
        '4': 'IV',
        '5': 'V',
        '6': 'VI',
        '7': 'VII',
        '8': 'VIII',
    };

    return numbers[time] ? `${numbers[time]} пара` : '';
};

const getPublishedTable = async (gid: string): Promise<Document> => {
    const response = await fetch(
        `${WORKER_URL}/?gid=${encodeURIComponent(gid)}`,
        { cache: 'no-store' }
    );

    if (!response.ok) {
        throw new Error(
            `Не вдалося завантажити розклад: HTTP ${response.status}`
        );
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    if (!doc.querySelector('tr')) {
        throw new Error('Worker не повернув HTML-таблицю');
    }

    return doc;
};

interface GridCell {
    text: string;
    start: number;
    end: number;
}

const buildGrid = (
    rows: HTMLTableRowElement[]
): (GridCell | undefined)[][] => {
    const grid: (GridCell | undefined)[][] = [];

    rows.forEach((row, rowIndex) => {
        grid[rowIndex] ??= [];

        let column = 0;

        Array.from(row.cells).forEach((cell) => {
            while (grid[rowIndex][column]) {
                column++;
            }

            const colspan = cell.colSpan || 1;
            const rowspan = cell.rowSpan || 1;

            const text = cleanText(
                cell.innerText || cell.textContent || ''
            );

            const gridCell: GridCell = {
                text,
                start: column,
                end: column + colspan - 1,
            };

            for (
                let r = rowIndex;
                r < Math.min(rows.length, rowIndex + rowspan);
                r++
            ) {
                grid[r] ??= [];

                for (let c = column; c < column + colspan; c++) {
                    grid[r][c] = gridCell;
                }
            }

            column += colspan;
        });
    });

    return grid;
};

const parseHtmlSchedule = (doc: Document): Lesson[] => {
    const rows = Array.from(
        doc.querySelectorAll('tr')
    ) as HTMLTableRowElement[];

    if (!rows.length) {
        throw new Error('У HTML не знайдено рядків таблиці');
    }

    const grid = buildGrid(rows);

    const headerRow = grid.find((row) =>
        row?.some((cell) => cell?.text === TARGET_GROUP)
    );

    const groupColumn = headerRow?.findIndex(
        (cell) => cell?.text === TARGET_GROUP
    ) ?? -1;

    if (groupColumn === -1) {
        throw new Error(`Не знайдено колонку ${TARGET_GROUP}`);
    }

    const lessons: Lesson[] = [];
    const added = new Set<string>();

    let currentDay = '';

    const dayOrder = [
        'ПОНЕДІЛОК',
        'ВІВТОРОК',
        'СЕРЕДА',
        'ЧЕТВЕР',
        "П'ЯТНИЦЯ",
        'СУБОТА',
    ];

    const timeOrder = [
        'I пара',
        'II пара',
        'III пара',
        'IV пара',
        'V пара',
        'VI пара',
        'VII пара',
        'VIII пара',
    ];

    const addLesson = (
        day: string,
        time: string,
        subject: string,
        rowIndex: number
    ) => {
        const cleanSubject = cleanText(subject);

        if (!day || !time || !cleanSubject) return;

        const key = [
            day,
            time,
            normalize(cleanSubject),
        ].join('|');

        if (added.has(key)) return;

        added.add(key);

        lessons.push({
            id: `${day}-${time}-${rowIndex}-${lessons.length}`,
            day,
            time,
            subject: cleanSubject,
        });
    };

    rows.forEach((_row, rowIndex) => {
        const cells = grid[rowIndex] || [];

        const day = cells
            .map((cell) => cell?.text || '')
            .map(normalizeDay)
            .find(Boolean);

        if (day) {
            currentDay = day;
        }

        if (!currentDay) return;

        const time = cells
            .map((cell) => cell?.text || '')
            .map(normalizeTime)
            .find(Boolean);

        if (!time) return;

        const seenCells = new Set<GridCell>();

        for (const cell of cells) {
            if (!cell || seenCells.has(cell)) continue;

            seenCells.add(cell);

            if (!cell.text) continue;

            if (normalizeDay(cell.text) || normalizeTime(cell.text)) {
                continue;
            }

            const normalizedSubject = normalize(cell.text);

            // Все четыре подгруппы ИКТ-1.
            const isIkt1Elective =
                /ЕП\s*-\s*ikt1\s*-\s*[1-4](?!\d)/i.test(cell.text);

            // Субботние выборочные занятия.
            const isSaturdayElective =
                currentDay === 'СУБОТА' &&
                SATURDAY_ELECTIVES.some((elective) =>
                    normalizedSubject.includes(normalize(elective))
                );

            const belongsToGroup =
                cell.start <= groupColumn &&
                cell.end >= groupColumn;

            // Выборочные подгруппы могут находиться вне колонки группы.
            if (
                !belongsToGroup &&
                !isSaturdayElective &&
                !isIkt1Elective
            ) {
                continue;
            }

            // Исключаем субботние подгруппы, которых нет в списке.
            if (
                currentDay === 'СУБОТА' &&
                /ЕП\s*-\s*ist/i.test(cell.text)
            ) {
                if (isSaturdayElective) {
                    addLesson(
                        currentDay,
                        time,
                        cell.text,
                        rowIndex
                    );
                }

                continue;
            }

            // Обрабатываем выборочные предметы.
            if (/ЕП\s*-\s*(ikt|ist)/i.test(cell.text)) {
                const isLutsenkoLesson =
                    /ЛУЦЕНКО/i.test(cell.text);

                if (
                    currentDay !== 'СУБОТА' &&
                    !isLutsenkoLesson &&
                    (
                        isIkt1Elective ||
                        normalizedSubject.includes(
                            normalize(TARGET_ELECTIVE)
                        )
                    )
                ) {
                    addLesson(
                        currentDay,
                        time,
                        cell.text,
                        rowIndex
                    );
                }

                continue;
            }

            addLesson(
                currentDay,
                time,
                cell.text,
                rowIndex
            );
        }
    });

    return lessons.sort((a, b) => {
        const dayDifference =
            dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);

        if (dayDifference !== 0) {
            return dayDifference;
        }

        return timeOrder.indexOf(a.time) - timeOrder.indexOf(b.time);
    });
};

export const fetchAndParseSchedule = async (
    gid?: string
): Promise<Lesson[]> => {
    try {
        const selectedGid = gid || '769203663';

        const doc = await getPublishedTable(selectedGid);
        const lessons = parseHtmlSchedule(doc);

        console.log('Завантажено занять:', lessons.length);
        console.table(lessons);

        return lessons;
    } catch (error) {
        console.error('Помилка завантаження розкладу:', error);

        return [];
    }
};
