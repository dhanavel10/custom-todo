import { parseCapture } from './parser.js';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Configurable Ollama configuration (supports local and cloud Ollama instances)
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || (process.env.OLLAMA_API_KEY ? 'https://ollama.com' : 'http://localhost:11434');
const PREFERRED_MODEL = process.env.OLLAMA_MODEL || 'nemotron-3-nano:30b';

/**
 * Check if Ollama service is reachable and retrieve available models.
 */
export async function getOllamaStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.OLLAMA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.OLLAMA_API_KEY}`;
    }

    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        connected: false,
        baseUrl: OLLAMA_BASE_URL,
        model: PREFERRED_MODEL,
        availableModels: [],
        error: `Ollama HTTP ${res.status}`
      };
    }

    const data = await res.json();
    const modelNames = (data.models || []).map((m) => m.name);
    // Find best matching model: either exact preferred, any 30b/31b/32b model, or other capable models
    const activeModel = modelNames.find((m) => m === PREFERRED_MODEL) ||
      modelNames.find((m) => /30b|31b|32b/i.test(m)) ||
      modelNames.find((m) => m.includes('nemotron') || m.includes('gemma') || m.includes('llama') || m.includes('qwen') || m.includes('mistral') || m.includes('phi')) ||
      PREFERRED_MODEL;

    return {
      connected: true,
      baseUrl: OLLAMA_BASE_URL,
      model: activeModel,
      availableModels: modelNames
    };
  } catch (err) {
    return {
      connected: false,
      baseUrl: OLLAMA_BASE_URL,
      model: PREFERRED_MODEL,
      availableModels: [],
      error: err.message
    };
  }
}

/**
 * Intelligent task categorization, urgency detection, date parsing,
 * and Eisenhower Matrix assignment using Ollama cloud/local model.
 */
export async function analyzeTaskWithAI({
  title,
  description = '',
  deadline = null,
  userTimeZone = 'Asia/Kolkata',
  refDate = new Date()
}) {
  const status = await getOllamaStatus();
  const textToAnalyze = [title, description].filter(Boolean).join('\nDescription: ');
  const now = refDate instanceof Date ? refDate : new Date(refDate);
  const refDateIso = now.toISOString();

  if (status.connected && status.model) {
    try {
      const prompt = `You are an expert classifier for the Eisenhower Matrix.
Task Title: "${title}"
Details: "${description || 'None'}"
User Specified Deadline: "${deadline || 'None'}"
Reference Date: ${refDateIso}

Classification Rules:
- DO_FIRST: Urgent (imminent deadline, pressing crisis) AND Important (high value).
- SCHEDULE: Not Urgent (flexible time, no immediate fire) AND Important (study, learning, health, strategy, planning, high long-term value).
- DELEGATE: Urgent (time-sensitive, immediate) AND Not Important (routine chore, minor errand, low personal impact).
- ELIMINATE: Not Urgent AND Not Important (trivial leisure, distraction).
- isDeadline: true ONLY if a date is specifically mentioned as a completion cutoff or due date. If no deadline is stated, set isDeadline to false and resolvedDeadline to null.

