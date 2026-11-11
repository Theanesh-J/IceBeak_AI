import type { LocalisedContent, ProductInput, Segment, Finding } from '../domain/types';

export interface ServerStatus {
  reachable: boolean;
  configured: boolean;
  model: string | null;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export async function getStatus(): Promise<ServerStatus> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error();
    const data = await res.json();
    return { reachable: true, configured: !!data.configured, model: data.model ?? null };
  } catch {
    return { reachable: false, configured: false, model: null };
  }
}

export const generateWithAI = (product: ProductInput) => post<LocalisedContent>('/api/generate', { product });

export const reviseWithAI = (product: ProductInput, segment: Segment, findings: Finding[]) =>
  post<{ en: string; de: string; rationale: string }>('/api/revise', {
    product,
    segment: { en: segment.en, de: segment.de, field: segment.field },
    findings: findings.map((f) => ({ title: f.title, explanation: f.explanation })),
  });
