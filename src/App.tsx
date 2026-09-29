import { type FormEvent, type ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  Bell,
  Brain,
  CalendarClock,
  CalendarDays,
  Check,
  CheckSquare2,
  CircleCheck,
  Clock3,
  Inbox,
  LayoutDashboard,
  ListTodo,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import './index.css';

type TaskStatus = 'active' | 'completed';
type ScheduleType = 'task' | 'reminder';
type ActivityType = 'task' | 'memory' | 'schedule' | 'chat' | 'system';
type Role = 'user' | 'assistant';
type Intent = 'GENERAL_CONVERSATION' | 'QUESTION' | 'MEMORY_SAVE' | 'MEMORY_RETRIEVE' | 'MEMORY_LIST' | 'MEMORY_UPDATE' | 'MEMORY_DELETE' | 'TASK_CREATE' | 'TASK_UPDATE' | 'TASK_COMPLETE' | 'TASK_DELETE' | 'TASK_LIST' | 'REMINDER_CREATE' | 'REMINDER_UPDATE' | 'REMINDER_DELETE' | 'REMINDER_LIST' | 'SCHEDULE_QUERY' | 'ACTIVITY_QUERY' | 'HELP' | 'UNKNOWN';
type ActionLevel = 'AUTO' | 'ASK' | 'BLOCKED';

type Task = { id: string; title: string; description: string; date: string; time: string; status: TaskStatus; createdAt: string };
type Memory = { id: string; text: string; createdAt: string; category?: string; importance?: 'low' | 'normal' | 'high' };
type ScheduleItem = { id: string; title: string; description: string; date: string; time: string; type: ScheduleType; createdAt: string };
type ChatMessage = { id: string; role: Role; text: string; createdAt: string };
type ActivityItem = { id: string; type: ActivityType; title: string; detail: string; createdAt: string };
type Settings = { name: string; assistantName: string; dailyBriefing: boolean; gentleNudges: boolean; timezone: string };
type LastAction = { kind: 'task' | 'reminder' | 'memory'; id: string; title?: string; text?: string };

const queryClient = new QueryClient();
const STORAGE = {
  tasks: 'dangote-junior.tasks',
  memories: 'dangote-junior.memories',
  schedule: 'dangote-junior.schedule',
  messages: 'dangote-junior.messages',
  activity: 'dangote-junior.activity',
  settings: 'dangote-junior.settings',
};
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const localDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const today = () => localDateString(new Date());
const inDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
};
const formatDate = (date: string) => {
  if (!date) return 'No date set';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
};
const formatTime = (time: string) => time || 'Any time';
const formatStamp = (stamp: string) => {
  const date = new Date(stamp);
  const difference = Math.round((Date.now() - date.getTime()) / 60000);
  if (difference < 1) return 'just now';
  if (difference < 60) return `${difference}m ago`;
  if (difference < 1440) return `${Math.round(difference / 60)}h ago`;
  return `${Math.round(difference / 1440)}d ago`;
};

const seedTasks: Task[] = [
  { id: 'task-seed-1', title: 'Review the week ahead', description: 'Choose the three outcomes that would make this week feel lighter.', date: today(), time: '09:30', status: 'active', createdAt: now() },
  { id: 'task-seed-2', title: 'Send the project update', description: 'A short, clear note to close the loop with the team.', date: inDays(1), time: '14:00', status: 'active', createdAt: now() },
  { id: 'task-seed-3', title: 'Move the body for 30 minutes', description: 'A walk counts. Keep the promise small and real.', date: inDays(-1), time: '18:30', status: 'completed', createdAt: now() },
];
const seedMemories: Memory[] = [
  { id: 'memory-seed-1', text: 'Protect quiet mornings for thinking before opening the inbox.', createdAt: now() },
  { id: 'memory-seed-2', text: 'The preferred tone is warm, direct, and never over-explained.', createdAt: now() },
];
const seedSchedule: ScheduleItem[] = [
  { id: 'schedule-seed-1', title: 'Deep work window', description: 'Keep notifications quiet and stay with one meaningful thing.', date: today(), time: '10:00', type: 'reminder', createdAt: now() },
  { id: 'schedule-seed-2', title: 'Call Mum', description: 'A small commitment that deserves a visible place.', date: inDays(2), time: '19:00', type: 'task', createdAt: now() },
];
const seedMessages: ChatMessage[] = [
  { id: 'message-seed-1', role: 'assistant', text: 'Good to see you. I can keep track of the things you want to remember, the promises you want to keep, and the moments you want to make space for.', createdAt: now() },
];
const seedActivity: ActivityItem[] = [
  { id: 'activity-seed-1', type: 'system', title: 'Your command center is ready', detail: 'A few thoughtful examples are here to show you around.', createdAt: now() },
  { id: 'activity-seed-2', type: 'memory', title: 'Memory kept', detail: 'Protect quiet mornings for thinking before opening the inbox.', createdAt: now() },
  { id: 'activity-seed-3', type: 'schedule', title: 'Reminder placed', detail: 'Deep work window · Today at 10:00', createdAt: now() },
];
const defaultSettings: Settings = { name: 'Friend', assistantName: 'Junior', dailyBriefing: true, gentleNudges: true, timezone: 'Local time' };

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, '').replace(/\s+/g, ' ').trim();
}

function formatPersonalName(value: string) {
  return /^hacker\s*pro$/i.test(value.trim()) ? 'Hacker Pro' : value.trim();
}

function parseMemoryFact(text: string) {
  return normalizeText(text).match(/^my\s+(.+?)\s+(is|are|was|were)\s+(.+)$/);
}

