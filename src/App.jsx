import { useEffect, useState } from 'react';

export default function App() {
  const [theme, setTheme] = useState('day');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="shell">
      <header className="masthead">
        <h1>
          Specimens<em>,</em>
        </h1>
        <span className="label sub">a parametric architectural miscellany</span>
        <button className="label night-toggle" onClick={() => setTheme(theme === 'day' ? 'night' : 'day')}>
          {theme === 'day' ? 'Night sheet' : 'Day sheet'}
        </button>
      </header>
    </div>
  );
}
