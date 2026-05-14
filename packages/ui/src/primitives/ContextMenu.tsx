import { Check, ChevronRight } from '@cu/icons';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';
import { cn } from '../utils';

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuGroup = ContextMenuPrimitive.Group;
export const ContextMenuPortal = ContextMenuPrimitive.Portal;
export const ContextMenuSub = ContextMenuPrimitive.Sub;
export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const contentClasses = cn(
  'z-[200] min-w-[180px] overflow-hidden',
  'rounded-[12px] bg-[var(--color-surface-raised)] border border-[var(--color-border)]',
  'shadow-[var(--shadow-popover)] p-1',
  'origin-[var(--radix-context-menu-content-transform-origin)]',
  'data-[state=open]:animate-[menu-in_180ms_var(--ease-spring)_forwards]',
  'data-[state=closed]:animate-[menu-out_120ms_var(--ease-standard)_forwards]',
);

const itemClasses = cn(
  'relative flex select-none cursor-pointer items-center gap-2',
  'rounded-[8px] px-2.5 py-1.5 text-[13px] leading-tight outline-none',
  'text-[var(--color-text)]',
  'data-[highlighted]:bg-[var(--color-surface-muted)]',
  'data-[disabled]:opacity-40 data-[disabled]:pointer-events-none',
);

export const ContextMenuContent = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(function ContextMenuContent({ className, ...props }, ref) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        ref={ref}
        className={cn(contentClasses, className)}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
});

export interface ContextMenuItemProps
  extends ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> {
  destructive?: boolean;
  shortcut?: string;
}

export const ContextMenuItem = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.Item>,
  ContextMenuItemProps
>(function ContextMenuItem({ className, destructive, shortcut, children, ...props }, ref) {
  return (
    <ContextMenuPrimitive.Item
      ref={ref}
      className={cn(
        itemClasses,
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
    </ContextMenuPrimitive.Item>
  );
});

export const ContextMenuSubTrigger = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger>
>(function ContextMenuSubTrigger({ className, children, ...props }, ref) {
  return (
    <ContextMenuPrimitive.SubTrigger ref={ref} className={cn(itemClasses, className)} {...props}>
      {children}
      <ChevronRight size={14} className="ml-auto text-[var(--color-text-muted)]" />
    </ContextMenuPrimitive.SubTrigger>
  );
});

export const ContextMenuSubContent = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.SubContent>,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(function ContextMenuSubContent({ className, ...props }, ref) {
  return (
    <ContextMenuPrimitive.SubContent
      ref={ref}
      className={cn(contentClasses, className)}
      {...props}
    />
  );
});

export const ContextMenuCheckboxItem = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(function ContextMenuCheckboxItem({ className, children, checked, ...props }, ref) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      ref={ref}
      checked={checked}
      className={cn(itemClasses, 'pr-2 pl-7', className)}
      {...props}
    >
      <span className="absolute left-2 inline-flex items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <Check size={14} />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
});

export const ContextMenuSeparator = forwardRef<
  ElementRef<typeof ContextMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(function ContextMenuSeparator({ className, ...props }, ref) {
  return (
    <ContextMenuPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-[var(--color-border)]', className)}
      {...props}
    />
  );
});