function findRelevantMemories(question: string, memories: Memory[]) {
  const normalizedQuestion = normalizeText(question).replace(/'s\b/g, ' is');
  const subjectMatch = normalizedQuestion.match(/^(?:what|who|where|when)\s+(?:is|are|was|were)?\s*my\s+(.+)$/)
    ?? (normalizedQuestion === 'who am i' ? ['', 'name'] : null);
  if (subjectMatch) {
    const requestedSubject = subjectMatch[1].replace(/\b(?:please|again)\b/g, '').trim();
    return memories.filter((memory) => {
      const fact = parseMemoryFact(memory.text);
      if (!fact) return false;
      const subject = fact[1];
      return requestedSubject === subject || requestedSubject.includes(subject) || subject.includes(requestedSubject);
    });
  }

  const actionMatch = normalizedQuestion.match(/^(?:where|what|when|how)\s+do\s+i\s+([a-z]+)\b/);
  if (actionMatch) {
    return memories.filter((memory) => {
      const fact = normalizeText(memory.text).match(/^i\s+([a-z]+)\s+(.+?)\s*[.!?]*$/i);
      return Boolean(fact && fact[1] === actionMatch[1]);
    });
  }

  const ignoredWords = new Set(['what', 'whats', 'who', 'where', 'when', 'why', 'how', 'which', 'does', 'did', 'are', 'was', 'were', 'have', 'has', 'had', 'your', 'you', 'my', 'me', 'the', 'this', 'that', 'about', 'from', 'with', 'tell', 'know', 'remember', 'please']);
  const topicWords = normalizedQuestion.split(' ').filter((word) => word.length > 2 && !ignoredWords.has(word));
  return topicWords.length
    ? memories.filter((memory) => topicWords.some((word) => new Set(normalizeText(memory.text).split(' ')).has(word)))
    : [];
}

function answerFromMemories(question: string, memories: Memory[]) {
  const matchingMemories = findRelevantMemories(question, memories);
  if (!matchingMemories.length) return null;
  const normalizedMatches = new Set(matchingMemories.map((memory) => normalizeText(memory.text)));
  if (normalizedMatches.size > 1) {
    return `I found conflicting saved memories: ${matchingMemories.map((memory) => `“${memory.text}”`).join(' and ')} Which one is correct?`;
  }

  const fact = parseMemoryFact(matchingMemories[0].text);
  if (fact) {
    const subject = fact[1] === 'name' ? 'name' : fact[1];
    const displayValue = matchingMemories[0].text.match(/^my\s+.+?\s+(?:is|are|was|were)\s+(.+?)\s*[.!?]*$/i)?.[1] ?? fact[3];
    return `Your ${subject} ${fact[2]} ${formatPersonalName(displayValue)}.`;
  }

  const actionMatch = normalizeText(question).match(/^(?:where|what|when|how)\s+do\s+i\s+([a-z]+)\b/);
  if (actionMatch) {
    const actionFact = normalizeText(matchingMemories[0].text).match(/^i\s+([a-z]+)\s+(.+?)\s*[.!?]*$/i);
    if (actionFact) return `You ${actionFact[1]} ${actionFact[2]}.`;
  }
  return `I remember: ${matchingMemories[0].text}`;
}

type ParsedWhen = { date: string | null; time: string | null; datePhrase: string; timePhrase: string; ambiguousDate: boolean; ambiguousTime: boolean };
type ParsedTaskRequest = { title: string; date: string | null; time: string | null; ambiguousDate: boolean; ambiguousTime: boolean };
type ParsedReminderRequest = ParsedTaskRequest;
type DetectedIntent = { intent: Intent; task?: ParsedTaskRequest; reminder?: ParsedReminderRequest; memoryText?: string; query?: string; date?: string | null; time?: string | null; value?: string; status?: 'active' | 'completed' | 'all' };

const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function nextWeekdayDate(dayName: string, mode: 'next' | 'this') {
  const target = weekdayNames.indexOf(dayName.toLowerCase());
  const current = new Date().getDay();
  let difference = (target - current + 7) % 7;
  if (mode === 'next' && difference === 0) difference = 7;
  return inDays(difference);
}

function parseWhen(text: string): ParsedWhen {
  const timeMatch = text.match(/\b(?:at\s*)?(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i)
    ?? text.match(/\b(?:at\s*)?([01]?\d|2[0-3]):([0-5]\d)\b/)
    ?? text.match(/\bat\s+([01]?\d|2[0-3])\b/i);
  let time: string | null = null;
  let ambiguousTime = false;
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] ?? '00');
    const meridiem = timeMatch[3]?.replace(/\./g, '').toLowerCase();
    const normalizedHour = meridiem ? (hour % 12) + (meridiem === 'pm' ? 12 : 0) : hour;
    time = `${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    ambiguousTime = !meridiem && !timeMatch[0].includes(':');
  }

  let date: string | null = null;
  let datePhrase = '';
  let ambiguousDate = false;
  const explicitDate = text.match(/\b(?:on\s+)?(\d{4}-\d{2}-\d{2})\b/);
  const relativeWeekday = text.match(/\b(next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  const weekday = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  const tomorrow = text.match(/\btomorrow\b/i);
  const todayMatch = text.match(/\b(?:today|tonight)\b/i);
  const nextWeek = text.match(/\bnext\s+week\b/i);
  if (tomorrow) {
    date = inDays(1);
    datePhrase = tomorrow[0];
  } else if (todayMatch) {
    date = today();
    datePhrase = todayMatch[0];
  } else if (relativeWeekday) {
    date = nextWeekdayDate(relativeWeekday[2], relativeWeekday[1].toLowerCase() as 'next' | 'this');
    datePhrase = relativeWeekday[0];
  } else if (explicitDate) {
    date = explicitDate[1];
    datePhrase = explicitDate[0];
  } else if (nextWeek) {
    datePhrase = nextWeek[0];
    ambiguousDate = true;
  } else if (weekday) {
    datePhrase = weekday[0];
    ambiguousDate = true;
  }
  return { date, time, datePhrase, timePhrase: timeMatch?.[0] ?? '', ambiguousDate, ambiguousTime };
}

function stripWhen(text: string, when: ParsedWhen) {
  return text
    .replace(when.timePhrase, '')
    .replace(when.datePhrase ? new RegExp(`\\b${escapeRegExp(when.datePhrase)}\\b`, 'i') : '', '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:to|for)\s+/i, '')
    .replace(/^[\s:,-]+|[\s.,!?-]+$/g, '')
    .trim();
}

function requestFromWhen(title: string, when: ParsedWhen): ParsedTaskRequest {
  return { title, date: when.date, time: when.time, ambiguousDate: when.ambiguousDate, ambiguousTime: when.ambiguousTime };
}

function parseTaskRequest(text: string): ParsedTaskRequest | null {
  const clean = text.trim();
  const command = clean.match(/^(?:please\s+)?(?:create|add|make)\s+(?:a\s+)?task\s*:?\s*(.+)$/i);
  const listCommand = clean.match(/^(?:please\s+)?(?:add|put)\s+(.+?)\s+(?:to|on)\s+(?:my\s+)?task(?:s|list)\b(.*)$/i);
  const needCommand = clean.match(/^(?:please\s+)?(?:i\s+need\s+to|i\s+have\s+to|i\s+should)\s+(.+)$/i);
  const details = command?.[1] ?? (listCommand ? `${listCommand[1]} ${listCommand[2]}` : needCommand?.[1]);
  if (!details) return null;
  const when = parseWhen(details);
  return requestFromWhen(stripWhen(details.replace(/^to\s+/i, ''), when), when);
}

function parseReminderRequest(text: string): ParsedReminderRequest | null {
  const clean = text.trim();
  const command = clean.match(/^(?:please\s+)?(?:can you\s+)?remind\s+me\s*:?\s*(.+)$/i)
    ?? clean.match(/^(?:please\s+)?(?:don't|dont|do not)\s+let\s+me\s+forget\s*:?\s*(.+)$/i)
    ?? clean.match(/^(?:please\s+)?(?:create|add|set)\s+(?:a\s+)?reminder\s*(?:for)?\s*:?\s*(.+)$/i);
  if (!command) return null;
  const when = parseWhen(command[1]);
  return requestFromWhen(stripWhen(command[1], when), when);
}

function parseMemorySaveRequest(text: string) {
  const clean = text.trim();
  if (/\?\s*$/.test(clean)) return null;
  const command = clean.match(/^(?:please\s+)?(?:remember(?:\s+that)?|save\s+(?:this|that)?|keep\s+in\s+mind(?:\s+that)?)\s*:?\s*(.+)$/i);
  return command?.[1].trim().replace(/^[\s:,-]+|[\s.,!?-]+$/g, '') || null;
}

function parseTaskTarget(text: string, action: 'update' | 'complete' | 'delete') {
  const clean = text.trim().replace(/[.!?]+$/, '');
  if (action === 'update') {
    const match = clean.match(/^(?:please\s+)?(?:change|update|move|reschedule)\s+(?:my\s+)?(.+?)(?:\s+task)?\s+(?:to|for)\s+(.+)$/i)
      ?? clean.match(/^(?:please\s+)?(?:change|update)\s+(?:my\s+)?(.+?)\s+task$/i);
    if (!match) return null;
    const when = match[2] ? parseWhen(match[2]) : { date: null, time: null, ambiguousDate: false, ambiguousTime: false };
    return { query: match[1].trim(), date: when.date, time: when.time, ambiguousDate: when.ambiguousDate, ambiguousTime: when.ambiguousTime };
  }
  if (action === 'complete') {
    const mark = clean.match(/^(?:please\s+)?mark\s+(?:my\s+)?(.+?)(?:\s+task)?\s+(?:as\s+)?(?:completed|complete|done)$/i);
    const direct = clean.match(/^(?:please\s+)?(?:complete|finish|check off)\s+(?:the\s+)?(.+?)(?:\s+task)?$/i);
    const statement = clean.match(/^(?:please\s+)?(?:i\s+)?(?:finished|completed)\s+(?:the\s+)?(.+?)(?:\s+task)?$/i);
    const match = mark ?? direct ?? statement;
    return match ? { query: match[1].trim().replace(/\s+task$/i, '') } : null;
  }
  const match = clean.match(/^(?:please\s+)?(?:delete|remove|cancel)\s+(?:my\s+)?(.+?)(?:\s+task)?$/i);
  return match ? { query: match[1].trim().replace(/\s+task$/i, '') } : null;
}

function parseReminderTarget(text: string, action: 'update' | 'delete') {
  const clean = text.trim().replace(/[.!?]+$/, '');
  if (action === 'update') {
    const match = clean.match(/^(?:please\s+)?(?:change|update|move|reschedule)\s+(?:my\s+)?(.+?)\s+reminder\s+(?:to|for)\s+(.+)$/i);
    if (!match) return null;
    const when = parseWhen(match[2]);
    return { query: match[1].trim(), date: when.date, time: when.time, ambiguousDate: when.ambiguousDate, ambiguousTime: when.ambiguousTime };
  }
  const match = clean.match(/^(?:please\s+)?(?:delete|remove|cancel)\s+(?:my\s+)?(.+?)(?:\s+reminder)?$/i);
  return match ? { query: match[1].trim().replace(/\s+reminder$/i, '') } : null;
}

function parseMemoryDeleteRequest(text: string) {
  const match = text.trim().match(/^(?:please\s+)?(?:forget|delete|remove)\s+(?:that\s+)?(?:my\s+)?(?:memory\s+about\s+)?(.+)$/i);
  return match?.[1].replace(/^memory\s+(?:about|of)\s+/i, '').trim().replace(/^[\s:,-]+|[\s.,!?-]+$/g, '') || null;
}

function parseMemoryUpdateRequest(text: string) {
  const clean = text.trim().replace(/[.!?]+$/, '');
  const match = clean.match(/^(?:please\s+)?(?:update|change)\s+my\s+(.+?)\s+to\s+(.+)$/i)
    ?? clean.match(/^my\s+(.+?)\s+is\s+now\s+(.+)$/i);
  if (match) return { query: match[1].trim(), value: match[2].trim() };
  const subjectOnly = clean.match(/^(?:please\s+)?change\s+what\s+you\s+remember\s+about\s+my\s+(.+)$/i);
  return subjectOnly ? { query: subjectOnly[1].trim(), value: '' } : null;
}

function isMemoryQuestion(text: string) {
  const clean = text.trim().toLowerCase();
  return /^(?:what|who|where|when|how)\b.*\b(?:my|i|me|we)\b/.test(clean)
    || /^(?:do|did|can)\s+you\s+remember\b/.test(clean);
}

function rememberedName(memories: Memory[]) {
  const memory = memories.find((item) => /^my\s+name\s+is\s+.+$/i.test(item.text.trim()));
  const name = memory?.text.match(/^my\s+name\s+is\s+(.+?)\s*[.!?]*$/i)?.[1];
  return name ? formatPersonalName(name) : null;
}

function answerGeneralConversation(text: string, name: string) {
  const clean = text.trim();
  if (/^(?:good\s+morning|good\s+afternoon|good\s+evening|hello|hi)\b/i.test(clean)) {
    if (/\bhow\s+are\s+you\b/i.test(clean)) return `Good morning, ${name}! I’m doing well. How can I help you today?`;
    return `Hello, ${name}. What would feel useful to take off your mind today?`;
  }
  if (/^how\s+are\s+you\b/i.test(clean)) return `I’m doing well, ${name}. What can I help you with today?`;
  if (/^(?:what'?s up|how is it going)\b/i.test(clean)) return `All good here, ${name}. What would you like to work on?`;
  if (/^(?:thanks|thank you)\b/i.test(clean)) return `You’re welcome, ${name}.`;
  if (/^(?:goodnight|good night)\b/i.test(clean)) return `Goodnight, ${name}. I’ll be here when you need me.`;
  if (/^(?:what\s+is|define)\s+hypertension\b/i.test(clean)) {
    return 'Hypertension is persistently high blood pressure. It can strain the heart and blood vessels over time, so regular checks and medical guidance are important.';
  }
  if (/^i\s+studied\s+.+/i.test(clean)) return 'Nice work. What would you like to do next with what you studied?';
  if (/^(?:what|who|where|when|why|how)\b/i.test(clean)) return 'That’s a good question. I don’t have a live knowledge connection yet, but I can help you think it through.';
  return 'I’m with you. Tell me a little more about what you would like help with.';
}

function helpResponse() {
  return 'I can answer questions, remember information you explicitly save, retrieve and manage memories, create and manage tasks, create and manage reminders, check your schedule, and show your recent activity. Everything stays in this browser. I cannot send WhatsApp messages or automate external services yet.';
}

function isQuestion(text: string) {
  return /\?\s*$/.test(text.trim()) || /^(?:what|who|where|when|why|how|which|can you|could you|would you|do you|did you|is|are|have|has)\b/i.test(text.trim());
}

function isCasualConversation(text: string) {
  return /^(?:good\s+morning|good\s+afternoon|good\s+evening|hello|hi|how are you|what'?s up|how is it going|thanks|thank you|goodnight|good night)\b/i.test(text.trim());
}

function isUnknownRequest(text: string) {
  return /^(?:please\s+)?(?:do something|do anything|help me with something|handle it|take care of it)\b/i.test(text.trim());
}

function resolveReference(query: string, lastAction: LastAction | null, kind: LastAction['kind']) {
  const normalized = normalizeText(query);
  if (lastAction?.kind === kind && /^(?:it|that|this|the task|task|the reminder|reminder|the memory|memory|one)$/.test(normalized)) return lastAction.id;
  return query.replace(/^the\s+/i, '').replace(/\s+(?:task|reminder|memory|one)$/i, '').trim();
}

function detectIntent(text: string, lastAction: LastAction | null): DetectedIntent {
  const task = parseTaskRequest(text);
  if (task) return { intent: 'TASK_CREATE', task };
  const reminder = parseReminderRequest(text);
  if (reminder) return { intent: 'REMINDER_CREATE', reminder };

  const taskComplete = parseTaskTarget(text, 'complete');
  if (taskComplete) return { intent: 'TASK_COMPLETE', query: resolveReference(taskComplete.query, lastAction, 'task') };
  const taskDelete = parseTaskTarget(text, 'delete');
  if (taskDelete && !/\breminders?\b/i.test(text)) return { intent: 'TASK_DELETE', query: resolveReference(taskDelete.query, lastAction, 'task') };
  const taskUpdate = parseTaskTarget(text, 'update');
  if (taskUpdate) return { intent: 'TASK_UPDATE', query: resolveReference(taskUpdate.query, lastAction, 'task'), date: taskUpdate.date, time: taskUpdate.time };
  if (lastAction?.kind === 'task' && /^(?:please\s+)?(?:make|change|move|set|update|reschedule)\s+(?:it|that|the task|my task)\b/i.test(text.trim())) {
    const when = parseWhen(text);
    return { intent: 'TASK_UPDATE', query: lastAction.id, date: when.date, time: when.time };
  }
  const normalizedText = normalizeText(text);
  const taskListRequest = /\b(?:what|which)\s+tasks?\s+(?:do i have|are pending)\b/.test(normalizedText)
    || /\bdo i have any tasks?\b/.test(normalizedText)
    || /\b(?:show|list|display|view)\b.*\b(?:my\s+)?tasks?\b/.test(normalizedText)
    || /\bcan you show (?:me )?my task list\b/.test(normalizedText)
    || /\bwhat do i need to do\b/.test(normalizedText);
  if (taskListRequest) {
    const status = /\b(?:completed|complete|finished|done)\b/.test(normalizedText) ? 'completed' : /\b(?:active|pending|unfinished)\b/.test(normalizedText) ? 'active' : 'all';
    return { intent: 'TASK_LIST', status };
  }

  const reminderDelete = parseReminderTarget(text, 'delete');
  if (reminderDelete && /\b(?:reminder|remind)\b/i.test(text)) return { intent: 'REMINDER_DELETE', query: resolveReference(reminderDelete.query, lastAction, 'reminder') };
  const reminderUpdate = parseReminderTarget(text, 'update');
  if (reminderUpdate) return { intent: 'REMINDER_UPDATE', query: reminderUpdate.query, date: reminderUpdate.date, time: reminderUpdate.time };
  if (lastAction?.kind === 'reminder' && /^(?:please\s+)?(?:make|change|move|set|update|reschedule)\s+(?:it|that|the reminder)\b/i.test(text.trim())) {
    const when = parseWhen(text);
    return { intent: 'REMINDER_UPDATE', query: lastAction.id, date: when.date, time: when.time };
  }
  if (/\b(?:show|list|display|view|what)\b.*\b(?:my\s+)?reminders?\b/i.test(text)) return { intent: 'REMINDER_LIST' };
  if (/\b(?:what|show|list|display|view)\b.*\bscheduled\b/i.test(text)) return { intent: 'SCHEDULE_QUERY', date: parseWhen(text).date };

  const memoryToSave = parseMemorySaveRequest(text);
  if (memoryToSave) return { intent: 'MEMORY_SAVE', memoryText: memoryToSave };
  const memoryUpdate = parseMemoryUpdateRequest(text);
  if (memoryUpdate) return { intent: 'MEMORY_UPDATE', query: memoryUpdate.query, value: memoryUpdate.value };
  const memoryDelete = parseMemoryDeleteRequest(text);
  if (memoryDelete && /\b(?:forget|delete|remove)\b/i.test(text)) return { intent: 'MEMORY_DELETE', query: resolveReference(memoryDelete, lastAction, 'memory') };
  if (lastAction?.kind === 'memory' && /^(?:please\s+)?(?:actually\s+)?(?:change|update|make)\s+(?:it|that|this)\s+to\b/i.test(text.trim())) {
    const value = text.trim().replace(/^(?:please\s+)?(?:actually\s+)?(?:change|update|make)\s+(?:it|that|this)\s+to\s+/i, '').replace(/[.!?]+$/, '');
    return { intent: 'MEMORY_UPDATE', query: lastAction.id, value };
  }
  if (/\b(?:show|list|display|view)\b.*\b(?:my\s+)?memories?\b|\bwhat\s+(?:do you remember|have you remembered)\b|\btell me what you remember\b/i.test(text)) return { intent: 'MEMORY_LIST' };
  if (isMemoryQuestion(text)) return { intent: 'MEMORY_RETRIEVE' };

  if (/\b(?:what can you do|help|how can you help)\b/i.test(text)) return { intent: 'HELP' };
  if (/\b(?:show|list|display|view)\b.*\bactivity\b|\bwhat happened recently\b/i.test(text)) return { intent: 'ACTIVITY_QUERY' };
  if (isUnknownRequest(text)) return { intent: 'UNKNOWN' };
  if (isCasualConversation(text)) return { intent: 'GENERAL_CONVERSATION' };
  if (isQuestion(text)) return { intent: 'QUESTION' };
  return { intent: 'GENERAL_CONVERSATION' };
}

function findByQuery<T extends { id: string; title: string }>(items: T[], query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];
  return items
    .map((item) => {
      const normalizedTitle = normalizeText(item.title);
      const score = item.id === query ? 100 : normalizedTitle === normalizedQuery ? 90 : normalizedTitle.includes(normalizedQuery) ? 70 : normalizedQuery.includes(normalizedTitle) ? 50 : 0;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

function findMemoriesByQuery(memories: Memory[], query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];
  return memories
    .map((memory) => {
      const normalizedText = normalizeText(memory.text);
      const fact = parseMemoryFact(memory.text);
      const subject = fact?.[1] ?? '';
      const score = memory.id === query ? 100 : normalizedText === normalizedQuery ? 90 : normalizedText.includes(normalizedQuery) || subject.includes(normalizedQuery) ? 70 : normalizedQuery.includes(subject) && subject ? 60 : 0;
      return { memory, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ memory }) => memory);
}

function updatedMemoryText(existing: string, value: string) {
  const fact = parseMemoryFact(existing);
  return fact ? `My ${fact[1]} ${fact[2]} ${value}` : `${existing} — ${value}`;
}

function formatTaskLine(task: Task) {
  const when = task.date ? `${formatDate(task.date)}${task.time ? ` at ${formatTime(task.time)}` : ''}` : 'No date set';
  return `• ${task.title} — ${when} · ${task.status === 'completed' ? 'completed' : 'active'}`;
}

function formatScheduleLine(item: ScheduleItem) {
  const when = item.date ? `${formatDate(item.date)}${item.time ? ` at ${formatTime(item.time)}` : ''}` : 'No date set';
  return `• ${item.title} — ${when}`;
}

function sameTaskIdentity(left: Task, right: Pick<Task, 'title' | 'date' | 'time' | 'status'>) {
  return normalizeText(left.title) === normalizeText(right.title)
    && left.date === right.date
    && left.time === right.time
    && left.status === right.status;
}

function dedupeTasks(items: Task[]) {
  const seen = new Set<string>();
  return items.filter((task) => {
    const key = `${normalizeText(task.title)}|${task.date}|${task.time}|${task.status}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeMemories(items: Memory[]) {
  const seen = new Set<string>();
  return items.filter((memory) => {
    const key = normalizeText(memory.text);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const actionLevels: Partial<Record<Intent, ActionLevel>> = {
  TASK_CREATE: 'AUTO',
  TASK_UPDATE: 'AUTO',
  TASK_COMPLETE: 'AUTO',
  TASK_DELETE: 'AUTO',
  REMINDER_CREATE: 'AUTO',
  REMINDER_UPDATE: 'AUTO',
  REMINDER_DELETE: 'AUTO',
  MEMORY_SAVE: 'AUTO',
  MEMORY_UPDATE: 'AUTO',
  MEMORY_DELETE: 'AUTO',
};

function useStoredState<T>(key: string, fallback: T): [T, (value: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

type AssistantContextValue = {
  tasks: Task[];
  memories: Memory[];
  schedule: ScheduleItem[];
  messages: ChatMessage[];
  activity: ActivityItem[];
  settings: Settings;
  addTask: (task: Omit<Task, 'id' | 'status' | 'createdAt'>) => Task | null;
  updateTask: (taskId: string, patch: Partial<Pick<Task, 'title' | 'description' | 'date' | 'time'>>) => Task | null;
  completeTask: (taskId: string) => Task | null;
  deleteTask: (taskId: string) => boolean;
  addMemory: (text: string, metadata?: Pick<Memory, 'category' | 'importance'>) => Memory | null;
  updateMemory: (memoryId: string, text: string) => Memory | null;
  deleteMemory: (memory: Memory) => boolean;
  addSchedule: (item: Omit<ScheduleItem, 'id' | 'createdAt'>) => ScheduleItem | null;
  updateSchedule: (scheduleId: string, patch: Partial<Pick<ScheduleItem, 'title' | 'description' | 'date' | 'time' | 'type'>>) => ScheduleItem | null;
  deleteSchedule: (scheduleId: string) => boolean;
  sendMessage: (text: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  clearData: () => void;
  toast: (message: string) => void;
};
const AssistantContext = createContext<AssistantContextValue | null>(null);
function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error('Assistant context is unavailable');
  return context;
}

function AssistantProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useStoredState(STORAGE.tasks, seedTasks);
  const [memories, setMemories] = useStoredState(STORAGE.memories, seedMemories);
  const [schedule, setSchedule] = useStoredState(STORAGE.schedule, seedSchedule);
  const [messages, setMessages] = useStoredState(STORAGE.messages, seedMessages);
  const [activity, setActivity] = useStoredState(STORAGE.activity, seedActivity);
  const [settings, setSettings] = useStoredState(STORAGE.settings, defaultSettings);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const lastActionRef = useRef<LastAction | null>(null);

  useEffect(() => {
    setTasks((previous) => {
      const cleaned = dedupeTasks(previous);
      return cleaned.length === previous.length ? previous : cleaned;
    });
    setMemories((previous) => {
      const cleaned = dedupeMemories(previous);
      return cleaned.length === previous.length ? previous : cleaned;
    });
  }, [setTasks, setMemories]);

  const toast = (message: string) => {
    setToastMessage(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMessage(''), 2600);
  };
  const addActivity = (item: Omit<ActivityItem, 'id' | 'createdAt'>) => {
    setActivity((previous) => [{ ...item, id: id('activity'), createdAt: now() }, ...previous].slice(0, 40));
  };
  const addTask = (task: Omit<Task, 'id' | 'status' | 'createdAt'>) => {
    if (tasks.some((item) => sameTaskIdentity(item, { ...task, status: 'active' }))) return null;
    const created: Task = { ...task, id: id('task'), status: 'active', createdAt: now() };
    const next = [created, ...tasks];
    if (!next.some((item) => item.id === created.id)) return null;
    setTasks(next);
    addActivity({ type: 'task', title: 'Task added', detail: task.title });
    toast('Task added to your list');
    return created;
  };
  const updateTask = (taskId: string, patch: Partial<Pick<Task, 'title' | 'description' | 'date' | 'time'>>) => {
    const current = tasks.find((item) => item.id === taskId);
    if (!current) return null;
    const updated = { ...current, ...patch };
    const next = tasks.map((item) => item.id === taskId ? updated : item);
    if (next.find((item) => item.id === taskId)?.date !== updated.date) return null;
    setTasks(next);
    addActivity({ type: 'task', title: 'Task updated', detail: updated.title });
    toast('Task updated');
    return updated;
  };
  const completeTask = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === 'completed') return null;
    const updated = { ...task, status: 'completed' as const };
    const next = tasks.map((item) => item.id === taskId ? updated : item);
    if (next.find((item) => item.id === taskId)?.status !== 'completed') return null;
    setTasks(next);
    addActivity({ type: 'task', title: 'Promise kept', detail: task.title });
    toast('Nice work. Task marked complete');
    return updated;
  };
  const deleteTask = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return false;
    const next = tasks.filter((item) => item.id !== taskId);
    if (next.some((item) => item.id === taskId)) return false;
    setTasks(next);
    addActivity({ type: 'task', title: 'Task deleted', detail: task.title });
    toast('Task removed');
    return true;
  };
  const addMemory = (text: string, metadata: Pick<Memory, 'category' | 'importance'> = {}) => {
    if (memories.some((item) => normalizeText(item.text) === normalizeText(text))) return null;
    const created: Memory = { id: id('memory'), text, createdAt: now(), ...metadata };
    const next = [created, ...memories];
    if (!next.some((item) => item.id === created.id)) return null;
    setMemories(next);
    addActivity({ type: 'memory', title: 'Memory kept', detail: text });
    toast('Memory saved for later');
    return created;
  };
  const updateMemory = (memoryId: string, text: string) => {
    const current = memories.find((item) => item.id === memoryId);
    if (!current) return null;
    const updated = { ...current, text };
    const next = memories.map((item) => item.id === memoryId ? updated : item);
    if (next.find((item) => item.id === memoryId)?.text !== text) return null;
    setMemories(next);
    addActivity({ type: 'memory', title: 'Memory updated', detail: text });
    toast('Memory updated');
    return updated;
  };
  const deleteMemory = (memory: Memory) => {
    const next = memories.filter((item) => item.id !== memory.id);
    if (next.some((item) => item.id === memory.id)) return false;
    setMemories(next);
    addActivity({ type: 'memory', title: 'Memory released', detail: memory.text });
    toast('Memory removed');
    return true;
  };
  const addSchedule = (item: Omit<ScheduleItem, 'id' | 'createdAt'>) => {
    const created: ScheduleItem = { ...item, id: id('schedule'), createdAt: now() };
    const next = [created, ...schedule];
    if (!next.some((entry) => entry.id === created.id)) return null;
    setSchedule(next);
    addActivity({ type: 'schedule', title: item.type === 'reminder' ? 'Reminder placed' : 'Scheduled task added', detail: `${item.title} · ${formatDate(item.date)} at ${formatTime(item.time)}` });
    toast(item.type === 'reminder' ? 'Reminder placed on your schedule' : 'Scheduled task added');
    return created;
  };
  const updateSchedule = (scheduleId: string, patch: Partial<Pick<ScheduleItem, 'title' | 'description' | 'date' | 'time' | 'type'>>) => {
    const current = schedule.find((item) => item.id === scheduleId);
    if (!current) return null;
    const updated = { ...current, ...patch };
    const next = schedule.map((item) => item.id === scheduleId ? updated : item);
    if (next.find((item) => item.id === scheduleId)?.date !== updated.date) return null;
    setSchedule(next);
    addActivity({ type: 'schedule', title: updated.type === 'reminder' ? 'Reminder updated' : 'Scheduled task updated', detail: `${updated.title} · ${formatDate(updated.date)} at ${formatTime(updated.time)}` });
    toast('Schedule updated');
    return updated;
  };
  const deleteSchedule = (scheduleId: string) => {
    const item = schedule.find((entry) => entry.id === scheduleId);
    if (!item) return false;
    const next = schedule.filter((entry) => entry.id !== scheduleId);
    if (next.some((entry) => entry.id === scheduleId)) return false;
    setSchedule(next);
    addActivity({ type: 'schedule', title: item.type === 'reminder' ? 'Reminder deleted' : 'Scheduled task deleted', detail: item.title });
    toast('Schedule item removed');
    return true;
  };
  const sendMessage = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const userMessage: ChatMessage = { id: id('message'), role: 'user', text: clean, createdAt: now() };
    setMessages((previous) => [...previous, userMessage]);
    const detected = detectIntent(clean, lastActionRef.current);
    const name = rememberedName(memories) ?? settings.name;
    let response = '';
    const actionLevel = actionLevels[detected.intent] ?? 'AUTO';
    if (actionLevel === 'BLOCKED') {
      addActivity({ type: 'chat', title: 'Action blocked', detail: clean });
      response = 'I can’t perform that action automatically.';
    } else if (detected.intent === 'TASK_CREATE' && detected.task) {
      const request = detected.task;
      if (!request.date || !request.time || request.ambiguousDate || request.ambiguousTime) {
        addActivity({ type: 'chat', title: 'Task details requested', detail: clean });
        response = !request.date || request.ambiguousDate
          ? `What date should I use for “${request.title}”?`
          : `What time should I use for “${request.title}”?`;
      } else {
        const requestedDate = request.date;
        const requestedTime = request.time;
        const existing = tasks.find((item) => sameTaskIdentity(item, { title: request.title, date: requestedDate, time: requestedTime, status: 'active' }));
        if (existing) {
          lastActionRef.current = { kind: 'task', id: existing.id, title: existing.title };
          response = `That task already exists: “${existing.title}” on ${formatDate(existing.date)} at ${formatTime(existing.time)}.`;
        } else {
          const created = addTask({ title: request.title, description: '', date: request.date, time: request.time });
          if (created) {
            lastActionRef.current = { kind: 'task', id: created.id, title: created.title };
            response = `Done. I created the task “${created.title}” for ${formatDate(created.date)} at ${formatTime(created.time)}.`;
          } else {
            addActivity({ type: 'chat', title: 'Task save failed', detail: request.title });
            response = 'Sorry, I couldn’t save that task. Please try again.';
          }
        }
      }
    } else if (detected.intent === 'TASK_LIST') {
      const listedTasks = tasks.filter((task) => detected.status === 'all' || !detected.status || task.status === detected.status).slice(0, 12);
      addActivity({ type: 'task', title: 'Tasks retrieved', detail: detected.status && detected.status !== 'all' ? `${detected.status} tasks` : 'All tasks' });
      response = listedTasks.length ? `Here are your tasks:\n${listedTasks.map(formatTaskLine).join('\n')}` : 'You do not have any saved tasks yet.';
    } else if (detected.intent === 'TASK_COMPLETE' && detected.query) {
      const matches = findByQuery(tasks, detected.query);
      if (matches.length > 1) {
        response = 'I found more than one matching task. Which one should I complete?';
      } else if (!matches.length) {
        response = `I couldn’t find a task matching “${detected.query}”.`;
      } else if (matches[0].status === 'completed') {
        response = `“${matches[0].title}” is already completed.`;
      } else {
        const completed = completeTask(matches[0].id);
        if (completed) {
          lastActionRef.current = { kind: 'task', id: completed.id, title: completed.title };
          response = `Done. I marked “${completed.title}” as completed.`;
        } else {
          addActivity({ type: 'chat', title: 'Task completion failed', detail: matches[0].title });
          response = 'Sorry, I couldn’t update that task. Please try again.';
        }
      }
    } else if (detected.intent === 'TASK_DELETE' && detected.query) {
      const matches = findByQuery(tasks, detected.query);
      if (matches.length > 1) {
        response = 'I found more than one matching task. Which one should I delete?';
      } else if (!matches.length) {
        response = `I couldn’t find a task matching “${detected.query}”.`;
      } else if (deleteTask(matches[0].id)) {
        if (lastActionRef.current?.id === matches[0].id) lastActionRef.current = null;
        response = `Done. I deleted the task “${matches[0].title}”.`;
      } else {
        addActivity({ type: 'chat', title: 'Task deletion failed', detail: matches[0].title });
        response = 'Sorry, I couldn’t delete that task. Please try again.';
      }
    } else if (detected.intent === 'TASK_UPDATE' && detected.query) {
      const matches = findByQuery(tasks, detected.query);
      const patch: Partial<Pick<Task, 'date' | 'time'>> = {};
      if (detected.date) patch.date = detected.date;
      if (detected.time) patch.time = detected.time;
      if (matches.length > 1) {
        response = 'I found more than one matching task. Which one should I update?';
      } else if (!matches.length) {
        response = `I couldn’t find a task matching “${detected.query}”.`;
      } else if (!Object.keys(patch).length) {
        addActivity({ type: 'chat', title: 'Task details requested', detail: clean });
        response = 'What date or time should I use for that task?';
      } else {
        const updated = updateTask(matches[0].id, patch);
        if (updated) {
          lastActionRef.current = { kind: 'task', id: updated.id, title: updated.title };
          response = `Done. I updated “${updated.title}”${updated.date ? ` for ${formatDate(updated.date)}` : ''}${updated.time ? ` at ${formatTime(updated.time)}` : ''}.`;
        } else {
          addActivity({ type: 'chat', title: 'Task update failed', detail: matches[0].title });
          response = 'Sorry, I couldn’t update that task. Please try again.';
        }
      }
    } else if (detected.intent === 'REMINDER_CREATE' && detected.reminder) {
      const request = detected.reminder;
      if (!request.date || !request.time || request.ambiguousDate || request.ambiguousTime) {
        addActivity({ type: 'chat', title: 'Reminder details requested', detail: clean });
        response = !request.date || request.ambiguousDate
          ? `What date should I use for the reminder “${request.title}”?`
          : `What time should I use for the reminder “${request.title}”?`;
      } else {
        const created = addSchedule({ title: request.title, description: '', date: request.date, time: request.time, type: 'reminder' });
        if (created) {
          lastActionRef.current = { kind: 'reminder', id: created.id, title: created.title };
          response = `Done. I’ll remind you to ${created.title} on ${formatDate(created.date)} at ${formatTime(created.time)}.`;
        } else {
          addActivity({ type: 'chat', title: 'Reminder save failed', detail: request.title });
          response = 'Sorry, I couldn’t save that reminder. Please try again.';
        }
      }
    } else if (detected.intent === 'REMINDER_LIST') {
      const reminders = schedule.filter((item) => item.type === 'reminder').slice(0, 12);
      addActivity({ type: 'schedule', title: 'Reminders retrieved', detail: 'Saved reminders' });
      response = reminders.length ? `Here are your reminders:\n${reminders.map(formatScheduleLine).join('\n')}` : 'You do not have any saved reminders yet.';
    } else if (detected.intent === 'SCHEDULE_QUERY') {
      const scheduled = schedule.filter((item) => !detected.date || item.date === detected.date);
      response = scheduled.length
        ? `Here is what you have scheduled${detected.date ? ` for ${formatDate(detected.date)}` : ''}:\n${scheduled.map(formatScheduleLine).join('\n')}`
        : `You do not have anything scheduled${detected.date ? ` for ${formatDate(detected.date)}` : ''}.`;
    } else if (detected.intent === 'REMINDER_DELETE' && detected.query) {
      const matches = findByQuery(schedule.filter((item) => item.type === 'reminder'), detected.query);
      if (matches.length > 1) {
        response = 'I found more than one matching reminder. Which one should I delete?';
      } else if (!matches.length) {
        response = `I couldn’t find a reminder matching “${detected.query}”.`;
      } else if (deleteSchedule(matches[0].id)) {
        if (lastActionRef.current?.id === matches[0].id) lastActionRef.current = null;
        response = `Done. I deleted the reminder “${matches[0].title}”.`;
      } else {
        addActivity({ type: 'chat', title: 'Reminder deletion failed', detail: matches[0].title });
        response = 'Sorry, I couldn’t delete that reminder. Please try again.';
      }
    } else if (detected.intent === 'REMINDER_UPDATE' && detected.query) {
      const matches = findByQuery(schedule.filter((item) => item.type === 'reminder'), detected.query);
      const patch: Partial<Pick<ScheduleItem, 'date' | 'time'>> = {};
      if (detected.date) patch.date = detected.date;
      if (detected.time) patch.time = detected.time;
      if (matches.length > 1) {
        response = 'I found more than one matching reminder. Which one should I update?';
      } else if (!matches.length) {
        response = `I couldn’t find a reminder matching “${detected.query}”.`;
      } else if (!Object.keys(patch).length) {
        addActivity({ type: 'chat', title: 'Reminder details requested', detail: clean });
        response = 'What date or time should I use for that reminder?';
      } else {
        const updated = updateSchedule(matches[0].id, patch);
        if (updated) {
          lastActionRef.current = { kind: 'reminder', id: updated.id, title: updated.title };
          response = `Done. I updated the reminder “${updated.title}”${updated.date ? ` for ${formatDate(updated.date)}` : ''}${updated.time ? ` at ${formatTime(updated.time)}` : ''}.`;
        } else {
          addActivity({ type: 'chat', title: 'Reminder update failed', detail: matches[0].title });
          response = 'Sorry, I couldn’t update that reminder. Please try again.';
        }
      }
    } else if (detected.intent === 'MEMORY_SAVE' && detected.memoryText) {
      const existing = memories.find((memory) => normalizeText(memory.text) === normalizeText(detected.memoryText!));
      if (existing) {
        lastActionRef.current = { kind: 'memory', id: existing.id, text: existing.text };
        response = `I already remember that: “${existing.text}”.`;
      } else {
        const saved = addMemory(detected.memoryText);
        if (saved) {
          lastActionRef.current = { kind: 'memory', id: saved.id, text: saved.text };
          response = `Memory saved: “${saved.text}”.`;
        } else {
          addActivity({ type: 'chat', title: 'Memory save failed', detail: detected.memoryText });
          response = 'Sorry, I couldn’t save that memory. Please try again.';
        }
      }
    } else if (detected.intent === 'MEMORY_LIST') {
      addActivity({ type: 'memory', title: 'Memories retrieved', detail: 'Saved memories' });
      response = memories.length ? `Here is what I remember:\n${memories.slice(0, 20).map((memory) => `• ${memory.text}`).join('\n')}` : 'You do not have any saved memories yet.';
    } else if (detected.intent === 'MEMORY_RETRIEVE') {
      const memoryAnswer = answerFromMemories(clean, memories);
      if (memoryAnswer) {
        addActivity({ type: 'memory', title: 'Memory retrieved', detail: memoryAnswer });
        response = memoryAnswer;
      } else {
        addActivity({ type: 'chat', title: 'Memory not found', detail: clean });
        response = 'I couldn’t find a saved memory that answers that yet.';
      }
    } else if (detected.intent === 'MEMORY_UPDATE' && detected.query) {
      const matches = findMemoriesByQuery(memories, detected.query);
      if (matches.length > 1) {
        response = 'I found more than one matching memory. Which one should I update?';
      } else if (!matches.length) {
        response = `I couldn’t find a memory matching “${detected.query}”.`;
      } else if (!detected.value) {
        addActivity({ type: 'chat', title: 'Memory details requested', detail: clean });
        response = `What should I change your memory about “${matches[0].text}” to?`;
      } else {
        const updated = updateMemory(matches[0].id, updatedMemoryText(matches[0].text, detected.value));
        if (updated) {
          lastActionRef.current = { kind: 'memory', id: updated.id, text: updated.text };
          response = `Done. I updated that memory to “${updated.text}”.`;
        } else {
          addActivity({ type: 'chat', title: 'Memory update failed', detail: matches[0].text });
          response = 'Sorry, I couldn’t update that memory. Please try again.';
        }
      }
    } else if (detected.intent === 'MEMORY_DELETE' && detected.query) {
      const matches = findMemoriesByQuery(memories, detected.query);
      if (matches.length > 1) {
        response = 'I found more than one matching memory. Which one should I delete?';
      } else if (!matches.length) {
        response = `I couldn’t find a memory matching “${detected.query}”.`;
      } else if (deleteMemory(matches[0])) {
        if (lastActionRef.current?.id === matches[0].id) lastActionRef.current = null;
        response = `Done. I deleted the memory “${matches[0].text}”.`;
      } else {
        addActivity({ type: 'chat', title: 'Memory deletion failed', detail: matches[0].text });
        response = 'Sorry, I couldn’t delete that memory. Please try again.';
      }
    } else if (detected.intent === 'ACTIVITY_QUERY') {
      response = activity.length ? `Here is your recent activity:\n${activity.slice(0, 12).map((item) => `• ${item.title}: ${item.detail} (${formatStamp(item.createdAt)})`).join('\n')}` : 'There is no activity recorded yet.';
    } else if (detected.intent === 'HELP') {
      response = helpResponse();
    } else if (detected.intent === 'UNKNOWN') {
      addActivity({ type: 'chat', title: 'Clarification requested', detail: clean });
      response = 'Sure. What would you like me to do?';
    } else {
      addActivity({ type: 'chat', title: 'Conversation continued', detail: clean });
      response = answerGeneralConversation(clean, name);
    }
    window.setTimeout(() => {
      setMessages((previous) => [...previous, { id: id('message'), role: 'assistant', text: response, createdAt: now() }]);
    }, 650);
  };
  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((previous) => ({ ...previous, ...patch }));
    toast('Preferences saved');
  };
  const clearData = () => {
    setTasks([]); setMemories([]); setSchedule([]);
    setSettings(defaultSettings);
    setMessages([{ id: id('message'), role: 'assistant', text: 'The slate is clean. I’m here whenever you want to begin again.', createdAt: now() }]);
    setActivity([{ id: id('activity'), type: 'system', title: 'Workspace reset', detail: 'Your personal space is ready for a fresh start.', createdAt: now() }]);
    toast('Your workspace has been reset');
  };
  return (
    <AssistantContext.Provider value={{ tasks, memories, schedule, messages, activity, settings, addTask, updateTask, completeTask, deleteTask, addMemory, updateMemory, deleteMemory, addSchedule, updateSchedule, deleteSchedule, sendMessage, updateSettings, clearData, toast }}>
      {children}
      {toastMessage && <div className="toast" role="status" data-testid="status-toast">{toastMessage}</div>}
    </AssistantContext.Provider>
  );
}

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare2 },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/activity', label: 'Activity', icon: ActivityIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

