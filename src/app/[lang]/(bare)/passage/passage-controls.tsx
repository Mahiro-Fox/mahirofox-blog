'use client';

import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/shadcn-ui/sheet';
import { Slider } from '@/components/shadcn-ui/slider';
import { cn } from '@/utils/utils';
import {
  PASSAGE_PRESETS,
  PRESET_IDS,
  type PassageLabels,
  type PassageParams,
  type PassagePresetId,
} from './presets';

type NumericKey = Exclude<
  keyof PassageParams,
  'colors' | 'background' | keyof BooleanKeys
>;
type BooleanKeys = Pick<
  PassageParams,
  'focusOnClick' | 'captions' | 'wheel' | 'interactive' | 'paused'
>;
type BooleanKey = keyof BooleanKeys;

interface SliderSpec {
  key: NumericKey;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

/** 取值范围与官方 demo 的调节面板一致 */
const SLIDERS: SliderSpec[] = [
  { key: 'lanes', min: 2, max: 12, step: 1 },
  { key: 'gap', min: 0, max: 0.4, step: 0.01 },
  { key: 'radius', min: 0, max: 1, step: 0.01 },
  { key: 'photoFill', min: 0, max: 1, step: 0.01 },
  { key: 'accentFill', min: 0, max: 0.6, step: 0.01 },
  { key: 'lineOpacity', min: 0, max: 0.6, step: 0.01 },
  { key: 'fog', min: 0.2, max: 3, step: 0.05 },
  { key: 'speed', min: -2, max: 4, step: 0.05 },
  { key: 'boost', min: 1, max: 20, step: 0.5, unit: '×' },
  { key: 'blur', min: 0, max: 3, step: 0.05 },
  { key: 'look', min: 0, max: 3, step: 0.05 },
  { key: 'fov', min: 40, max: 100, step: 1, unit: '°' },
  { key: 'hover', min: 0, max: 2, step: 0.05 },
  { key: 'seed', min: 0, max: 20, step: 1 },
];

const TOGGLES: BooleanKey[] = [
  'focusOnClick',
  'captions',
  'wheel',
  'interactive',
  'paused',
];

interface PassageControlsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: PassageParams;
  /** 当前套用的预设，手动改过参数后为 null */
  preset: PassagePresetId | null;
  onChange: (patch: Partial<PassageParams>) => void;
  onPreset: (id: PassagePresetId) => void;
  onReset: () => void;
  labels: PassageLabels;
}

const format = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

export function PassageControls({
  open,
  onOpenChange,
  params,
  preset,
  onChange,
  onPreset,
  onReset,
  labels,
}: PassageControlsProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // 遮罩压得很淡：调参数时还要看得见隧道本身
        overlayClassName="bg-black/20 backdrop-blur-[1px]"
        className="w-full gap-0 border-border p-0 sm:max-w-[368px]"
      >
        <SheetHeader className="gap-1.5 border-b border-border px-5 py-4 pr-12">
          <SheetTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            {labels.title}
          </SheetTitle>
          <SheetDescription className="text-xs leading-relaxed text-muted-foreground">
            {labels.description}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <Section title={labels.preset} hint={labels.presetHint}>
            <div className="flex flex-col gap-1.5">
              {PRESET_IDS.map((id) => {
                const item = PASSAGE_PRESETS[id];
                const active = preset === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onPreset(id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-foreground hover:border-foreground/20 hover:bg-accent'
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-6 shrink-0 rounded-md ring-1 ring-border"
                      style={{
                        background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})`,
                      }}
                    />
                    <span className="flex-1 text-[13px] font-medium">
                      {labels.presets[id]}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] tabular-nums',
                        active
                          ? 'text-primary-foreground/60'
                          : 'text-muted-foreground'
                      )}
                    >
                      {item.lanes} · {item.speed}×
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title={labels.appearance} className="mt-5">
            <div className="flex flex-col gap-2.5">
              <ColorRow
                label={labels.colorA}
                value={params.colors[0]}
                onChange={(value) =>
                  onChange({ colors: [value, params.colors[1]] })
                }
              />
              <ColorRow
                label={labels.colorB}
                value={params.colors[1]}
                onChange={(value) =>
                  onChange({ colors: [params.colors[0], value] })
                }
              />
              <ColorRow
                label={labels.background}
                value={params.background}
                onChange={(value) => onChange({ background: value })}
              />
            </div>
          </Section>

          <Section
            title={labels.parameters}
            className="mt-5 border-t border-border pt-5"
          >
            <div className="flex flex-col gap-4">
              {SLIDERS.map((spec) => (
                <SliderRow
                  key={spec.key}
                  spec={spec}
                  label={labels[spec.key]}
                  value={params[spec.key]}
                  onChange={(value) =>
                    onChange({ [spec.key]: value } as Partial<PassageParams>)
                  }
                />
              ))}
            </div>
          </Section>

          <div className="mt-5 flex flex-col gap-1 border-t border-border pt-3">
            {TOGGLES.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 py-1.5"
              >
                <span className="text-[13px] text-foreground">
                  {labels[key]}
                </span>
                <Switch
                  label={labels[key]}
                  checked={params[key]}
                  onChange={(checked) =>
                    onChange({ [key]: checked } as Partial<PassageParams>)
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-foreground/20 hover:bg-accent"
          >
            <RotateCcw className="size-3.5" />
            {labels.reset}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          {title}
        </h3>
        {hint ? (
          <span className="text-[10px] text-muted-foreground/60">{hint}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SliderRow({
  spec,
  label,
  value,
  onChange,
}: {
  spec: SliderSpec;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {format(value)}
          {spec.unit ?? ''}
        </span>
      </div>
      <Slider
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
        aria-label={label}
      />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13px] text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground uppercase tabular-nums">
          {value}
        </span>
        <span className="relative size-7 overflow-hidden rounded-md ring-1 ring-border">
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ backgroundColor: value }}
          />
          <input
            type="color"
            value={value}
            aria-label={label}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </span>
      </div>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors',
        checked ? 'bg-primary' : 'bg-input'
      )}
    >
      <span
        className={cn(
          'block size-4 rounded-full bg-background shadow-sm ring-1 ring-foreground/10 transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}
