/**
 * The step's objective, kept on screen while the student works. The tutor bubble changes with every hint and
 * warning; this bar always says what the step is asking for and, for experiments, which missions are still open.
 */
export interface GoalItem {
  label: string;
  done: boolean;
}

export default function GoalBar({
  text,
  items = [],
  label = 'Objetivo desta etapa',
}: {
  text: string;
  items?: GoalItem[];
  label?: string;
}) {
  if (!text?.trim() && items.length === 0) return null;
  return (
    <aside className="goal-bar" aria-label={label}>
      <span className="goal-bar-label">🎯 {label}</span>
      <span className="goal-bar-text">{text}</span>
      {items.length > 0 && (
        <ul className="goal-bar-items" aria-label="Missões">
          {items.map((item) => (
            <li key={item.label}>
              <span aria-hidden="true">{item.done ? '✅' : '⬜'}</span> {item.label}
              <span className="visually-hidden"> {item.done ? '(feita)' : '(a fazer)'}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