function Brand() {
  return <div className="brand"><div className="brand-mark">J</div><div><div className="brand-name">Dangote Junior</div><div className="brand-caption">Personal assistant</div></div></div>;
}
function Navigation({ mobile = false }: { mobile?: boolean }) {
  const [location] = useLocation();
  const items = navItems;
  return <nav className={mobile ? 'bottom-nav' : 'nav-list'} aria-label="Primary navigation">{items.map(({ href, label, icon: Icon }) => <Link href={href} key={href} className={`nav-link ${location === href ? 'active' : ''}`} data-testid={`link-${label.toLowerCase()}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>)}</nav>;
}
function Shell({ children }: { children: ReactNode }) {
  return <div className="app-shell"><aside className="sidebar"><Brand /><div className="nav-label">Your space</div><Navigation /><div className="sidebar-spacer" /><div className="sidebar-status"><div className="status-line"><span className="status-dot" />Online and listening</div><div className="status-note">Private by design</div></div></aside><div className="main-area"><header className="topbar"><Brand /><div className="mobile-status"><span className="status-dot" /> Online</div></header>{children}<Navigation mobile /></div></div>;
}
function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}
function StatCard({ icon: Icon, number, label, href }: { icon: LucideIcon; number: number; label: string; href: string }) {
  return <Link href={href} className="surface stat-card" data-testid={`card-stat-${label.toLowerCase()}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={15} /></span></div><div className="stat-number">{number}</div><div className="stat-label">{label === 'Tasks' ? 'active commitments' : label === 'Memory' ? 'things worth keeping' : label === 'Schedule' ? 'upcoming moments' : 'recorded actions'}</div></Link>;
}
function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-mark"><Icon size={20} /></div><h3>{title}</h3><p>{description}</p>{action && <div style={{ marginTop: 18 }}>{action}</div>}</div>;
}
function ActivityRow({ item }: { item: ActivityItem }) {
  const icons: Record<ActivityType, LucideIcon> = { task: CheckSquare2, memory: Brain, schedule: CalendarClock, chat: MessageCircle, system: Sparkles };
  const Icon = icons[item.type];
  return <div className="activity-row" data-testid={`activity-row-${item.id}`}><div className="activity-icon"><Icon size={14} /></div><div style={{ flex: 1, minWidth: 0 }}><p className="activity-title">{item.title}</p><p className="activity-detail">{item.detail}</p></div><span className="time-stamp">{formatStamp(item.createdAt)}</span></div>;
}

function Dashboard() {
  const { tasks, memories, schedule, activity, settings } = useAssistant();
  const activeTasks = tasks.filter((task) => task.status === 'active');
  const upcoming = [...schedule].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 3);
  return <main className="page-wrap">
    <PageHeading eyebrow="Tuesday, your command center" title={`Good morning, ${settings.name}.`} subtitle="A calm place to see what matters, remember what counts, and keep moving without carrying it all in your head." action={<Link href="/chat" className="button button-primary" data-testid="button-open-chat"><MessageCircle size={15} />Talk to Junior</Link>} />
    <section className="dashboard-hero"><div className="hero-kicker"><span className="status-dot" style={{ display: 'inline-block', marginRight: 8 }} /> Junior is online</div><h2 className="hero-title">Let’s make room for the right things.</h2><p className="hero-text">You have {activeTasks.length} active {activeTasks.length === 1 ? 'commitment' : 'commitments'} and {upcoming.length} moments coming up. Start where it feels easiest.</p></section>
    <div className="stats-grid"><StatCard icon={ListTodo} number={activeTasks.length} label="Tasks" href="/tasks" /><StatCard icon={Brain} number={memories.length} label="Memory" href="/memory" /><StatCard icon={CalendarDays} number={schedule.length} label="Schedule" href="/schedule" /><StatCard icon={ActivityIcon} number={activity.length} label="Activity" href="/activity" /></div>
    <div className="two-col"><section className="surface section-card"><div className="section-heading"><h2 className="section-title">Recent activity</h2><Link className="section-link" href="/activity">See all <ArrowUpRight size={12} style={{ verticalAlign: 'middle' }} /></Link></div>{activity.length ? <div className="activity-list">{activity.slice(0, 5).map((item) => <ActivityRow key={item.id} item={item} />)}</div> : <EmptyState icon={Inbox} title="A quiet beginning" description="Your activity will collect here as you and Junior work together." />}</section><section className="surface section-card"><div className="section-heading"><h2 className="section-title">Quick actions</h2><Zap size={17} color="hsl(var(--accent-foreground))" /></div><div className="quick-grid"><Link href="/tasks" className="quick-action" data-testid="quick-add-task"><Plus size={17} /><strong>Add a task</strong><span>Put a promise somewhere visible.</span></Link><Link href="/memory" className="quick-action" data-testid="quick-save-memory"><Brain size={17} /><strong>Save a memory</strong><span>Keep something useful close.</span></Link><Link href="/schedule" className="quick-action" data-testid="quick-plan"><CalendarClock size={17} /><strong>Plan a moment</strong><span>Give your time a little shape.</span></Link><Link href="/chat" className="quick-action" data-testid="quick-chat"><MessageCircle size={17} /><strong>Ask Junior</strong><span>Start with whatever is on your mind.</span></Link></div></section></div>
  </main>;
}

function Chat() {
  const { messages, sendMessage, settings } = useAssistant();
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const lastCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length > lastCount.current) {
      const latest = messages[messages.length - 1];
      if (latest.role === 'user') {
        setTyping(true);
        const timer = window.setTimeout(() => setTyping(false), 720);
        lastCount.current = messages.length;
        return () => window.clearTimeout(timer);
      }
      setTyping(false);
      lastCount.current = messages.length;
    }
    return undefined;
  }, [messages]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!text.trim() || typing) return; sendMessage(text); setText(''); setTyping(true); };
  return <main className="page-wrap"><div className="chat-layout"><PageHeading eyebrow="A private line to Junior" title="Talk it through." subtitle="No prompt engineering needed. Ask for a plan, leave a thought, or simply start where you are." /><section className="surface chat-window"><div className="chat-intro"><div className="chat-mark"><Sparkles size={23} /></div><h2>Hello, {settings.name}.</h2><p>I can help keep the loose ends from taking up all the room in your mind.</p></div><div className="messages">{messages.map((message) => <div className={`message-row ${message.role}`} key={message.id} data-testid={`message-${message.id}`}><div><div className="message-bubble">{message.text}</div><div className="message-time">{message.role === 'assistant' ? settings.assistantName : 'You'} · {formatStamp(message.createdAt)}</div></div></div>)}{typing && <div className="message-row" data-testid="chat-typing"><div className="typing"><span /><span /><span /></div></div>}</div><form className="composer" onSubmit={submit}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Say what’s on your mind..." aria-label="Message Junior" data-testid="input-chat-message" /><button className="button button-primary" type="submit" disabled={!text.trim() || typing} aria-label="Send message" data-testid="button-send-message"><Send size={17} /></button></form></section></div></main>;
}

