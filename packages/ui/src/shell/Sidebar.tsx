import { CuMark, FileText, Plus, Search, Sparkles } from '@cu/icons';
import { AnimatePresence, m } from 'framer-motion';
import {
  type ComponentType,
  type MouseEvent,
  type ReactNode,
  type SVGProps,
  createElement,
  forwardRef,
  isValidElement,
} from 'react';
import { Tooltipped } from '../primitives/Tooltip';
import { cn } from '../utils';

export type SidebarIconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number | string }
>;

export interface SidebarProps {
  expanded?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Sidebar root: 48px collapsed ↔ 240px expanded. Children opt into the layout
 * via the helper components below.
 */
export const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(function Sidebar(
  { expanded = true, className, children },
  ref,
) {
  return (
    <div
      ref={ref}
      data-expanded={expanded ? 'true' : 'false'}
      className={cn('group/sidebar flex h-full flex-col select-none', className)}
    >
      {children}
    </div>
  );
});

export function SidebarHeader({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('app-no-drag flex flex-col gap-1 px-2 pt-2 pb-1', className)}>
      {children}
    </div>
  );
}

export function SidebarBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 app-no-drag', className)}
    >
      {children}
    </div>
  );
}

export function SidebarFooter({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('app-no-drag border-t border-[var(--color-border)] px-2 py-2', className)}>
      {children}
    </div>
  );
}

export function SidebarBrand({
  expanded,
  logo,
  name,
}: {
  expanded?: boolean;
  logo?: ReactNode;
  name?: ReactNode;
}) {
  return (
    <div className="flex items-center h-8 px-1.5 gap-2 mb-1">
      <span className="text-[var(--color-brand-mark,var(--color-accent))] inline-flex items-center justify-center h-7 w-7">
        {logo ?? <CuMark size={20} />}
      </span>
      <AnimatePresence initial={false}>
        {expanded ? (
          <m.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.16 }}
            className="font-serif text-[17px] leading-none tracking-tight text-[var(--color-text)]"
          >
            {name ?? 'Cursor Usage'}
          </m.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function SidebarPrimaryAction({
  expanded,
  label = 'New document',
  icon = <Plus size={16} />,
  onClick,
  active,
}: {
  expanded?: boolean;
  label?: string;
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <Tooltipped label={!expanded ? label : null} side="right">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group relative flex items-center w-full h-8 rounded-[8px]',
          'transition-[background-color,color] duration-[120ms]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          expanded
            ? 'px-2 gap-2 text-[13px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]'
            : 'justify-center text-[var(--color-accent-foreground)]',
        )}
      >
        {expanded ? (
          <>
            <span
              className={cn(
                'inline-flex items-center justify-center h-6 w-6 rounded-full',
                'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]',
              )}
            >
              {icon}
            </span>
            <span className="text-[var(--color-text)]">{label}</span>
          </>
        ) : (
          <span
            className={cn(
              'inline-flex items-center justify-center h-7 w-7 rounded-full',
              'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]',
              active &&
                'ring-2 ring-[var(--color-accent)] ring-offset-1 ring-offset-[var(--color-bg)]',
            )}
          >
            {icon}
          </span>
        )}
      </button>
    </Tooltipped>
  );
}

export interface SidebarNavItemProps {
  icon: SidebarIconComponent | ReactNode;
  label: string;
  active?: boolean;
  expanded?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  trailing?: ReactNode;
  className?: string;
}

export function SidebarNavItem({
  icon,
  label,
  active,
  expanded,
  onClick,
  trailing,
  className,
}: SidebarNavItemProps) {
  const iconNode = isValidElement(icon)
    ? icon
    : icon
      ? createElement(icon as ComponentType<{ size?: number }>, { size: 16 })
      : null;

  const content = (
    <m.button
      type="button"
      onClick={onClick}
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.8 }}
      className={cn(
        'group/item relative flex items-center w-full rounded-[8px]',
        'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
        'transition-colors duration-[100ms]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
        expanded ? 'h-8 px-2 gap-2 text-[13px]' : 'h-8 w-8 mx-auto justify-center',
        active && 'bg-[var(--color-surface-muted)] text-[var(--color-text)]',
        !active && 'hover:bg-[var(--color-surface-muted)]',
        className,
      )}
    >
      {active ? (
        <m.span
          layoutId="sidebar-nav-active-bar"
          aria-hidden="true"
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-full',
            'bg-[var(--color-accent)]',
          )}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        />
      ) : null}
      <m.span
        layout="position"
        className="inline-flex items-center justify-center h-4 w-4 shrink-0"
      >
        {iconNode}
      </m.span>
      <AnimatePresence initial={false}>
        {expanded ? (
          <m.span
            key="label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
            className="flex-1 text-left truncate overflow-hidden whitespace-nowrap"
          >
            {label}
          </m.span>
        ) : null}
      </AnimatePresence>
      {expanded ? trailing : null}
    </m.button>
  );

  if (!expanded) {
    return (
      <Tooltipped label={label} side="right">
        {content}
      </Tooltipped>
    );
  }
  return content;
}

export function SidebarSectionLabel({
  children,
  expanded,
  className,
}: {
  children: ReactNode;
  expanded?: boolean;
  className?: string;
}) {
  if (!expanded) return null;
  return (
    <div
      className={cn(
        'px-2 pt-3 pb-1 text-[10px] uppercase tracking-[0.06em] font-semibold text-[var(--color-text-subtle)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SidebarLinkItem({
  label,
  active,
  onClick,
  trailing,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Bumped row height 7→7 (keep) and font-size 12.5→13 so doc-list
        // rows feel like first-class nav items, not microcopy. Same as
        // SidebarNavItem (13px) so the visual rhythm is uniform.
        'group/link relative flex items-center w-full h-7 rounded-[7px] px-2',
        'text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
        'hover:bg-[var(--color-surface-muted)] transition-colors duration-[100ms]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
        active && 'bg-[var(--color-surface-muted)] text-[var(--color-text)]',
      )}
    >
      <span className="flex-1 text-left truncate">{label}</span>
      {trailing}
    </button>
  );
}

export const SidebarIcons = {
  search: Search,
  documents: FileText,
  agents: Sparkles,
  brand: CuMark,
} as const;
