import { useEffect, useRef } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';

interface GameMapProps {
  mountWorld: (parent: HTMLElement) => () => void;
}

export function GameMap({ mountWorld }: GameMapProps) {
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scene.current) {
      return mountWorld(scene.current);
    }
  }, [mountWorld]);

  return (
    <section
      className="map-card"
      id="road"
      role="application"
      tabIndex={0}
      aria-label="Игровое поле. Управление WASD или стрелками, пробел — тормоз."
    >
      <div className="map-label">
        <MapPin size={16} />
        <div>
          <strong>Садовый квартал</strong>
          <span>Небольшой город · без спешки</span>
        </div>
      </div>
      <div ref={scene} className="phaser-world" aria-hidden="true" />
      <div className="north">
        <span>N</span>
        <ArrowUpRight size={20} />
      </div>
      <span className="map-scale">
        <span />
        20 м
      </span>
    </section>
  );
}