function TaskCard({ task }: { task: Task }) {
  const { completeTask } = useAssistant();
  return <article className="surface item-card" data-testid={`task-card-${task.id}`}><button className={`check-button ${task.status === 'completed' ? 'completed' : ''}`} onClick={() => completeTask(task.id)} disabled={task.status === 'completed'} aria-label={task.status === 'completed' ? 'Task completed' : `Complete ${task.title}`} data-testid={`button-complete-${task.id}`}>{task.status === 'completed' && <Check size={14} />}</button><div className="item-body"><p className={`item-title ${task.status === 'completed' ? 'completed-text' : ''}`}>{task.title}</p>{task.description && <p className="item-description">{task.description}</p>}<div className="item-meta"><span className={task.status === 'completed' ? 'pill pill-teal' : 'pill pill-accent'}>{task.status === 'completed' ? 'Completed' : 'Active'}</span><span><CalendarDays size={11} style={{ verticalAlign: 'middle' }} /> {formatDate(task.date)}</span>{task.time && <span><Clock3 size={11} style={{ verticalAlign: 'middle' }} /> {formatTime(task.time)}</span>}</div></div></article>;
}
function Tasks() {
  const { tasks, addTask } = useAssistant();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'active' | 'completed'>('active');
  const [form, setForm] = useState({ title: '', description: '', date: today(), time: '' });
  const visibleTasks = tasks.filter((task) => task.status === filter);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.title.trim()) return; addTask({ ...form, title: form.title.trim() }); setForm({ title: '', description: '', date: today(), time: '' }); setShowForm(false); };
  return <main className="page-wrap"><PageHeading eyebrow="Keep promises visible" title="Tasks" subtitle="A short list is a kind list. Add what needs your attention, then let completion feel complete." action={<button className="button button-primary" onClick={() => setShowForm((value) => !value)} data-testid="button-new-task"><Plus size={16} />New task</button>} />{showForm && <form className="surface form-card" onSubmit={submit}><div className="eyebrow">New commitment</div><div className="form-grid" style={{ marginTop: 14 }}><div className="field full"><label htmlFor="task-title">Title</label><input id="task-title" autoFocus required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What needs doing?" data-testid="input-task-title" /></div><div className="field full"><label htmlFor="task-description">Description <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>(optional)</span></label><textarea id="task-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="A little context makes it easier to return to." data-testid="input-task-description" /></div><div className="field"><label htmlFor="task-date">Date</label><input id="task-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} data-testid="input-task-date" /></div><div className="field"><label htmlFor="task-time">Time <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>(optional)</span></label><input id="task-time" type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} data-testid="input-task-time" /></div></div><div className="form-actions"><button type="button" className="button button-soft" onClick={() => setShowForm(false)} data-testid="button-cancel-task">Cancel</button><button type="submit" className="button button-primary" data-testid="button-save-task"><Check size={15} />Save task</button></div></form>}<div className="surface section-card"><div className="list-controls"><div className="filter-tabs"><button className={`filter-tab ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')} data-testid="tab-active-tasks">Active · {tasks.filter((task) => task.status === 'active').length}</button><button className={`filter-tab ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')} data-testid="tab-completed-tasks">Completed · {tasks.filter((task) => task.status === 'completed').length}</button></div><span className="eyebrow">{filter === 'active' ? 'In front of you' : 'Kept promises'}</span></div>{visibleTasks.length ? <div className="item-list">{visibleTasks.map((task) => <TaskCard key={task.id} task={task} />)}</div> : <EmptyState icon={filter === 'active' ? ListTodo : CircleCheck} title={filter === 'active' ? 'Nothing asking for you' : 'No completions yet'} description={filter === 'active' ? 'A clear list is a good place to begin. Add one small promise.' : 'Completed tasks will live here as a quiet record of progress.'} action={filter === 'active' ? <button className="button button-primary" onClick={() => setShowForm(true)} data-testid="empty-add-task"><Plus size={15} />Add your first task</button> : undefined} />}</div></main>;
}

