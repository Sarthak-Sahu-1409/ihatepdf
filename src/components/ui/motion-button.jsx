/**
 * Pill CTA with a sliding circular fill on hover.
 *
 * Uses inline styles rather than Tailwind utilities so the animation is guaranteed
 * regardless of Tailwind's class-scan coverage (the rest of this codebase uses inline styles).
 */
import { forwardRef, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

const FILL_PRIMARY = '#e4e4e7';   // zinc-200 — light disc, readable arrow on dark bg
const FILL_SECONDARY = '#8b5cf6'; // violet-500

/** Inner padding (px). Fill layer and collapsed disc align to these insets. */
const PAD_X = 12;
const PAD_Y = 8;
/** Space between arrow disc and label (fixed so hover does not reflow text). */
const ICON_LABEL_GAP = 10;

// Input: props with label, variant, classes, animate, delay, loading, disabled + standard button attrs.
// Output: pill with sliding fill and icon.
// forwardRef so callers (e.g. form libs) can get a ref to the underlying <button>.
export const MotionButton = forwardRef(
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

    // Merge class names without tailwind-merge dependency
    const mergedClassName = [classes, className].filter(Boolean).join(' ') || undefined;

    const rootStyle = {
      position: 'relative',
      display: 'inline-flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: ICON_LABEL_GAP,
      minHeight: PAD_Y * 2 + 46,
      minWidth: 220,
      borderRadius: 9999,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.06)',
      padding: `${PAD_Y}px ${PAD_X}px`,
      boxSizing: 'border-box',
      cursor: disabled ? 'not-allowed' : 'pointer',
      overflow: 'hidden',
      opacity: disabled && !loading ? 0.5 : 1,
      outline: 'none',
      transition: 'opacity 0.2s ease',
      ...(delay ? { transitionDelay: `${delay}ms` } : {}),
      ...externalStyle,
    };

    const fillStyle = {
      position: 'absolute',
      top: PAD_Y,
      left: PAD_X,
      height: 46,
      width: isExpanded ? `calc(100% - ${PAD_X * 2}px)` : 46,
      borderRadius: 9999,
      background: fillColor,
      transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
      zIndex: 0,
      pointerEvents: 'none',
    };

    const iconWrapStyle = {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 46,
      height: 46,
      flexShrink: 0,
      color: arrowColor,
    };

    const labelStyle = {
      position: 'relative',
      zIndex: 1,
      flex: '0 1 auto',
      display: 'flex',
      alignItems: 'center',
      alignSelf: 'center',
      minHeight: 46,
      textAlign: 'left',
      fontSize: '1rem',
      fontWeight: 600,
      letterSpacing: '-0.015em',
      whiteSpace: 'nowrap',
      color: isExpanded ? labelHoverColor : labelIdleColor,
      transition: 'color 0.25s ease',
      userSelect: 'none',
      paddingRight: 14,
      paddingLeft: 0,
      boxSizing: 'border-box',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={mergedClassName}
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
