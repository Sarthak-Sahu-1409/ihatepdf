import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Input: class names / conditional class values. Output: single merged Tailwind-safe string.
// Deduplicates conflicting utilities (tailwind-merge) after clsx concatenation — shadcn-style helper.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
