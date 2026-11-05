import { useState } from 'react';
import Modal from './Modal.tsx';

/** Create / edit dialog for things with a name and a description (modules, classes). */
export default function NameDialog({
  title,
  nameLabel = 'Nome',
  placeholder,
  initial = { name: '', description: '' },
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  nameLabel?: string;
  placeholder?: string;
  initial?: { name: string; description: string };
  submitLabel: string;
  onSubmit: (value: { name: string; description: string }) => Promise<boolean | undefined> | void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="workspace-form modal-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const ok = await onSubmit({ name: name.trim(), description });
          setBusy(false);
          if (ok !== false) onClose();
        }}
      >
        <label className="field-label" htmlFor="name-dialog-name">
          {nameLabel}
        </label>
        <input
          id="name-dialog-name"
          className="text-input"
          required
          maxLength={255}
          // biome-ignore lint/a11y/noAutofocus: the dialog opens to type the name
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
        />
        <label className="field-label" htmlFor="name-dialog-description">
          Descrição
        </label>
        <textarea
          id="name-dialog-description"
          className="text-input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="modal-actions">
          <button className="btn-primary" type="submit" disabled={busy}>
            {submitLabel}
          </button>
          <button className="btn-outline" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
