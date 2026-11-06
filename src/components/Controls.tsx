import type { ComponentChildren } from 'preact';

interface Option<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

export function Segmented<T extends string | number>(props: {
  label?: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div class="field">
      {props.label && <span class="field-label">{props.label}</span>}
      <div class={`segmented ${props.small ? 'small' : ''}`} role="radiogroup" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            type="button"
            role="radio"
            aria-checked={o.value === props.value}
            class={o.value === props.value ? 'on' : ''}
            disabled={o.disabled}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((props.value - props.min) / (props.max - props.min)) * 100;
  return (
    <label class="field">
      <span class="field-label">
        {props.label}
        <b>{props.format ? props.format(props.value) : props.value}</b>
      </span>
      <input
        type="range"
        class="slider"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        style={{ '--pct': `${pct}%` }}
        onInput={(e) => props.onChange(Number((e.target as HTMLInputElement).value))}
      />
    </label>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  placeholder?: string;
  hint?: ComponentChildren;
  error?: string | null;
  suffix?: string;
  onInput: (v: string) => void;
  type?: 'text' | 'number';
  min?: number;
}) {
  return (
    <label class="field">
      <span class="field-label">{props.label}</span>
      <span class={`input ${props.error ? 'invalid' : ''}`}>
        <input
          type={(props.type ?? 'text') as 'text'}
          value={props.value}
          min={props.min}
          placeholder={props.placeholder}
          spellcheck={false}
          onInput={(e) => props.onInput((e.target as HTMLInputElement).value)}
        />
        {props.suffix && <span class="suffix">{props.suffix}</span>}
      </span>
      {props.error ? <span class="field-error">{props.error}</span> : props.hint && <span class="field-hint">{props.hint}</span>}
    </label>
  );
}

export function Choice(props: {
  on: boolean;
  title: string;
  desc: string;
  icon: ComponentChildren;
  onClick: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={props.on} class={`choice ${props.on ? 'on' : ''}`} onClick={props.onClick}>
      <span class="choice-icon">{props.icon}</span>
      <span class="choice-text">
        <b>{props.title}</b>
        <small>{props.desc}</small>
      </span>
    </button>
  );
}

export function Switch(props: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="switch-row">
      <span class="switch-text">
        <b>{props.label}</b>
        {props.desc && <small>{props.desc}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        class="switch"
        checked={props.checked}
        onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)}
      />
    </label>
  );
}

const SWATCHES = ['#ffffff', '#000000', '#8a8a8a', '#f26b1d', '#d23b2f', '#2f7de1', '#16a37f', '#f5c518'];

/** Themed colour picker: swatches plus a hex field (no native colour widget). */
export function ColorField(props: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = /^#[0-9a-f]{6}$/i.test(props.value);
  return (
    <div class="field">
      <span class="field-label">{props.label}</span>
      <div class="color-field">
        <div class="swatches" role="radiogroup" aria-label={props.label}>
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={props.value.toLowerCase() === c}
              aria-label={c}
              class={`swatch ${props.value.toLowerCase() === c ? 'on' : ''}`}
              style={{ '--c': c }}
              onClick={() => props.onChange(c)}
            />
          ))}
        </div>
        <span class={`input hex ${valid ? '' : 'invalid'}`}>
          <span class="hex-dot" style={{ background: valid ? props.value : 'transparent' }} />
          <input
            value={props.value}
            spellcheck={false}
            maxLength={7}
            aria-label={`${props.label} (hex)`}
            onInput={(e) => {
              let v = (e.target as HTMLInputElement).value.trim();
              if (v && !v.startsWith('#')) v = `#${v}`;
              props.onChange(v);
            }}
          />
        </span>
      </div>
    </div>
  );
}

/** 3×3 (or 2×3) anchor picker. */
export function PositionPicker<T extends string>(props: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  const rows = props.options.length === 6 ? 2 : 3;
  return (
    <div class="field">
      <span class="field-label">{props.label}</span>
      <div class={`pos-grid rows-${rows}`} role="radiogroup" aria-label={props.label}>
        {props.options.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={p === props.value}
            aria-label={p}
            class={p === props.value ? 'on' : ''}
            onClick={() => props.onChange(p)}
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}

export function NumberField(props: { label: string; value: number; min?: number; max?: number; suffix?: string; placeholder?: string; onChange: (v: number) => void }) {
  return (
    <label class="field">
      <span class="field-label">{props.label}</span>
      <span class="input">
        <input
          type="number"
          inputMode="numeric"
          value={props.value || ''}
          min={props.min}
          max={props.max}
          placeholder={props.placeholder}
          onInput={(e) => {
            const n = parseInt((e.target as HTMLInputElement).value, 10);
            props.onChange(Number.isFinite(n) ? Math.max(props.min ?? 0, Math.min(props.max ?? 1e6, n)) : 0);
          }}
        />
        {props.suffix && <span class="suffix">{props.suffix}</span>}
      </span>
    </label>
  );
}
