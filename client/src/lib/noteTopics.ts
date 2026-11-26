import { BookOpen, Briefcase, Code2, Feather, Heart, Lightbulb, Tag, Wallet, type LucideIcon } from 'lucide-react';
import type { Note } from '../types';

export type TopicTone = 'primary' | 'teal' | 'amber' | 'coral' | 'green' | 'slate';

export interface SuperTopicDef {
  name: string;
  icon: LucideIcon;
  tone: TopicTone;
  keywords: string[];
}

export const GENERAL_TOPIC = 'General Ideas';

export const SUPER_TOPICS: SuperTopicDef[] = [
  {
    name: 'Product & Tech',
    icon: Code2,
    tone: 'primary',
    keywords: [
      'app', 'api', 'backend', 'frontend', 'code', 'coding', 'bug', 'feature', 'ui', 'ux', 'design',
      'database', 'sql', 'postgres', 'sqlite', 'react', 'flutter', 'docker', 'deploy', 'server',
      'architecture', 'system', 'ai', 'llm', 'model', 'prompt', 'cli', 'script', 'build', 'product',
      'software', 'tech', 'web', 'mobile', 'perf', 'test', 'auth', 'schema', 'endpoint'
    ]
  },
  {
    name: 'Work & Projects',
    icon: Briefcase,
    tone: 'teal',
    keywords: [
      'meeting', 'standup', 'sync', 'team', 'client', 'project', 'roadmap', 'sprint', 'deadline',
      'deliverable', 'milestone', 'review', 'retro', 'proposal', 'deck', 'presentation', 'stakeholder',
      'launch', 'release', 'plan', 'strategy', 'okr', 'kpi', 'hire', 'interview', '1:1', 'work',
      'office', 'agenda', 'follow-up', 'action item'
    ]
  },
  {
    name: 'Learning & Research',
    icon: BookOpen,
    tone: 'amber',
    keywords: [
      'learn', 'learning', 'study', 'course', 'book', 'read', 'reading', 'article', 'paper', 'research',
      'summary', 'notes', 'lecture', 'tutorial', 'concept', 'algorithm', 'math', 'science', 'history',
      'podcast', 'video', 'reference', 'guide', 'how to', 'deep dive', 'framework', 'psychology'
    ]
  },
  {
    name: 'Creative & Writing',
    icon: Feather,
    tone: 'coral',
    keywords: [
      'write', 'writing', 'blog', 'post', 'essay', 'story', 'draft', 'newsletter', 'content', 'video',
      'script', 'thread', 'tweet', 'creative', 'brainstorm', 'sketch', 'music', 'art', 'poem',
      'headline', 'hook', 'outline', 'journal', 'reflection', 'brand'
    ]
  },
  {
    name: 'Personal & Life',
    icon: Heart,
    tone: 'green',
    keywords: [
      'personal', 'life', 'health', 'fitness', 'workout', 'gym', 'meal', 'recipe', 'cook', 'travel',
      'trip', 'vacation', 'flight', 'hotel', 'packing', 'home', 'family', 'friend', 'gift', 'birthday',
      'habit', 'routine', 'morning', 'evening', 'sleep', 'mindfulness', 'weekend', 'shopping', 'grocery'
    ]
  },
  {
    name: 'Finance & Admin',
    icon: Wallet,
    tone: 'slate',
    keywords: [
      'finance', 'budget', 'money', 'tax', 'taxes', 'invoice', 'expense', 'receipt', 'bank', 'invest',
      'investment', 'salary', 'rent', 'bill', 'subscription', 'insurance', 'legal', 'contract',
      'admin', 'paperwork', 'renew', 'passport', 'visa', 'account'
    ]
  }
];

const TOPIC_MAP = new Map(SUPER_TOPICS.map((t) => [t.name.toLowerCase(), t]));
const CUSTOM_TONES: TopicTone[] = ['primary', 'teal', 'amber', 'coral', 'green', 'slate'];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hashTone(name: string): TopicTone {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return CUSTOM_TONES[Math.abs(h) % CUSTOM_TONES.length];
}

export interface ResolvedTopic {
  topic: string;
  isAuto: boolean;
}

/**
 * Resolves a note's super topic: uses the user-assigned topic if present,
 * otherwise infers one from hashtags, prefixes, or weighted keyword matching.
 */
export function resolveNoteTopic(note: Note): ResolvedTopic {
  const manual = note.topic?.trim();
  if (manual) {
    return { topic: manual, isAuto: false };
  }

  const title = (note.title ?? '').toLowerCase();
  const content = (note.content ?? '').toLowerCase();
  const combined = `${title}\n${content}`;

  // 1. Check explicit hashtag like #work, #tech, #finance, #health, #study, #writing
  const hashMatch = /#([a-z][a-z0-9_-]{1,24})/i.exec(combined);
  if (hashMatch) {
    const tag = hashMatch[1].toLowerCase();
    for (const def of SUPER_TOPICS) {
      if (def.name.toLowerCase().includes(tag) || def.keywords.some((kw) => kw === tag)) {
        return { topic: def.name, isAuto: true };
      }
    }
  }

  // 2. Score each built-in super topic (title matches weigh 2x content matches)
  let bestTopic = GENERAL_TOPIC;
  let bestScore = 0;

  for (const def of SUPER_TOPICS) {
    let score = 0;
    for (const kw of def.keywords) {
      const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
      if (re.test(title)) score += 2;
      else if (re.test(content)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = def.name;
    }
  }

  return { topic: bestTopic, isAuto: true };
}

export interface TopicMeta {
  name: string;
  icon: LucideIcon;
  tone: TopicTone;
}

/** Returns icon and color tone for a built-in or custom super topic. */
export function getTopicMeta(topic: string): TopicMeta {
  const key = topic.trim().toLowerCase();
  if (key === GENERAL_TOPIC.toLowerCase()) {
    return { name: GENERAL_TOPIC, icon: Lightbulb, tone: 'slate' };
  }
  const builtIn = TOPIC_MAP.get(key);
  if (builtIn) {
    return { name: builtIn.name, icon: builtIn.icon, tone: builtIn.tone };
  }
  return { name: topic.trim(), icon: Tag, tone: hashTone(key) };
}

export interface NoteTopicGroup {
  topic: string;
  meta: TopicMeta;
  notes: Note[];
}

/**
 * Groups notes into Super Topic buckets ordered by built-in topics first,
 * then custom topics alphabetically, with General Ideas last.
 */
export function groupNotesByTopic(notes: Note[]): NoteTopicGroup[] {
  const buckets = new Map<string, Note[]>();

  for (const note of notes) {
    const { topic } = resolveNoteTopic(note);
    const existing = buckets.get(topic);
    if (existing) existing.push(note);
    else buckets.set(topic, [note]);
  }

  const builtInOrder = new Map(SUPER_TOPICS.map((t, idx) => [t.name, idx]));

  const entries = Array.from(buckets.entries()).sort(([a], [b]) => {
    if (a === GENERAL_TOPIC) return 1;
    if (b === GENERAL_TOPIC) return -1;
    const ia = builtInOrder.get(a);
    const ib = builtInOrder.get(b);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return a.localeCompare(b);
  });

  return entries.map(([topic, groupNotes]) => ({
    topic,
    meta: getTopicMeta(topic),
    notes: groupNotes
  }));
}
