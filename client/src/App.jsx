import React, { useEffect, useState } from 'react';
import TasksApp from './profiles/tasks/TasksApp.jsx';
import RegApp from './profiles/reg/RegApp.jsx';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('eris-theme') || 'light');
  const [profile, setProfile] = useState(() => localStorage.getItem('eris-active-profile') || 'reg');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('eris-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('eris-active-profile', profile);
  }, [profile]);

  const props = { theme, setTheme, profile, setProfile };
  return profile === 'tasks' ? <TasksApp {...props} /> : <RegApp {...props} />;
}
