export function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

export function priceToPercent(price: number): string {
  return `${Math.round(price * 100)}%`;
}

export function formatPriceChange(change: number): string {
  const arrow = change > 0 ? '\u2191' : change < 0 ? '\u2193' : '\u2192';
  const absChange = Math.abs(change * 100);
  return `${arrow} ${absChange.toFixed(1)}%`;
}

export function formatEndDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Expired';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  if (diffDays < 365) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function truncateQuestion(question: string, maxLength: number = 60): string {
  if (question.length <= maxLength) return question;
  return question.slice(0, maxLength - 3).trimEnd() + '...';
}

export function formatDollar(value: number): string {
  return '$' + formatVolume(value);
}

export function contestednessLabel(value: number): string {
  if (value > 0.8) return 'Toss-Up';
  if (value > 0.6) return 'Contested';
  if (value > 0.4) return 'Leaning';
  if (value > 0.2) return 'Likely';
  return 'Strong Consensus';
}