Output JSON:
{
  "category": "Work or Personal or Finance or Health or Study or Home or Admin or General",
  "urgency": "URGENT or NOT_URGENT",
  "importance": "IMPORTANT or NOT_IMPORTANT",
  "eisenhowerQuadrant": "DO_FIRST or SCHEDULE or DELEGATE or ELIMINATE",
  "urgencyScore": 1 to 10,
  "importanceScore": 1 to 10,
  "isDeadline": true or false,
  "resolvedDeadline": "YYYY-MM-DD or relative text or null",
  "reasoning": "one sentence explanation"
}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for CPU/GPU

      const headers = { 'Content-Type': 'application/json' };
      if (process.env.OLLAMA_API_KEY) {
        headers['Authorization'] = `Bearer ${process.env.OLLAMA_API_KEY}`;
      }

      const response = await fetch(`${status.baseUrl}/api/generate`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: status.model,
          prompt,
          format: 'json',
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 4096
          }
        })
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        const parsedRaw = extractJson(result.response) || extractJson(result.thinking) || {};
        const parsed = parsedRaw.task || parsedRaw;

        // Resolve date / deadline
        let resolvedIso = deadline || null;
        const candidateDate = parsed.resolvedDeadline || parsed.deadline;
        if (candidateDate && typeof candidateDate === 'string' && candidateDate.toLowerCase() !== 'none') {
          // Check if candidate is valid ISO
          if (!isNaN(Date.parse(candidateDate))) {
            resolvedIso = new Date(candidateDate).toISOString();
          } else {
            // Parse relative string (e.g. "tomorrow 9am")
            const relativeParsed = parseCapture(candidateDate, userTimeZone, now);
            if (relativeParsed.suggestedDueAt) {
              resolvedIso = relativeParsed.suggestedDueAt;
            }
          }
        }

        // Also check if text has dates using NLP parser if model didn't resolve full ISO
        if (!resolvedIso) {
          const nlpParsed = parseCapture(`${title} ${description}`, userTimeZone, now);
          if (nlpParsed.suggestedDueAt) {
            resolvedIso = nlpParsed.suggestedDueAt;
          }
        }

        // Sanitize and validate fields robustly
        let rawQuadrant = String(parsed.eisenhowerQuadrant || '').toUpperCase();
        if (rawQuadrant.includes('FIRST') || rawQuadrant.includes('Q1') || rawQuadrant === 'DO_FIRST') {
          rawQuadrant = 'DO_FIRST';
        } else if (rawQuadrant.includes('SCHEDULE') || rawQuadrant.includes('Q2')) {
          rawQuadrant = 'SCHEDULE';
        } else if (rawQuadrant.includes('DELEGATE') || rawQuadrant.includes('Q3')) {
          rawQuadrant = 'DELEGATE';
        } else if (rawQuadrant.includes('ELIMINATE') || rawQuadrant.includes('Q4')) {
          rawQuadrant = 'ELIMINATE';
        } else {
          rawQuadrant = null;
        }

        const rawUrgency = String(parsed.urgency || '').toUpperCase();
        const rawImportance = String(parsed.importance || '').toUpperCase();
        const urgency = rawUrgency.includes('URGENT') && !rawUrgency.includes('NOT') ? 'URGENT' : 'NOT_URGENT';
        const importance = rawImportance.includes('IMPORTANT') && !rawImportance.includes('NOT') ? 'IMPORTANT' : 'NOT_IMPORTANT';

        const quadrant = rawQuadrant || deriveQuadrant(urgency, importance);
        const isDeadline = Boolean(parsed.isDeadline) || Boolean(deadline) || Boolean(resolvedIso);

        const detectedDates = Array.isArray(parsed.detectedDates) && parsed.detectedDates.length > 0
          ? parsed.detectedDates
          : resolvedIso
          ? [{
              raw: candidateDate || title,
              dateISO: resolvedIso,
              isDeadline,
              reason: isDeadline ? 'Identified as task completion deadline' : 'Mentioned date reference'
            }]
          : [];

        return {
          category: parsed.category || 'General',
          urgency,
          importance,
          eisenhowerQuadrant: quadrant,
          isDeadline,
          resolvedDeadline: resolvedIso,
          detectedDates,
          aiAnalysis: {
            source: 'ollama',
            model: status.model,
            urgencyScore: parsed.urgencyScore || (urgency === 'URGENT' ? 8 : 3),
            importanceScore: parsed.importanceScore || (importance === 'IMPORTANT' ? 8 : 3),
            reasoning: parsed.reasoning || `Classified as ${quadrant} based on task description and timeline.`
          }
        };
      }
    } catch (err) {
      console.warn('Ollama API inference skipped or failed, using natural language fallback:', err.message);
    }
  }

  // Fallback to robust deterministic NLP analyzer
  return fallbackAnalyzeTask({ title, description, deadline, userTimeZone, refDate });
}

/**
 * Map Urgency + Importance into an Eisenhower Quadrant
 */
function deriveQuadrant(urgency, importance) {
  const isUrgent = (urgency || '').toUpperCase() === 'URGENT';
  const isImportant = (importance || '').toUpperCase() === 'IMPORTANT';

  if (isUrgent && isImportant) return 'DO_FIRST';
  if (!isUrgent && isImportant) return 'SCHEDULE';
  if (isUrgent && !isImportant) return 'DELEGATE';
  return 'ELIMINATE';
}

/**
 * Helper to robustly extract and parse JSON from model responses or thinking tags
 */
function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  let clean = text.trim();
  if (clean.includes('```')) {
    clean = clean.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  }
  try {
    return JSON.parse(clean);
  } catch {}

  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = clean.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
    try {
      const sanitized = candidate
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/\/\/.*/g, '');
      return JSON.parse(sanitized);
    } catch {}
  }
  return null;
}

/**
 * Natural Language Fallback Classifier (ensures zero downtime if Ollama is loading or unreachable)
 */
