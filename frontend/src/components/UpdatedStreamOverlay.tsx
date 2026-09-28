import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Layers, Printer, Timer } from 'lucide-react';
import './UpdatedStreamOverlay.css';

interface UpdatedStreamOverlayProps {
  size: 'small' | 'medium' | 'large';
  camera: { url: string; rotation: number; onError: () => void } | null;
  name: string | null;
  model: string | null;
  filename: string | null;
  status: string | null;
  state: string | null;
  progress: number | null;
  layers: string | null;
  remaining: string | null;
  eta: string | null;
  temperatures: { key: string; icon: ReactNode; label: string; current: number; target: number | null }[];
}

export function UpdatedStreamOverlay(props: UpdatedStreamOverlayProps) {
  const { t } = useTranslation();
  const { camera, name, model, filename, status, state, progress, layers, remaining, eta, temperatures } =
    props;
  const hasPanel =
    filename || status || progress != null || layers || remaining || eta || temperatures.length > 0;
  const rotation = camera?.rotation ?? 0;
  const sideways = Math.abs(rotation % 180) === 90;
  const stats = [
    { key: 'layers', icon: <Layers />, label: t('streamOverlay.layer'), value: layers },
    { key: 'remaining', icon: <Timer />, label: t('streamOverlay.remaining'), value: remaining },
    { key: 'eta', icon: <Clock />, label: t('streamOverlay.eta'), value: eta },
  ].filter((stat) => stat.value != null);

  return (
    <div className="updated-overlay" data-size={props.size} data-state={state}>
      <header className="updated-overlay__header">
        {(name || model) && (
          <div className="updated-overlay__identity">
            <Printer aria-hidden="true" />
            <div>
              {name && <strong>{name}</strong>}
              {model && <span>{model}</span>}
            </div>
          </div>
        )}
        <a
          className="updated-overlay__logo"
          href="https://github.com/maziggy/bambuddy"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/img/bambuddy_logo_powered_by.png" alt="Bambuddy" />
        </a>
      </header>
      {camera && (
        <div className="updated-overlay__camera">
          <img
            key={camera.url}
            src={camera.url}
            alt={t('streamOverlay.cameraStream')}
            data-sideways={sideways}
            style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
            onError={camera.onError}
          />
        </div>
      )}
      {hasPanel && (
        <section className="updated-overlay__panel">
          {(filename || status) && (
            <div className="updated-overlay__summary">
              {filename && <h1>{filename}</h1>}
              {status && (
                <div className="updated-overlay__status">
                  <span aria-hidden="true" />
                  {status}
                </div>
              )}
            </div>
          )}
          {progress != null && (
            <div className="updated-overlay__progress">
              <span>{t('streamOverlay.progress')}</span>
              <div
                role="progressbar"
                aria-label={t('streamOverlay.progress')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div style={{ width: `${progress}%` }} />
              </div>
              <strong>{Math.round(progress)}%</strong>
            </div>
          )}
          {(stats.length > 0 || temperatures.length > 0) && (
            <div className="updated-overlay__readings">
              {stats.length > 0 && (
                <div className="updated-overlay__stats">
                  {stats.map((stat) => (
                    <div className="updated-overlay__reading" key={stat.key}>
                      {stat.icon}
                      <div>
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {temperatures.length > 0 && (
                <div className="updated-overlay__temperatures">
                  {temperatures.map((reading) => (
                    <div className="updated-overlay__reading" key={reading.key}>
                      {reading.icon}
                      <div>
                        <span>{reading.label}</span>
                        <strong>
                          {Math.round(reading.current)}°C
                          {reading.target != null &&
                            reading.target > 0 &&
                            Math.round(reading.target) !== Math.round(reading.current) && (
                              <small> / {Math.round(reading.target)}°C</small>
                            )}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
