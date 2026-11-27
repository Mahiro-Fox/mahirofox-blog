'use client';

import { Checkbox } from '@/components/shadcn-ui/checkbox';

interface SelectionCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}

/** 统一样式的选择框（基于 shadcn Checkbox，支持半选） */
export function SelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: SelectionCheckboxProps) {
  return (
    <Checkbox
      aria-label={label}
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={() => onChange()}
    />
  );
}
