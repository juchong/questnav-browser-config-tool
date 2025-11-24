import { useEffect, useState } from 'react';

export default function Logo() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Check localStorage first
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    // Listen for theme changes
    const handleStorageChange = () => {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
      }
    };

    // Listen for changes to data-theme attribute
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          const dataTheme = document.documentElement.getAttribute('data-theme');
          if (dataTheme === 'light' || dataTheme === 'dark') {
            setTheme(dataTheme);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    window.addEventListener('storage', handleStorageChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const logoSrc = theme === 'dark'
    ? '/QuestNavLogo-Dark.svg'
    : '/QuestNavLogo.svg';

  return (
    <img
      src={logoSrc}
      alt="QuestNav Configuration Tool"
      style={{
        height: '4.5rem',
        width: 'auto',
        maxWidth: '100%',
      }}
    />
  );
}

