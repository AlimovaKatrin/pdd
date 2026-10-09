export const RULE_TYPES = ['stop', 'speed', 'signal', 'indicator', 'pedestrian'] as const;

export type RuleType = (typeof RULE_TYPES)[number];

export const CAUSE_CODES = [
  'stop-line',
  'speed-limit',
  'red-signal',
  'missing-indicator',
  'wrong-indicator',
  'late-indicator',
  'early-indicator-off',
  'pedestrian-obstruction',
] as const;

export type CauseCode = (typeof CAUSE_CODES)[number];

export interface Question {
  id: string;
  version: string;
  status: 'demo' | 'verified';
  rule: RuleType;
  title: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  reference: { label: string; url: string; verification: string };
  matches?: CauseCode[];
  context?: 'same' | 'related';
  difference?: string;
  official?: {
    category: 'B';
    ticket: number;
    number: number;
    source: string;
    checkedOn: string;
    usage: string;
  };
  image?: { src: string; alt: string; source: string; usage: string };
}
