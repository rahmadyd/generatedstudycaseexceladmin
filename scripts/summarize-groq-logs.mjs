import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function extractCompletionEvents(value) {
  if (Array.isArray(value)) {
    return value.flatMap(extractCompletionEvents);
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  if (value.event === 'groq_completion') {
    return [value];
  }

  for (const wrapper of ['message', 'payload', 'text']) {
    if (typeof value[wrapper] !== 'string') continue;
    try {
      const nested = JSON.parse(value[wrapper]);
      const events = extractCompletionEvents(nested);
      if (events.length > 0) return events;
    } catch {
      continue;
    }
  }
  return [];
}

function readEvents(filePath) {
  const contents = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = contents.split(/\r?\n/);
  const events = [];
  let ignoredLines = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`Baris ${index + 1} bukan JSON yang valid. Gunakan ekspor log JSONL.`);
    }

    const found = extractCompletionEvents(parsed);
    if (found.length === 0) {
      ignoredLines += 1;
      continue;
    }
    events.push(...found);
  }

  if (events.length === 0) {
    throw new Error('Tidak ditemukan event groq_completion pada file log.');
  }
  return { events, ignoredLines };
}

function getUtcDay(timestamp, eventNumber) {
  if (timestamp === undefined || timestamp === null || timestamp === '') {
    return 'tanpa-tanggal';
  }
  if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`Timestamp event ke-${eventNumber} tidak valid.`);
  }
  return new Date(timestamp).toISOString().slice(0, 10);
}

function summarize(events) {
  const groups = new Map();

  events.forEach((event, index) => {
    if (!Number.isInteger(event.status) && event.status !== null) {
      throw new Error(`Status event ke-${index + 1} harus berupa angka atau null.`);
    }
    const day = getUtcDay(event.timestamp, index + 1);
    const level = typeof event.level === 'string' && event.level.trim()
      ? event.level.trim()
      : 'unknown';
    const key = `${day}\u0000${level}`;
    const group = groups.get(key) ?? {
      day,
      level,
      calls: 0,
      failed: 0,
      rateLimited: 0,
      tokenTotal: 0,
      tokenSamples: 0,
    };

    group.calls += 1;
    if (event.status === null || event.status < 200 || event.status >= 300) {
      group.failed += 1;
    }
    if (event.status === 429) {
      group.rateLimited += 1;
    }
    const totalTokens = event.usage?.total_tokens;
    if (Number.isFinite(totalTokens) && totalTokens >= 0) {
      group.tokenTotal += totalTokens;
      group.tokenSamples += 1;
    }
    groups.set(key, group);
  });

  return [...groups.values()].sort((left, right) =>
    left.day.localeCompare(right.day) || left.level.localeCompare(right.level),
  );
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Pemakaian: npm run report:groq -- <path-log-jsonl>');
  }

  const { events, ignoredLines } = readEvents(resolve(inputPath));
  const rows = summarize(events);
  console.log('Tanggal UTC | Level | Panggilan | Gagal | Gagal (%) | 429 | Rata-rata token | Sampel token');
  for (const row of rows) {
    const failureRate = ((row.failed / row.calls) * 100).toFixed(1);
    const averageTokens = row.tokenSamples > 0
      ? (row.tokenTotal / row.tokenSamples).toFixed(1)
      : '-';
    console.log(
      `${row.day} | ${row.level} | ${row.calls} | ${row.failed} | ${failureRate}% | ${row.rateLimited} | ${averageTokens} | ${row.tokenSamples}`,
    );
  }
  console.log(
    'Gagal = panggilan provider non-2xx atau kegagalan transport; rata-rata token hanya memakai respons dengan usage.total_tokens.',
  );
  if (ignoredLines > 0) {
    console.log(`${ignoredLines} baris JSON non-groq_completion diabaikan.`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
