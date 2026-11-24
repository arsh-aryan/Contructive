import TopBar from './components/TopBar';
import CityMap from './components/CityMap';
import { Toasts } from './components/ui';

export default function App() {
  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <TopBar />
      <main className="relative overflow-hidden"><CityMap /></main>
      <Toasts />
    </div>
  );
}
