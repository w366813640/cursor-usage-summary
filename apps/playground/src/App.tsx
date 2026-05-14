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
                    <WelcomePage />
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
