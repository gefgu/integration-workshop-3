import Icon, { type IconName } from './Icon.tsx';

/** Icon-only button with its name shown on hover (and read by screen readers). */
export function IconButton({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
  tipUp = false,
  outline = false,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  tipUp?: boolean;
  outline?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${outline ? 'icon-btn-outline' : 'icon-btn-quiet'} has-tip${tipUp ? ' tip-up' : ''}${danger ? ' danger' : ''}`}
      data-tip={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

/** Every "Excluir"/"Remover" in the site: a trash icon; `confirm` asks first. */
export function TrashButton({
  label = 'Excluir',
  confirm: question,
  onConfirm,
  tipUp = false,
}: {
  label?: string;
  confirm?: string;
  onConfirm: () => void;
  tipUp?: boolean;
}) {
  return (
    <IconButton
      icon="trash"
      label={label}
      danger
      tipUp={tipUp}
      onClick={() => {
        if (!question || window.confirm(question)) onConfirm();
      }}
    />
  );
}
