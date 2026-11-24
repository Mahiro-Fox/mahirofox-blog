'use client';

import { groupedNavRoutes, siteConfig } from '@/config';
import { ChevronDown, LogOut, Menu, Settings, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { userLogout } from '@/actions/app/user-auth';
import { useAuthModal } from '@/components/auth/auth-modal-provider';
import { Search } from '@/components/layout/search';
import { Button } from '@/components/shadcn-ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn-ui/dropdown-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/shadcn-ui/sheet';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { Link } from '@/components/shared/link';
import { SiteLogo } from '@/components/shared/site-logo';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import { useT } from '@/i18n/dictionary-provider';
import { usePathnameWithoutLocale } from '@/i18n/use-pathname-without-locale';
import { cn } from '@/utils/utils';

interface SiteHeaderUser {
  id: string;
  username: string;
}

interface SiteHeaderProps {
  initialUserAuth?: SiteHeaderUser | null;
}

const PRIMARY_LINKS = [
  { href: '/page/gallery/1', labelKey: 'gallery_nav_label' },
  { href: '/page/blog/1', labelKey: 'journal_nav_label' },
  { href: '/#tool', labelKey: 'tool_nav_label' },
  { href: '/about', labelKey: 'about_nav_label' },
] as const;

const PRIMARY_HREFS = new Set<string>([
  '/page/gallery/1',
  '/page/blog/1',
  '/about',
]);

const SCROLL_THRESHOLD = 12;

export function SiteHeader({ initialUserAuth = null }: SiteHeaderProps) {
  const t = useT();
  const pathname = usePathnameWithoutLocale();
  const router = useRouter();
  const authModal = useAuthModal();
  const [scrolled, setScrolled] = useState(false);
  const [currentUser, setCurrentUser] = useState<SiteHeaderUser | null>(
    initialUserAuth
  );
  const [prevAuth, setPrevAuth] = useState<SiteHeaderUser | null>(
    initialUserAuth
  );

  if (initialUserAuth !== prevAuth) {
    setPrevAuth(initialUserAuth);
    setCurrentUser(initialUserAuth);
  }

  useEffect(() => {
    const handleScroll = (): void => {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pathname]);

  const isHome = pathname === '/' || pathname === '';
  // 只有首页顶部才透明；其他页面直接使用玻璃态，避免内页缺少大图时失去对比度
  const transparentAtTop = isHome && !scrolled;

  const isActive = (href: string): boolean => {
    if (href === '/page/blog/1') {
      return pathname === href || pathname.startsWith('/blog/');
    }
    if (href === '/page/gallery/1') {
      return pathname === href || pathname.startsWith('/gallery/');
    }
    return pathname === href;
  };

  const moreGroups = Object.entries(groupedNavRoutes)
    .map(([category, items]) => ({
      category,
      items: items.filter(
        (item) =>
          item.navHref &&
          !PRIMARY_HREFS.has(item.navHref) &&
          (!item.needAuth || !!currentUser)
      ),
    }))
    .filter((group) => group.items.length > 0);

  const handleLogout = async (): Promise<void> => {
    try {
      await userLogout();
      setCurrentUser(null);
      toast.success('Logged out');
      router.refresh();
    } catch {
      toast.error('Logout failed');
    }
  };

  const handleOpenAuth = (): void => {
    if (authModal) {
      authModal.openAuthModal();
    } else {
      router.push('/signin');
    }
  };

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 w-full border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500',
        transparentAtTop
          ? 'border-transparent bg-transparent'
          : 'border-border/60 bg-background/70 supports-[backdrop-filter]:bg-background/55 shadow-[0_1px_0_0_rgba(0,0,0,0.03)] backdrop-blur-xl'
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            'flex items-center justify-between gap-4 transition-[height] duration-500',
            scrolled ? 'h-12 lg:h-14' : 'h-14 lg:h-16'
          )}
        >
          <Link
            href="/"
            aria-label={t('site_name')}
            className="group focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 shrink-0 items-center gap-2.5 rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <SiteLogo className="size-8 overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-105" />
            <span className="text-[13px] font-semibold tracking-[0.18em] lowercase">
              {siteConfig.copyRight}
            </span>
          </Link>

          {/* 中：桌面主入口 */}
          <nav className="hidden items-center gap-7 lg:flex">
            {PRIMARY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'focus-visible:ring-ring focus-visible:ring-offset-background relative rounded-sm text-[13px] tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                  isActive(link.href)
                    ? 'text-foreground after:bg-primary after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t(link.labelKey)}
              </Link>
            ))}
            {moreGroups.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex items-center gap-1 rounded-sm text-[13px] tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {t('more_nav_label')}
                    <ChevronDown className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  className="max-h-[70vh] w-[34rem] overflow-y-auto p-2"
                >
                  {moreGroups.map((group) => (
                    <div key={group.category} className="mb-2 last:mb-0">
                      <p className="text-muted-foreground px-2 py-1.5 text-[10px] font-medium tracking-[0.22em] uppercase">
                        {t(group.category)}
                      </p>
                      <div className="grid grid-cols-2 gap-0.5">
                        {group.items.map((item) => (
                          <DropdownMenuItem
                            key={item.navHref}
                            asChild
                            className="cursor-pointer"
                          >
                            <Link
                              href={item.navHref as string}
                              className="flex items-start gap-2 py-2"
                            >
                              {item.icon && (
                                <item.icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                              )}
                              <span className="flex min-w-0 flex-col">
                                <span className="text-sm">
                                  {t(item.navLabel || '')}
                                </span>
                                <span className="text-muted-foreground line-clamp-1 text-[11px]">
                                  {t(item.navDescription || '')}
                                </span>
                              </span>
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* 右：搜索 / 主题 / 语言 / 账户 */}
          <div className="flex shrink-0 items-center gap-1">
            <Search />
            <ThemeSwitcher />
            <div className="hidden lg:flex">
              <LanguageSwitcher />
            </div>

            <div className="hidden lg:block">
              {currentUser ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2"
                    >
                      <User className="size-4" />
                      <span className="max-w-24 truncate">
                        {currentUser.username}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-44" align="end">
                    <DropdownMenuLabel>
                      {t('user_menu.welcome')}, {currentUser.username}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/settings">
                        <Settings className="mr-2 size-4" />
                        {t('user_menu.settings')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer"
                    >
                      <LogOut className="mr-2 size-4" />
                      {t('user_menu.logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={handleOpenAuth}
                >
                  <User className="mr-1 size-4" />
                  {t('user_menu.signin')}
                </Button>
              )}
            </div>

            {/* 移动端菜单 */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 lg:hidden"
                  aria-label={t('more_nav_label')}
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex w-[86vw] max-w-sm flex-col gap-0"
              >
                <SheetHeader>
                  <SheetClose asChild>
                    <Link
                      href="/"
                      className="flex items-center gap-2.5 text-left"
                    >
                      <SiteLogo className="size-9 overflow-hidden rounded-full" />
                      <span className="text-sm font-semibold tracking-[0.16em] lowercase">
                        {siteConfig.copyRight}
                      </span>
                    </Link>
                  </SheetClose>
                  <SheetTitle className="sr-only">{t('site_name')}</SheetTitle>
                  <SheetDescription className="sr-only">
                    {t('site_description')}
                  </SheetDescription>
                </SheetHeader>

                <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4">
                  {PRIMARY_LINKS.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <Link
                        href={link.href}
                        className={cn(
                          'rounded-lg px-3 py-2.5 text-base font-medium transition-colors',
                          isActive(link.href)
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-muted'
                        )}
                      >
                        {t(link.labelKey)}
                      </Link>
                    </SheetClose>
                  ))}

                  <div className="bg-border my-2 h-px" />

                  {Object.entries(groupedNavRoutes).map(
                    ([categoryName, items]) => {
                      const visibleItems = items.filter(
                        (item) => !item.needAuth || !!currentUser
                      );
                      if (!visibleItems.length) {
                        return null;
                      }
                      return (
                        <div key={categoryName} className="mb-2">
                          <p className="text-muted-foreground px-3 py-2 text-[10px] font-medium tracking-[0.22em] uppercase">
                            {t(categoryName)}
                          </p>
                          {visibleItems.map((item) => (
                            <SheetClose asChild key={item.navHref}>
                              <Link
                                href={item.navHref as string}
                                className={cn(
                                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                                  isActive(item.navHref as string)
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-muted'
                                )}
                              >
                                {item.icon && <item.icon className="size-4" />}
                                {t(item.navLabel || '')}
                              </Link>
                            </SheetClose>
                          ))}
                        </div>
                      );
                    }
                  )}
                </nav>

                <div className="border-border/60 mt-auto flex flex-col gap-3 border-t p-4">
                  <LanguageSwitcher />
                  {currentUser ? (
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" className="flex-1">
                        <Link href="/settings">
                          <Settings className="mr-1 size-4" />
                          {currentUser.username}
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleLogout}
                      >
                        <LogOut className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={handleOpenAuth}>
                      <User className="mr-1 size-4" />
                      {t('user_menu.signin')}
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