export function fallbackAnalyzeTask({
  title = '',
  description = '',
  deadline = null,
  userTimeZone = 'Asia/Kolkata',
  refDate = new Date()
}) {
  const combined = `${title} ${description}`.trim().toLowerCase();
  const now = refDate instanceof Date ? refDate : new Date(refDate);

  // 1. Detect Category based on description and keywords
  let category = 'General';
  if (/\b(tax|invoice|bill|payment|salary|finance|bank|budget|invest|expense)\b/i.test(combined)) {
    category = 'Finance';
  } else if (/\b(doctor|dentist|health|medicine|workout|gym|exercise|hospital|clinic|run)\b/i.test(combined)) {
    category = 'Health';
  } else if (/\b(study|learn|course|exam|read|book|homework|research|cert)\b/i.test(combined)) {
    category = 'Study';
  } else if (/\b(clean|laundry|groceries|grocery|cook|dinner|shop|repair|home)\b/i.test(combined)) {
    category = 'Personal';
  } else if (/\b(client|deploy|deployment|build|code|bug|release|pr|presentation|slide|report|meeting|boss|jira|team)\b/i.test(combined)) {
    category = 'Work';
  } else if (/\b(email|call|reply|message|slack|schedule|admin|follow up)\b/i.test(combined)) {
    category = 'Admin';
  }

  // 2. Extract Dates & Identify if it is a Deadline
  const detectedDates = [];
  let isDeadline = false;
  let resolvedDeadline = deadline || null;

  // Use natural language parser
  const parsedCapture = parseCapture(combined, userTimeZone, now);
  if (parsedCapture.suggestedDueAt) {
    // Check if the surrounding words imply a deadline vs general reference
    const deadlineKeywords = /\b(deadline|due|by|before|submit|cutoff|must finish|complete by|finish by)\b/i;
    const isHardDeadline = deadlineKeywords.test(combined) || Boolean(deadline);

    detectedDates.push({
      raw: parsedCapture.suggestedTitle || combined,
      dateISO: parsedCapture.suggestedDueAt,
      isDeadline: isHardDeadline,
      reason: isHardDeadline
        ? 'Identified as a critical completion deadline'
        : 'Date mentioned in context as reference or scheduled event'
    });

    if (!resolvedDeadline && isHardDeadline) {
      resolvedDeadline = parsedCapture.suggestedDueAt;
    }
    isDeadline = isHardDeadline;
  }

  if (deadline) {
    isDeadline = true;
    if (!detectedDates.some((d) => d.dateISO === deadline)) {
      detectedDates.unshift({
        raw: 'User specified deadline',
        dateISO: deadline,
        isDeadline: true,
        reason: 'Explicitly provided deadline'
      });
    }
  }

  // 3. Determine Urgency
  const urgentKeywords = /\b(asap|urgent|immediately|emergency|critical|today|tonight|crisis|overdue|breaking)\b/i;
  let isUrgent = urgentKeywords.test(combined);

  // If deadline is within 48 hours, it's urgent
  if (resolvedDeadline) {
    const diffHours = (new Date(resolvedDeadline).getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours <= 48 && diffHours >= -24) {
      isUrgent = true;
    }
  }

  // 4. Determine Importance
  const importantKeywords = /\b(important|critical|key|vital|high impact|goal|health|tax|client|exam|career|strategic|project)\b/i;
  const lowValueKeywords = /\b(browse|social|scroll|tv|game|chill|maybe|later|someday|trivial|routine)\b/i;

  let isImportant = importantKeywords.test(combined) || category === 'Work' || category === 'Finance' || category === 'Health';
  if (lowValueKeywords.test(combined)) {
    isImportant = false;
  }

  const urgency = isUrgent ? 'URGENT' : 'NOT_URGENT';
  const importance = isImportant ? 'IMPORTANT' : 'NOT_IMPORTANT';
  const eisenhowerQuadrant = deriveQuadrant(urgency, importance);

  return {
    category,
    urgency,
    importance,
    eisenhowerQuadrant,
    isDeadline,
    resolvedDeadline,
    detectedDates,
    aiAnalysis: {
      source: 'nlp_fallback',
      model: 'deterministic_nlp_classifier',
      urgencyScore: isUrgent ? 8 : 3,
      importanceScore: isImportant ? 8 : 4,
      reasoning: `Categorized as ${category} and placed into ${eisenhowerQuadrant} (${urgency} & ${importance}).`
    }
  };
}
