import { Check, ChevronRight } from '@cu/icons';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { type ComponentPropsWithoutRef, type ElementRef, type ReactNode, forwardRef } from 'react';
import { cn } from '../utils';

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;
export const DropdownMenuPortal = DropdownPrimitive.Portal;
export const DropdownMenuSub = DropdownPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup;

const contentClasses = cn(
  'z-[200] min-w-[180px] overflow-hidden',
  'rounded-[12px] bg-[var(--color-surface-raised)] border border-[var(--color-border)]',
  'shadow-[var(--shadow-popover)] p-1',
  'origin-[var(--radix-dropdown-menu-content-transform-origin)]',
  'data-[state=open]:animate-[menu-in_180ms_var(--ease-spring)_forwards]',
  'data-[state=closed]:animate-[menu-out_120ms_var(--ease-standard)_forwards]',
);

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(contentClasses, className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
});

export const DropdownMenuSubContent = forwardRef<
  ElementRef<typeof DropdownPrimitive.SubContent>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.SubContent>
>(function DropdownMenuSubContent({ className, ...props }, ref) {
  return (
    <DropdownPrimitive.SubContent ref={ref} className={cn(contentClasses, className)} {...props} />
  );
});

const itemClasses = cn(
  'relative flex select-none cursor-pointer items-center gap-2',
  'rounded-[8px] px-2.5 py-1.5 text-[13px] leading-tight outline-none',
  'text-[var(--color-text)]',
  'data-[highlighted]:bg-[var(--color-surface-muted)]',
  'data-[disabled]:opacity-40 data-[disabled]:pointer-events-none',
  'transition-colors duration-[80ms]',
);

export interface DropdownMenuItemProps
  extends ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> {
  inset?: boolean;
  destructive?: boolean;
  shortcut?: string;
}

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.Item>,
  DropdownMenuItemProps
>(function DropdownMenuItem({ className, inset, destructive, shortcut, children, ...props }, ref) {
  return (
    <DropdownPrimitive.Item
      ref={ref}
      className={cn(
        itemClasses,
        inset && 'pl-7',
        destructive &&
          'text-[var(--color-destructive)] data-[highlighted]:bg-[var(--color-destructive-soft)]',
        className,
      )}
      {...props}
    >
      {children}
      {shortcut ? (
        <span className="ml-auto text-[11px] tracking-wider text-[var(--color-text-subtle)]">
          {shortcut}
        </span>
      ) : null}
    </DropdownPrimitive.Item>
  );
});

export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.CheckboxItem>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, checked, ...props }, ref) {
  return (
    <DropdownPrimitive.CheckboxItem
      ref={ref}
      checked={checked}
      className={cn(itemClasses, 'pr-2 pl-7', className)}
      {...props}
    >
      <span className="absolute left-2 inline-flex items-center justify-center">
        <DropdownPrimitive.ItemIndicator>
          <Check size={14} />
        </DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
});

export const DropdownMenuRadioItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.RadioItem>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <DropdownPrimitive.RadioItem
      ref={ref}
      className={cn(itemClasses, 'pr-2 pl-7', className)}
      {...props}
    >
      <span className="absolute left-2 inline-flex h-2 w-2 items-center justify-center">
        <DropdownPrimitive.ItemIndicator>
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
        </DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.RadioItem>
  );
});

export const DropdownMenuSubTrigger = forwardRef<
  ElementRef<typeof DropdownPrimitive.SubTrigger>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.SubTrigger>
>(function DropdownMenuSubTrigger({ className, children, ...props }, ref) {
  return (
    <DropdownPrimitive.SubTrigger
      ref={ref}
      className={cn(itemClasses, 'pr-2', className)}
      {...props}
    >
      {children}
      <ChevronRight size={14} className="ml-auto text-[var(--color-text-muted)]" />
    </DropdownPrimitive.SubTrigger>
  );
});

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof DropdownPrimitive.Label>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>
>(function DropdownMenuLabel({ className, ...props }, ref) {
  return (
    <DropdownPrimitive.Label
      ref={ref}
      className={cn(
        'px-2.5 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)]',
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-[var(--color-border)]', className)}
      {...props}
    />
  );
});

export function DropdownMenuItemDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('text-[12px] text-[var(--color-text-muted)]', className)}>{children}</span>
  );
}
