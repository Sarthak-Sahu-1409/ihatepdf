/**
 * Pill CTA with a sliding circular fill on hover.
 *
 * Uses inline styles rather than Tailwind utilities so the animation is guaranteed
 * regardless of Tailwind's class-scan coverage (the rest of this codebase uses inline styles).
 * Tailwind utilities are only applied via the `classes` / `className` escape hatches.
 */
import { forwardRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface MotionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'primary' | 'secondary';
  /** Extra Tailwind classes applied to the root button (escape hatch). */
  classes?: string;
  animate?: boolean;
  delay?: number;
  loading?: boolean;
}

const FILL_PRIMARY = '#e4e4e7';   // zinc-200 — light disc, readable arrow on dark bg
const FILL_SECONDARY = '#8b5cf6'; // violet-500

// Input: MotionButtonProps + standard button attrs. Output: pill with sliding fill and icon.
// forwardRef so callers (e.g. form libs) can get a ref to the underlying <button>.
export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  (
    {
      label,
      variant = 'primary',
      classes,
      className,
      animate: _animate,
      delay,
      loading = false,
      disabled,
      type = 'button',
      style: externalStyle,
      ...props
    },
    ref
  ) => {
    const [hovered, setHovered] = useState(false);

    const isSecondary = variant === 'secondary';
    const fillColor = isSecondary ? FILL_SECONDARY : FILL_PRIMARY;
    const arrowColor = isSecondary ? '#fff' : '#18181b';
    const labelIdleColor = '#ffffff';
    const labelHoverColor = isSecondary ? '#fff' : '#18181b';
    const isBusy = loading || disabled;
    const isExpanded = hovered && !isBusy;

    const rootStyle: CSSProperties = {
      position: 'relative',
      display: 'inline-flex',
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      minWidth: 220,
      borderRadius: 9999,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.06)',
      padding: 4,
      cursor: disabled ? 'not-allowed' : 'pointer',
      overflow: 'hidden',
      opacity: disabled && !loading ? 0.5 : 1,
      outline: 'none',
      transition: 'opacity 0.2s ease',
      ...(delay ? { transitionDelay: `${delay}ms` } : {}),
      ...externalStyle,
    };

    const fillStyle: CSSProperties = {
      position: 'absolute',
      top: 4,
      left: 4,
      height: 'calc(100% - 8px)',
      width: isExpanded ? 'calc(100% - 8px)' : 46,
      borderRadius: 9999,
      background: fillColor,
      transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
      zIndex: 0,
    };

    const iconWrapStyle: CSSProperties = {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 46,
      height: 46,
      flexShrink: 0,
      color: arrowColor,
      transition: 'transform 0.3s ease',
      transform: isExpanded ? 'translateX(2px)' : 'translateX(0)',
    };

    const labelStyle: CSSProperties = {
      position: 'relative',
      zIndex: 1,
      flex: 1,
      paddingRight: 20,
      textAlign: 'center',
      fontSize: '1rem',
      fontWeight: 600,
      letterSpacing: '-0.015em',
      whiteSpace: 'nowrap',
      color: isExpanded ? labelHoverColor : labelIdleColor,
      transition: 'color 0.3s ease',
      userSelect: 'none',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(classes, className)}
        style={rootStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        {...props}
      >
        {/* sliding fill */}
        <span style={fillStyle} aria-hidden />

        {/* icon */}
        <span style={iconWrapStyle} aria-hidden>
          {loading ? (
            <Loader2 size={22} strokeWidth={2.2} style={{ animation: 'spin 0.75s linear infinite' }} />
          ) : (
            <ArrowRight size={22} strokeWidth={2.2} />
          )}
        </span>

        {/* label */}
        <span style={labelStyle}>{label}</span>
      </button>
    );
  }
);

MotionButton.displayName = 'MotionButton';

export default MotionButton;
