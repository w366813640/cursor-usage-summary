import { BrandSwitcherProvider } from '@cu/brand';
import {
  I18nProvider,
  KeyboardShortcutsProvider,
  ModalStackProvider,
  SidebarStateProvider,
  ThemeProvider,
  ToastProvider,
  TooltipProvider,
} from '@cu/ui';
import { MotionConfig } from 'framer-motion';
import { CommandPaletteProvider } from './components/CommandPalette';
import { WelcomePage } from './pages/WelcomePage';

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider initialLocale="en">
        <BrandSwitcherProvider initialBrandId="cu-bloomberg">
          <TooltipProvider delayDuration={150}>
            <ToastProvider>
              <ModalStackProvider>
                <KeyboardShortcutsProvider>
                  <SidebarStateProvider defaultExpanded>
                    {/* The palette wraps everything below so Cmd/Ctrl+K
                        works on both the welcome screen and the dashboard. */}
                    <CommandPaletteProvider>
                      <MotionConfig reducedMotion="user">
                        <WelcomePage />
                      </MotionConfig>
                    </CommandPaletteProvider>
                  </SidebarStateProvider>
                </KeyboardShortcutsProvider>
              </ModalStackProvider>
            </ToastProvider>
          </TooltipProvider>
        </BrandSwitcherProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
