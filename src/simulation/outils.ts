export const toInt = (value: unknown): number => parseInt(String(value ?? ''));
export const TARGET_GROUP_FIELDS = ['actGf1', 'actGf1Gf2', 'actGf1Gf3', 'actGf1Gf4'] as const;
