import { useCallback, useState } from 'react';
import { api } from '../../lib/api';
import type { Capture, Task } from '../../types';

export type CaptureResult = Capture & { createdTask?: Task };

export const CAPTURE_SUGGESTIONS = [
  'Submit the quarterly report by Friday 5pm',
  'Call the dentist tomorrow morning',
  'Read two chapters of “Deep Work” this weekend',
  'Renew passport before next month',
  'Idea: a weekly review template for the team',
  'Pay electricity bill today',
  'Prepare slides for Monday standup'
];

/** Shared capture pipeline used by the command palette and the inline capture bar. */
export function useCapture(
  onCaptureSaved: (c: Capture) => void,
  onTaskCreated?: (t: Task) => void,
  onCaptureConverted?: (captureId: string) => void
) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);

  const submit = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || submitting) return null;
      setSubmitting(true);
      setError(null);
      try {
        // Saves the capture and lets the AI auto-classify it into the matrix
        const res = await api.captures.create(value, 'TEXT', true);
        setResult(res);
        // A converted capture won't appear in the inbox list; only keep raw captures there
        if (!res.createdTask) onCaptureSaved(res);
        if (res.createdTask && onTaskCreated) onTaskCreated(res.createdTask);
        return res;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to capture');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, onCaptureSaved, onTaskCreated]
  );

  const convertToTask = useCallback(
    async (capture: Capture) => {
      try {
        const task = await api.captures.convertToTask(capture.id, {
          title: capture.suggestedTitle || capture.rawText,
          dueAt: capture.suggestedDueAt || undefined
        });
        onTaskCreated?.(task);
        onCaptureConverted?.(capture.id);
        setResult({ ...capture, createdTask: task });
        return task;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to convert to task');
        return null;
      }
    },
    [onTaskCreated, onCaptureConverted]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { submit, convertToTask, submitting, error, result, reset };
}
