import test from 'node:test';
import assert from 'node:assert';
import { getOllamaStatus, analyzeTaskWithAI, fallbackAnalyzeTask } from '../src/ollamaService.js';

test('Ollama AI status and 30b model validation', async () => {
  const status = await getOllamaStatus();
  assert.strictEqual(status.connected, true, 'Ollama should be connected');
  assert.ok(status.model.includes('30b') || status.model.includes('31b') || status.model.includes('nemotron'), 'Active model should be a 30b-class model');
  assert.ok(Array.isArray(status.availableModels) && status.availableModels.length > 0, 'Available models list should be non-empty');
});

test('Ollama AI task analysis classifies urgent & important task', async () => {
  const result = await analyzeTaskWithAI({
    title: 'Urgent client server outage',
    description: 'Fix production bug by tonight',
    deadline: null,
    refDate: new Date('2026-11-01T12:00:00Z')
  });

  assert.ok(['DO_FIRST', 'SCHEDULE', 'DELEGATE', 'ELIMINATE'].includes(result.eisenhowerQuadrant));
  assert.strictEqual(result.urgency, 'URGENT');
  assert.ok(result.aiAnalysis);
  assert.ok(result.aiAnalysis.model);
});

test('Fallback NLP analyzer classifies appropriately when offline', () => {
  const fallback = fallbackAnalyzeTask({
    title: 'Review insurance policies by next week',
    description: 'Finance and health paperwork'
  });

  assert.ok(['Finance', 'Health'].includes(fallback.category));
  assert.ok(fallback.eisenhowerQuadrant);
  assert.strictEqual(fallback.aiAnalysis.source, 'nlp_fallback');
});
