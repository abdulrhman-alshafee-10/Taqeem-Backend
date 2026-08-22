export function priorityFor(reason: string): number {
  const priorities: Record<string, number> = {
    HATE_SPEECH:     100,
    VIOLENCE:         90,
    PERSONAL_ATTACK:  85,
    PII:              80,
    FAKE:             60,
    FALSE_CLAIM:      60,
    INAPPROPRIATE:    55,
    COPYRIGHT:        50,
    SPAM:             30,
    PERMANENTLY_CLOSED: 20,
    OTHER:            20,
  };
  return priorities[reason] ?? 20;
}
