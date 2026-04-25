type RegisterBlockedCardProps = {
  title: string;
  description: string;
  ctaLabel: string;
  onCtaClick: () => void;
};

export default function RegisterBlockedCard({
  title,
  description,
  ctaLabel,
  onCtaClick,
}: RegisterBlockedCardProps) {
  return (
    <div className="mono-card p-6 sm:p-8">
      <h3 className="mono-title text-lg">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
      <div className="mt-4">
        <button type="button" className="mono-button" onClick={onCtaClick}>
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
