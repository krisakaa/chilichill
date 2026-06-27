'use client';

import { AppProvider, useApp } from './store';
import { BootScreen } from './components/BootScreen';
import { TourMap } from './components/TourMap';
import { MessageWall } from './components/MessageWall';
import { AdminConsole } from './components/AdminConsole';
import { Composer } from './components/Composer';
import { LoginModal } from './components/LoginModal';
import { Lightbox, Toast } from './components/Overlays';

function Shell() {
  const { booted, screen } = useApp();
  const showPanes = screen !== 'admin';

  return (
    <div className="crt">
      {!booted && <BootScreen />}

      {showPanes && (
        <div className="panes">
          <TourMap />
          <MessageWall />
        </div>
      )}

      {screen === 'admin' && <AdminConsole />}

      <Composer />
      <LoginModal />
      <Lightbox />
      <Toast />
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