function Memory() {
  const { memories, addMemory, deleteMemory } = useAssistant();
  const [text, setText] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (!text.trim()) return; addMemory(text.trim()); setText(''); };
  return <main className="page-wrap"><PageHeading eyebrow="The things worth keeping" title="Memory" subtitle="A private shelf for the details you do not want to carry twice." /><form className="surface form-card" onSubmit={submit}><div className="field"><label htmlFor="memory-text">What should Junior remember?</label><textarea id="memory-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="For example: I think best after a walk..." data-testid="input-memory-text" /></div><div className="form-actions"><button type="submit" className="button button-primary" disabled={!text.trim()} data-testid="button-save-memory"><Brain size={15} />Keep this memory</button></div></form><section className="item-list">{memories.length ? memories.map((memory) => <article className="surface memory-card" key={memory.id} data-testid={`memory-card-${memory.id}`}><p className="memory-text">{memory.text}</p><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div className="memory-date">Kept {formatStamp(memory.createdAt)}</div><button className="icon-button danger" onClick={() => deleteMemory(memory)} aria-label={`Delete memory: ${memory.text}`} data-testid={`button-delete-memory-${memory.id}`}><Trash2 size={15} /></button></div></article>) : <EmptyState icon={Brain} title="Nothing tucked away yet" description="Save a thought, preference, or small detail and it will stay close when you need it." />}</section></main>;
}

