import { Building2, CircleHelp, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { ParcelValidation } from '../types';
import { VACANCY_LABELS } from '../lib/vacancy';

export function ValidationBadge({ validation, compact = false }: { validation: ParcelValidation; compact?: boolean }) {
  const Icon = validation.status === 'verified_vacant' ? ShieldCheck : validation.status === 'probable_vacant' ? ShieldAlert : validation.status === 'improved' ? Building2 : CircleHelp;
  return (
    <span className={`validation-badge validation-${validation.status}${compact ? ' compact' : ''}`} title={`${validation.reasons.join('\n')} · ${validation.fieldCompleteness}% field completeness`}>
      <Icon size={compact ? 12 : 14} />
      <span>{VACANCY_LABELS[validation.status]}</span>
      {!compact && <strong>{validation.score}</strong>}
    </span>
  );
}
