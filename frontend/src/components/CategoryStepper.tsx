import { Category } from '../api/types';

interface CategoryStepperProps {
  categories: Category[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export default function CategoryStepper({ categories, currentIndex, onNavigate }: CategoryStepperProps) {
  if (!categories.length) {
    return null;
  }

  return (
    <div className="stepper">
      {categories.map((category, index) => (
        <button
          key={category.id}
          className={index === currentIndex ? 'step active' : 'step'}
          onClick={() => onNavigate(index)}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
