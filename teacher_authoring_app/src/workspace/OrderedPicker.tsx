import { Link } from 'react-router-dom';
import { TrashButton } from '../components/IconButton.tsx';

export interface PickerOption<K extends string | number> {
  id: K;
  label: string;
  href?: string;
}

/**
 * Ordered list with add / move up / move down / remove; `onChange` gets the new order. Choosing an item in the
 * "+ Adicionar…" box adds it at the end right away.
 */
export default function OrderedPicker<K extends string | number>({
  label,
  empty,
  value,
  options,
  onChange,
}: {
  /** what the add box says, e.g. "Adicionar lição ao módulo…" */
  label: string;
  empty: string;
  value: K[];
  options: PickerOption<K>[];
  onChange: (next: K[]) => void;
}) {
  const available = options.filter((option) => !value.includes(option.id));
  const find = (id: K) => options.find((option) => option.id === id);
  const move = (index: number, delta: number) => {
    const next = [...value];
    [next[index + delta], next[index]] = [next[index], next[index + delta]];
    onChange(next);
  };

  return (
    <>
      {value.length === 0 && <p className="muted-line">{empty}</p>}
      <ol className="workspace-list ordered-picker">
        {value.map((id, index) => {
          const option = find(id);
          const text = option?.label ?? String(id);
          return (
            <li key={id}>
              <span className="ordered-picker-index">{index + 1}</span>
              {option?.href ? <Link to={option.href}>{text}</Link> : <span>{text}</span>}
              <div className="workspace-actions ordered-picker-actions">
                <button
                  type="button"
                  className="icon-btn icon-btn-quiet"
                  disabled={index === 0}
                  aria-label={`Mover ${text} para cima`}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-quiet"
                  disabled={index === value.length - 1}
                  aria-label={`Mover ${text} para baixo`}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <TrashButton label="Remover" onConfirm={() => onChange(value.filter((item) => item !== id))} />
              </div>
            </li>
          );
        })}
      </ol>
      {available.length > 0 && (
        <select
          className="text-input ordered-picker-add"
          aria-label={label}
          value=""
          onChange={(e) => {
            const option = available.find((item) => String(item.id) === e.target.value);
            if (option) onChange([...value, option.id]);
          }}
        >
          <option value="">＋ {label}</option>
          {available.map((option) => (
            <option value={String(option.id)} key={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
