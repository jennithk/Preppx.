type ProgressBarProps = { value: number; label?: string };

export function ProgressBar({ value, label }: ProgressBarProps) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}>
      <span className="progress-track__value" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