function Schedule() {
  const { schedule } = useAssistant();
  const { addSchedule } = useAssistant();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', date: today(), time: '', type: 'reminder' as ScheduleType });
  const sorted = [...schedule].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.title.trim() || !form.date) return; addSchedule({ ...form, title: form.title.trim() }); setForm({ title: '', description: '', date: today(), time: '', type: 'reminder' }); setShowForm(false); };
  return <main className="page-wrap"><PageHeading eyebrow="Give time a shape" title="Schedule" subtitle="Place the moments you want to remember somewhere you can actually see them." action={<button className="button button-primary" onClick={() => setShowForm((value) => !value)} data-testid="button-new-schedule"><Plus size={16} />Add to schedule</button>} />{showForm && <form className="surface form-card" onSubmit={submit}><div className="eyebrow">Place a moment</div><div className="form-grid" style={{ marginTop: 14 }}><div className="field full"><label htmlFor="schedule-title">Title</label><input id="schedule-title" autoFocus required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What is happening?" data-testid="input-schedule-title" /></div><div className="field full"><label htmlFor="schedule-description">Description <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>(optional)</span></label><textarea id="schedule-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add the useful context." data-testid="input-schedule-description" /></div><div className="field"><label htmlFor="schedule-date">Date</label><input id="schedule-date" type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} data-testid="input-schedule-date" /></div><div className="field"><label htmlFor="schedule-time">Time</label><input id="schedule-time" type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} data-testid="input-schedule-time" /></div><div className="field full"><label htmlFor="schedule-type">Type</label><select id="schedule-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ScheduleType })} data-testid="select-schedule-type"><option value="reminder">Reminder</option><option value="task">Scheduled task</option></select></div></div><div className="form-actions"><button type="button" className="button button-soft" onClick={() => setShowForm(false)} data-testid="button-cancel-schedule">Cancel</button><button type="submit" className="button button-primary" data-testid="button-save-schedule"><Check size={15} />Save to schedule</button></div></form>}<section className="surface section-card"><div className="section-heading"><h2 className="section-title">Upcoming</h2><span className="eyebrow">{schedule.length} {schedule.length === 1 ? 'moment' : 'moments'}</span></div>{sorted.length ? <div className="item-list">{sorted.map((item) => <article className="surface item-card" key={item.id} data-testid={`schedule-card-${item.id}`}><div className="activity-icon" style={{ flex: '0 0 34px', height: 34 }}><>{item.type === 'reminder' ? <Bell size={15} /> : <CalendarClock size={15} />}</></div><div className="item-body"><p className="item-title">{item.title}</p>{item.description && <p className="item-description">{item.description}</p>}<div className="item-meta"><span className={item.type === 'reminder' ? 'pill pill-accent' : 'pill pill-teal'}>{item.type === 'reminder' ? 'Reminder' : 'Task'}</span><span><CalendarDays size={11} style={{ verticalAlign: 'middle' }} /> {formatDate(item.date)}</span>{item.time && <span><Clock3 size={11} style={{ verticalAlign: 'middle' }} /> {formatTime(item.time)}</span>}</div></div></article>)}</div> : <EmptyState icon={CalendarDays} title="Your calendar is open" description="Add a reminder or scheduled task when you want a future moment to feel more certain." action={<button className="button button-primary" onClick={() => setShowForm(true)} data-testid="empty-add-schedule"><Plus size={15} />Add a moment</button>} />}</section></main>;
}

