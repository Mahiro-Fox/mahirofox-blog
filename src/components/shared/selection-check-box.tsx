import { Check, Minus } from 'lucide-react';

interface SelectionCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}

/** 统一样式的选择框（原生 input + 叠加图标，支持半选） */
export function SelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: SelectionCheckboxProps) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={onChange}
        className="peer border-input bg-background checked:border-primary checked:bg-primary focus-visible:ring-ring/50 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-lg border shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
      />
      {indeterminate ? (
        <Minus
          className="text-primary-foreground pointer-events-none absolute h-3 w-3"
          strokeWidth={3}
        />
      ) : (
        <Check
          className="text-primary-foreground pointer-events-none absolute h-3 w-3 opacity-0 transition-opacity peer-checked:opacity-100"
          strokeWidth={3}
        />
      )}
    </span>
  );
}
