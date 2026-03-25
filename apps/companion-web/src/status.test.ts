import { describe, it, expect } from 'vitest';
import {
  formatUptime,
  formatActivity,
  formatMood,
  parseHealthResponse,
} from './status.js';

describe('formatUptime', () => {
  it('formats seconds', () => {
    expect(formatUptime(45)).toBe('45s');
  });

  it('formats minutes', () => {
    expect(formatUptime(120)).toBe('2m');
  });

  it('formats hours and minutes', () => {
    expect(formatUptime(3661)).toBe('1h 1m');
  });

  it('returns dash for negative', () => {
    expect(formatUptime(-1)).toBe('—');
  });

  it('returns dash for NaN', () => {
    expect(formatUptime(NaN)).toBe('—');
  });

  it('returns dash for Infinity', () => {
    expect(formatUptime(Infinity)).toBe('—');
  });

  it('formats zero as 0s', () => {
    expect(formatUptime(0)).toBe('0s');
  });
});

describe('formatActivity', () => {
  it('formats snake_case activity', () => {
    expect(formatActivity('use_computer')).toBe('Use Computer');
  });

  it('formats single word', () => {
    expect(formatActivity('sleep')).toBe('Sleep');
  });

  it('returns dash for null', () => {
    expect(formatActivity(null)).toBe('—');
  });
});

describe('formatMood', () => {
  it('shows emoji for known mood', () => {
    expect(formatMood('happy')).toBe('(^_^) Happy');
  });

  it('shows neutral emoji for unknown mood', () => {
    expect(formatMood('mysterious')).toBe('(._.) Mysterious');
  });

  it('capitalizes mood name', () => {
    expect(formatMood('curious')).toBe('(o.o) Curious');
  });
});

describe('parseHealthResponse', () => {
  it('parses valid response', () => {
    const data = {
      status: 'ok',
      uptime: 3600,
      lastTickAt: '2026-03-25T10:00:00Z',
      tickCount: 120,
      currentActivity: 'read',
      currentMood: 'curious',
      memoryCount: 42,
    };
    const result = parseHealthResponse(data);
    expect(result).toEqual(data);
  });

  it('returns null for non-object', () => {
    expect(parseHealthResponse('string')).toBeNull();
    expect(parseHealthResponse(null)).toBeNull();
    expect(parseHealthResponse(42)).toBeNull();
  });

  it('returns null for missing status', () => {
    expect(parseHealthResponse({ uptime: 100 })).toBeNull();
  });

  it('returns null for invalid status value', () => {
    expect(
      parseHealthResponse({ status: 'unknown', uptime: 100 }),
    ).toBeNull();
  });

  it('defaults optional fields', () => {
    const result = parseHealthResponse({ status: 'ok', uptime: 50 });
    expect(result).toEqual({
      status: 'ok',
      uptime: 50,
      lastTickAt: null,
      tickCount: 0,
      currentActivity: null,
      currentMood: 'neutral',
      memoryCount: 0,
    });
  });

  it('handles wrong types gracefully', () => {
    const result = parseHealthResponse({
      status: 'degraded',
      uptime: 'not-a-number',
      currentActivity: 123,
      currentMood: false,
    });
    expect(result).toEqual({
      status: 'degraded',
      uptime: 0,
      lastTickAt: null,
      tickCount: 0,
      currentActivity: null,
      currentMood: 'neutral',
      memoryCount: 0,
    });
  });
});
