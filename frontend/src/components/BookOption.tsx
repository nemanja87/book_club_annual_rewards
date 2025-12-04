import { Book } from '../api/types';

interface BookOptionProps {
  groupName: string;
  book: Book;
  selected: boolean;
  onSelect: (bookId: number) => void;
  disabled?: boolean;
}

export default function BookOption({ groupName, book, selected, onSelect, disabled }: BookOptionProps) {
  return (
    <label className={`book-option ${selected ? 'selected' : ''}`}>
      <input
        type="radio"
        name={groupName}
        checked={selected}
        onChange={() => onSelect(book.id)}
        disabled={disabled}
      />
      <div>
        <strong>{book.title}</strong>
        {book.author && <span className="muted"> by {book.author}</span>}
      </div>
    </label>
  );
}
