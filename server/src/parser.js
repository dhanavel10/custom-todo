/**
 * Natural language capture parser according to Section 7 of implementation.md
 * Supports deterministic parsing of dates, relative times, weekday expressions, and item types.
 */

const MONTH_NAMES = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sept: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11
};

const DAY_NAMES = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6
};

export function parseCapture(rawText, userZone = 'Asia/Kolkata', refDate = new Date()) {
  try {
    if (!rawText || !rawText.trim()) {
      return {
        detectedType: 'UNKNOWN',
        suggestedTitle: '',
        suggestedDueAt: null,
        isAmbiguous: false,
        parseStatus: 'NOT_PROCESSED',
        suggestedReminder: null
      };
    }

    const trimmed = rawText.trim();
    let detectedType = 'TASK';
    let workingText = trimmed;

    // Detect if Idea/Note
    if (/^(idea|note|thought):\s*/i.test(workingText)) {
      detectedType = 'NOTE';
      workingText = workingText.replace(/^(idea|note|thought):\s*/i, '');
    }

    const now = new Date(refDate);
    let targetDate = null;
    let isAmbiguous = false;
    let matchedPattern = null;

    // 1. "in X hours" / "in X days"
    const inTimeRegex = /\b(?:in\s+)?(\d+)\s*(days?|hours?|hrs?|d|h)\b/i;
    const inTimeMatch = workingText.match(inTimeRegex);
    if (inTimeMatch) {
      const amount = parseInt(inTimeMatch[1], 10);
      const unit = inTimeMatch[2].toLowerCase();
      targetDate = new Date(now);
      if (unit.startsWith('d')) {
        targetDate.setDate(targetDate.getDate() + amount);
        targetDate.setHours(18, 0, 0, 0); // Default end of work day
      } else {
        targetDate.setHours(targetDate.getHours() + amount);
      }
      matchedPattern = inTimeMatch[0];
    }

    // 2. "today"
    const todayRegex = /\b(?:by|on|at)?\s*today(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?\b/i;
    const todayMatch = workingText.match(todayRegex);
    if (!targetDate && todayMatch) {
      targetDate = new Date(now);
      if (todayMatch[1]) {
        applyTimeToDate(targetDate, todayMatch[1]);
      } else {
        targetDate.setHours(18, 0, 0, 0);
      }
      matchedPattern = todayMatch[0];
    }

    // 3. "tomorrow"
    const tomorrowRegex = /\b(?:by|on|at)?\s*tomorrow(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?\b/i;
    const tomorrowMatch = workingText.match(tomorrowRegex);
    if (!targetDate && tomorrowMatch) {
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + 1);
      if (tomorrowMatch[1]) {
        applyTimeToDate(targetDate, tomorrowMatch[1]);
      } else {
        targetDate.setHours(18, 0, 0, 0);
      }
      matchedPattern = tomorrowMatch[0];
    }

    // 4. "end of week"
    const endOfWeekRegex = /\b(?:by\s+)?end\s+of\s+(?:the\s+)?week\b/i;
    const endOfWeekMatch = workingText.match(endOfWeekRegex);
    if (!targetDate && endOfWeekMatch) {
      targetDate = new Date(now);
      const day = targetDate.getDay();
      const diffToFriday = (5 - day + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate() + diffToFriday);
      targetDate.setHours(18, 0, 0, 0);
      matchedPattern = endOfWeekMatch[0];
    }

    // 5. Weekday: "next Monday", "this Friday", "by Tuesday at 3pm"
    const weekdayRegex = /\b(?:(?:by|on|this|next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?\b/i;
    const weekdayMatch = workingText.match(weekdayRegex);
    if (!targetDate && weekdayMatch) {
      const targetDayName = weekdayMatch[1].toLowerCase();
      const targetDayNum = DAY_NAMES[targetDayName];
      const isNext = /\bnext\b/i.test(weekdayMatch[0]);

      targetDate = new Date(now);
      let diff = targetDayNum - targetDate.getDay();
      if (diff <= 0 || isNext) {
        diff += 7;
      }
      targetDate.setDate(targetDate.getDate() + diff);
      if (weekdayMatch[2]) {
        applyTimeToDate(targetDate, weekdayMatch[2]);
      } else {
        targetDate.setHours(18, 0, 0, 0);
      }
      matchedPattern = weekdayMatch[0];
    }

    // 6. Explicit month/date: "November 5", "Nov 5th", "5 November", optionally with year and time
    const monthDateRegex = /\b(?:by\s+)?(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?|(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))(?:\s*,?\s*(\d{4}))?(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?\b/i;
    const monthMatch = workingText.match(monthDateRegex);
    if (!targetDate && monthMatch) {
      const monthStr = (monthMatch[1] || monthMatch[4]).toLowerCase();
      const dayNum = parseInt(monthMatch[2] || monthMatch[3], 10);
      const yearStr = monthMatch[5];
      const timeStr = monthMatch[6];

      const monthIndex = MONTH_NAMES[monthStr];
      let targetYear = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

      // If no year was explicitly specified in text, Section 6.3 states:
      // "leaves the date unresolved / NEEDS_REVIEW because a date without a year can be ambiguous"
      if (!yearStr) {
        isAmbiguous = true;
      }

      targetDate = new Date(targetYear, monthIndex, dayNum, 18, 0, 0, 0);
      if (timeStr) {
        applyTimeToDate(targetDate, timeStr);
      }
      matchedPattern = monthMatch[0];
    }

    // Clean suggested title by removing the matched date portion and prepositions
    let suggestedTitle = workingText;
    if (matchedPattern) {
      suggestedTitle = suggestedTitle
        .replace(new RegExp(`(?:\\s+by|\\s+on|\\s+at)?\\s*${escapeRegExp(matchedPattern.trim())}`, 'i'), '')
        .trim();
    }
    // Clean leading/trailing punctuation or connectors
    suggestedTitle = suggestedTitle.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();
    if (!suggestedTitle) {
      suggestedTitle = trimmed;
    }

    let parseStatus = 'PROCESSED';
    if (isAmbiguous) {
      parseStatus = 'NEEDS_REVIEW';
    }

    const suggestedDueAt = targetDate ? targetDate.toISOString() : null;
    const suggestedReminder = suggestedDueAt ? {
      remindAt: targetDate.toISOString(),
      channel: 'IN_APP'
    } : null;

    return {
      detectedType,
      suggestedTitle,
      suggestedDueAt,
      isAmbiguous,
      parseStatus,
      suggestedReminder
    };
  } catch (err) {
    // Parser must NEVER throw or block saving
    return {
      detectedType: 'UNKNOWN',
      suggestedTitle: rawText.trim(),
      suggestedDueAt: null,
      isAmbiguous: false,
      parseStatus: 'FAILED',
      suggestedReminder: null
    };
  }
}

function applyTimeToDate(dateObj, timeStr) {
  if (!timeStr) return;
  const match = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridian = match[3] ? match[3].toLowerCase() : null;

  if (meridian === 'pm' && hours < 12) {
    hours += 12;
  } else if (meridian === 'am' && hours === 12) {
    hours = 0;
  }
  dateObj.setHours(hours, minutes, 0, 0);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
