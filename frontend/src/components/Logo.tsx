import { useTheme } from '../hooks/useTheme';

export default function Logo() {
  const { theme } = useTheme();

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
