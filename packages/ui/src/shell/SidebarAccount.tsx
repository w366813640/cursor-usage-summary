import {
  ChevronDown,
  HelpCircle,
  type IconProps,
  Languages,
  LogOut,
  Settings,
  Sparkles,
} from '@cu/icons';
import type { ComponentType, ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../primitives/Avatar';
import { Badge } from '../primitives/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../primitives/DropdownMenu';
import { cn } from '../utils';

export interface SidebarAccountAction {
  id: string;
  label: string;
  icon?: ComponentType<IconProps>;
  shortcut?: string;
  tone?: 'default' | 'destructive';
  onSelect?: () => void;
}

export interface SidebarAccountProps {
  expanded?: boolean;
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  planBadge?: ReactNode;
  actions?: SidebarAccountAction[];
  className?: string;
}

const DEFAULT_ACTIONS: SidebarAccountAction[] = [
  { id: 'settings', label: 'Settings', icon: Settings, shortcut: '⌘,' },
  { id: 'language', label: 'Language', icon: Languages },
  { id: 'help', label: 'Get help', icon: HelpCircle },
  { id: 'upgrade', label: 'Upgrade plan', icon: Sparkles },
  { id: 'logout', label: 'Log out', icon: LogOut, tone: 'destructive' },
];

export function SidebarAccount({
  expanded = true,
  name,
  subtitle,
  avatarUrl,
  planBadge,
  actions = DEFAULT_ACTIONS,
  className,
}: SidebarAccountProps) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('') || '·';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'app-no-drag group flex items-center w-full rounded-[10px] px-1.5 py-1 gap-2',
            'text-left text-[13px] text-[var(--color-text)]',
            'hover:bg-[var(--color-surface-muted)] transition-colors duration-[100ms]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
            !expanded && 'justify-center',
            className,
          )}
        >
          <Avatar className="h-7 w-7 shrink-0">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
          </Avatar>
          {expanded ? (
            <>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-[13px] leading-tight font-medium">{name}</span>
                {subtitle ? (
                  <span className="block truncate text-[11.5px] leading-tight text-[var(--color-text-muted)]">
                    {subtitle}
                  </span>
                ) : null}
              </span>
              {planBadge ?? null}
              <ChevronDown
                size={14}
                className="text-[var(--color-text-subtle)] shrink-0 transition-transform group-data-[state=open]:rotate-180"
              />
            </>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={expanded ? 'top' : 'right'}
        align={expanded ? 'start' : 'end'}
        sideOffset={8}
        className="min-w-[240px]"
      >
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-[var(--color-text)]">{name}</span>
            {subtitle ? (
              <span className="text-[11.5px] text-[var(--color-text-muted)]">{subtitle}</span>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action, idx) => {
          const Icon = action.icon;
          const isDestructive = action.tone === 'destructive';
          const showSeparatorBefore =
            isDestructive && idx > 0 && actions[idx - 1]?.tone !== 'destructive';
          return (
            <div key={action.id}>
              {showSeparatorBefore ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                onSelect={action.onSelect}
                className={cn(isDestructive && 'text-[var(--color-destructive)]')}
              >
                {Icon ? (
                  <Icon
                    size={14}
                    className={cn(
                      isDestructive
                        ? 'text-[var(--color-destructive)]'
                        : 'text-[var(--color-text-muted)]',
                    )}
                  />
                ) : null}
                <span className="flex-1">{action.label}</span>
                {action.shortcut ? (
                  <span className="text-[11px] text-[var(--color-text-subtle)] tabular-nums">
                    {action.shortcut}
                  </span>
                ) : null}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DefaultPlanBadge({ children = 'Pro' }: { children?: ReactNode }) {
  return (
    <Badge tone="accent" size="sm" className="shrink-0">
      {children}
    </Badge>
  );
}
