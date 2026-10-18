import { useState } from 'react';
import { Link } from 'react-router-dom';

export interface PickerOption<K extends string | number> {
  id: K;
  label: string;
  href?: string;
}

/** Ordered list with add / move up / move down / remove; `onChange` gets the new order. */
export default function OrderedPicker<K extends string | number>({
  label,
  empty,
  value,
  options,
  onChange,
}: {
  label: string;
  empty: string;
  value: K[];
  options: PickerOption<K>[];
  onChange: (next: K[]) => void;
}) {
  const [selected, setSelected] = useState('');
  const available = options.filter((option) => !value.includes(option.id));
  const find = (id: K) => options.find((option) => option.id === id);
  const move = (index: number, delta: number) => {
    const next = [...value];
    [next[index + delta], next[index]] = [next[index], next[index + delta]];
    onChange(next);
  };

  return (
    <>
      <div className="workspace-actions">
        <select
          className="text-input"
          aria-label={label}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">{label}</option>
          {available.map((option) => (
            <option value={String(option.id)} key={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-primary"
          disabled={!selected}
          onClick={() => {
            const option = available.find((item) => String(item.id) === selected);
            if (option) onChange([...value, option.id]);
            setSelected('');
          }}
        >
          Adicionar
        </button>
      </div>
      {value.length === 0 && <p>{empty}</p>}
      <ol className="workspace-list">
        {value.map((id, index) => {
          const option = find(id);
          const text = option?.label ?? String(id);
          return (
            <li key={id}>
              {option?.href ? <Link to={option.href}>{text}</Link> : <span>{text}</span>}
              <div className="workspace-actions">
                <button
                  type="button"
                  className="btn-outline"
                  disabled={index === 0}
                  aria-label={`Mover ${text} para cima`}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={index === value.length - 1}
                  aria-label={`Mover ${text} para baixo`}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="pill-link-btn"
                  onClick={() => onChange(value.filter((item) => item !== id))}
                >
                  Remover
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
