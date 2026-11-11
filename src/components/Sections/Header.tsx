import classNames from 'classnames';
import Link from 'next/link';
import {FC, memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {IoClose, IoMenu} from 'react-icons/io5';

import {SectionId} from '../../data/data';
import {useNavObserver} from '../../hooks/useNavObserver';

export const headerID = 'headerNav';

const Header: FC = memo(() => {
  const [currentSection, setCurrentSection] = useState<SectionId | null>(null);
  const navSections = useMemo(() => [SectionId.About, SectionId.Resume, SectionId.Portfolio, SectionId.Contact], []);

  const intersectionHandler = useCallback((section: SectionId | null) => {
    if (section) {
      setCurrentSection(section);
    }
  }, []);

  useNavObserver(navSections.map(section => `#${section}`).join(','), intersectionHandler);

  return (
    <>
      <MobileNav currentSection={currentSection} navSections={navSections} />
      <DesktopNav currentSection={currentSection} navSections={navSections} />
    </>
  );
});

const DesktopNav: FC<{navSections: SectionId[]; currentSection: SectionId | null}> = memo(
  ({navSections, currentSection}) => {
    const baseClass =
      '-m-1.5 p-1.5 rounded-sm font-bold first-letter:uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-700 sm:hover:text-fuchsia-700 text-neutral-100 border-b-[0px]';
    const activeClass = classNames(baseClass, 'text-fuchsia-700');
    const inactiveClass = classNames(baseClass, 'text-neutral-100');
    return (
      <header className="fixed top-0 z-50 hidden w-full bg-neutral-900/50 p-4 backdrop-blur sm:block" id={headerID}>
        <nav aria-label="Main navigation" className="flex justify-center gap-x-8">
          {navSections.map(section => (
            <NavItem
              activeClass={activeClass}
              current={section === currentSection}
              inactiveClass={inactiveClass}
              key={section}
              section={section}
            />
          ))}
        </nav>
      </header>
    );
  },
);

const MobileNav: FC<{navSections: SectionId[]; currentSection: SectionId | null}> = memo(
  ({navSections, currentSection}) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const navigationRef = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);

    const dismiss = useCallback(() => {
      setIsOpen(false);
      toggleRef.current?.focus({preventScroll: true});
    }, []);

    useEffect(() => {
      if (!isOpen) return;

      const onPointerDown = (event: PointerEvent) => {
        if (!navigationRef.current?.contains(event.target as Node)) {
          // A blank-page tap should not blur the restored opener on pointerup.
          // Leave native focus/activation alone when the user chose another control.
          if (
            !(event.target as Element).closest?.('a, button, input, textarea, select, [tabindex], [contenteditable]')
          ) {
            event.preventDefault();
          }
          dismiss();
        }
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          dismiss();
        }
      };
      const onFocusIn = (event: FocusEvent) => {
        // A disclosure is not modal: Tab can leave it without stealing focus.
        if (!navigationRef.current?.contains(event.target as Node)) setIsOpen(false);
      };
      const desktop = window.matchMedia('(min-width: 640px)');
      const onResize = () => {
        if (desktop.matches) setIsOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('focusin', onFocusIn);
      desktop.addEventListener('change', onResize);
      window.addEventListener('resize', onResize);
      onResize();
      return () => {
        document.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('focusin', onFocusIn);
        desktop.removeEventListener('change', onResize);
        window.removeEventListener('resize', onResize);
      };
    }, [dismiss, isOpen]);

    const selectSection = useCallback((section: string) => {
      setIsOpen(false);
      const target = document.getElementById(section);
      if (target) {
        // Keep native anchor scrolling, but move keyboard reading to its destination.
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
          target.addEventListener('blur', () => target.removeAttribute('tabindex'), {once: true});
        }
        target.focus({preventScroll: true});
      }
    }, []);

    const baseClass =
      'flex min-h-11 items-center px-4 py-3 rounded-md first-letter:uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500';
    const activeClass = classNames(baseClass, 'bg-neutral-900 text-white font-bold');
    const inactiveClass = classNames(baseClass, 'text-neutral-200 font-medium');
    return (
      <div className="fixed right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-50 sm:hidden" ref={navigationRef}>
        <button
          aria-controls="mobile-navigation"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
          className="ml-auto flex h-12 w-12 items-center justify-center rounded-md bg-fuchsia-900 text-white ring-offset-gray-800/60 hover:bg-fuchsia-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2"
          onClick={() => setIsOpen(open => !open)}
          ref={toggleRef}
          type="button">
          {isOpen ? (
            <IoClose aria-hidden="true" className="h-8 w-8" />
          ) : (
            <IoMenu aria-hidden="true" className="h-8 w-8" />
          )}
        </button>
        <nav
          aria-label="Mobile navigation"
          className="mt-2 max-h-[calc(100dvh-5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-64 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-lg"
          hidden={!isOpen}
          id="mobile-navigation">
          {navSections.map(section => (
            <NavItem
              activeClass={activeClass}
              current={section === currentSection}
              inactiveClass={inactiveClass}
              key={section}
              onClick={() => selectSection(section)}
              section={section}
            />
          ))}
        </nav>
      </div>
    );
  },
);

const NavItem: FC<{
  section: string;
  current: boolean;
  activeClass: string;
  inactiveClass: string;
  onClick?: () => void;
}> = memo(({section, current, inactiveClass, activeClass, onClick}) => {
  return (
    <Link
      aria-current={current ? 'location' : undefined}
      className={classNames(current ? activeClass : inactiveClass)}
      href={`/#${section}`}
      key={section}
      onClick={onClick}>
      {section}
    </Link>
  );
});

Header.displayName = 'Header';
export default Header;
