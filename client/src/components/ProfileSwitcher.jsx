import React from 'react';

export default function ProfileSwitcher({ profile, setProfile }) {
  return (
    <div className="profile-switcher">
      <button className={profile === 'tasks' ? 'active' : ''} onClick={() => setProfile('tasks')}>Eris</button>
      <button className={profile === 'reg' ? 'active' : ''} onClick={() => setProfile('reg')}>Eris Reg</button>
    </div>
  );
}
