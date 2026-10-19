import React from 'react';
import { FoodSystemProvider, useFoodSystem } from './context/FoodSystemContext';
import Navbar from './components/Navbar';
import ScannerView from './components/ScannerView';
import LiveDashboard from './components/LiveDashboard';
import AdminPanel from './components/AdminPanel';
import BadgesView from './components/BadgesView';
import ToastContainer from './components/ToastContainer';

function MainApp() {
  const { activeTab } = useFoodSystem();

  return (
    <div className="min-h-screen p-4 md:p-6 pb-20 flex flex-col justify-between">
      <div>
        <Navbar />

        <main className="transition-all duration-300">
          {activeTab === 'scanner' && <ScannerView />}
          {activeTab === 'dashboard' && <LiveDashboard />}
          {activeTab === 'admin' && <AdminPanel />}
          {activeTab === 'badges' && <BadgesView />}
        </main>
      </div>

      <footer className="max-w-7xl mx-auto w-full mt-10 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-4 no-print">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Medaithon Food Logistics & Distribution Engine • React + Vite + WebSockets</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Real-time Food Distribution Active</span>
        </div>
      </footer>

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <FoodSystemProvider>
      <MainApp />
    </FoodSystemProvider>
  );
}
