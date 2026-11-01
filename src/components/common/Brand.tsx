import { GraduationCap } from 'lucide-react';

type BrandProps = { compact?: boolean };

export function Brand({ compact = false }: BrandProps) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="Preppx student portal">
      <span className="brand__mark"><GraduationCap size={19} strokeWidth={2.2} /></span>
      {!compact && <span className="brand__wordmark">preppx<span className="brand__dot">.</span></span>}
    </div>
  );
}