function ActivityPage() {
  const { activity } = useAssistant();
  return <main className="page-wrap"><PageHeading eyebrow="A record of showing up" title="Activity" subtitle="A gentle history of the small ways you have made your life more visible and manageable." /><section className="surface section-card">{activity.length ? <div className="activity-list">{activity.map((item) => <ActivityRow key={item.id} item={item} />)}</div> : <EmptyState icon={ActivityIcon} title="The history starts here" description="Tasks, memories, conversations, and reminders will appear as you use Junior." />}</section></main>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button className={`toggle ${checked ? 'on' : ''}`} onClick={onChange} role="switch" aria-checked={checked} aria-label={label} data-testid={`toggle-${label.toLowerCase().replaceAll(' ', '-')}`}><span /></button>;
}
function SettingsPage() {
  const { settings, updateSettings, clearData } = useAssistant();
  const [name, setName] = useState(settings.name);
  const [assistantName, setAssistantName] = useState(settings.assistantName);
  const [showConfirm, setShowConfirm] = useState(false);
  const saveProfile = (event: FormEvent) => { event.preventDefault(); updateSettings({ name: name.trim() || 'Friend', assistantName: assistantName.trim() || 'Junior' }); };
  return <main className="page-wrap"><PageHeading eyebrow="Make it yours" title="Settings" subtitle="A few quiet preferences shape how Junior meets you. Your information stays in this browser." /><div className="settings-grid"><div className="grid" style={{ gap: 18 }}><form className="surface settings-section" onSubmit={saveProfile}><div className="section-heading"><h2 className="section-title">Profile</h2><UserRound size={17} color="hsl(var(--primary))" /></div><div className="form-grid"><div className="field"><label htmlFor="profile-name">Your name</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} data-testid="input-profile-name" /></div><div className="field"><label htmlFor="assistant-name">Assistant name</label><input id="assistant-name" value={assistantName} onChange={(event) => setAssistantName(event.target.value)} data-testid="input-assistant-name" /></div></div><div className="form-actions"><button className="button button-primary" type="submit" data-testid="button-save-profile"><Check size={15} />Save profile</button></div></form><section className="surface settings-section"><div className="section-heading"><h2 className="section-title">Preferences</h2><SlidersHorizontal size={17} color="hsl(var(--primary))" /></div><div className="setting-row"><div className="setting-copy"><strong>Daily briefing</strong><p>A short view of what deserves your attention today.</p></div><Toggle checked={settings.dailyBriefing} onChange={() => updateSettings({ dailyBriefing: !settings.dailyBriefing })} label="Daily briefing" /></div><div className="setting-row"><div className="setting-copy"><strong>Gentle nudges</strong><p>Keep upcoming commitments visible without making noise.</p></div><Toggle checked={settings.gentleNudges} onChange={() => updateSettings({ gentleNudges: !settings.gentleNudges })} label="Gentle nudges" /></div></section></div><div className="grid" style={{ gap: 18 }}><section className="surface settings-section"><div className="section-heading"><h2 className="section-title">Privacy</h2><ShieldCheck size={17} color="hsl(var(--primary))" /></div><p className="page-subtitle" style={{ fontSize: 12 }}>This first version keeps your tasks, memories, schedule, and conversations in local browser storage. Nothing is sent away.</p><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, color: 'hsl(var(--primary))', fontSize: 11, fontWeight: 700 }}><CircleCheck size={15} />Stored on this device</div></section><section className="surface settings-section"><div className="section-heading"><h2 className="section-title">Start over</h2><RotateCcw size={17} color="hsl(var(--destructive))" /></div><p className="page-subtitle" style={{ fontSize: 12 }}>Remove every task, memory, schedule item, and activity entry. Your space will return to a clean welcome state.</p><button className="button button-danger" style={{ marginTop: 16 }} onClick={() => setShowConfirm(true)} data-testid="button-clear-data"><Trash2 size={15} />Clear all data</button></section></div></div>{showConfirm && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="clear-title"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><div className="eyebrow">This cannot be undone</div><h2 id="clear-title">Clear your space?</h2></div><button className="icon-button" onClick={() => setShowConfirm(false)} aria-label="Close confirmation" data-testid="button-close-confirmation"><X size={18} /></button></div><p>Everything stored in this browser will be removed. A simple welcome message will remain so you can begin again.</p><div className="form-actions"><button className="button button-soft" onClick={() => setShowConfirm(false)} data-testid="button-cancel-clear">Keep my data</button><button className="button button-danger" onClick={() => { clearData(); setShowConfirm(false); }} data-testid="button-confirm-clear">Clear everything</button></div></div></div>}</main>;
}

function NotFoundPage() {
  return <div className="not-found"><div><div className="brand-mark" style={{ margin: '0 auto 20px' }}>J</div><h1>That place is not here.</h1><p className="page-subtitle" style={{ margin: '12px auto 20px' }}>Junior can take you back to a useful place.</p><Link href="/" className="button button-primary" data-testid="link-back-dashboard"><LayoutDashboard size={15} />Back to dashboard</Link></div></div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Dashboard} /><Route path="/chat" component={Chat} /><Route path="/tasks" component={Tasks} /><Route path="/memory" component={Memory} /><Route path="/schedule" component={Schedule} /><Route path="/activity" component={ActivityPage} /><Route path="/settings" component={SettingsPage} /><Route component={NotFoundPage} /></Switch></RoutedErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AssistantProvider><Shell><Router /></Shell></AssistantProvider></WouterRouter></QueryClientProvider>;
}
export default App;
