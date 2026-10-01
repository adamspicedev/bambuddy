/**
 * Streaming-overlay URL builder (#1422).
 *
 * The overlay at /overlay/{printerId} has been configurable by query string
 * since #2613, but only for people who found the parameters in the wiki. The
 * issue asked for the field set to be selectable "through the web UI"; this is
 * that surface. Appearance is configured in the URL. Saved overlay credentials
 * are retrieved separately for their owner and held only in component memory.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Copy, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { parseUTCDate } from '../utils/date';
import { api, type Printer } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { OverlayBrandingControls } from './OverlayBrandingControls';
import { DEFAULT_BRANDING } from '../utils/overlayBranding';
import { useAuth } from '../contexts/AuthContext';
import { CreateTokenForm } from '../pages/CameraTokensPage';
import { NumberInput } from './NumberInput';
import { OverlayFrame } from './OverlayFrame';
import { OVERLAY_DIMENSIONS, type OverlayLayout } from '../utils/overlayLayout';

type OverlaySize = 'small' | 'medium' | 'large';

// Order matters: it is the order the fields appear in the overlay, so the
// checkbox list reads as a preview of the result.
const FIELDS = [
  { key: 'printer', labelKey: 'streamOverlay.builder.fieldPrinter', fallback: 'Printer name' },
  { key: 'model', labelKey: 'streamOverlay.builder.fieldModel', fallback: 'Printer model' },
  { key: 'filename', labelKey: 'streamOverlay.builder.fieldFilename', fallback: 'File name' },
  { key: 'status', labelKey: 'streamOverlay.builder.fieldStatus', fallback: 'Status' },
  { key: 'progress', labelKey: 'streamOverlay.builder.fieldProgress', fallback: 'Progress bar' },
  { key: 'layers', labelKey: 'streamOverlay.builder.fieldLayers', fallback: 'Layer count' },
  { key: 'eta', labelKey: 'streamOverlay.builder.fieldEta', fallback: 'Time remaining and ETA' },
  { key: 'nozzle', labelKey: 'printers.heaterHistory.nozzle', fallback: 'Nozzle' },
  { key: 'bed', labelKey: 'printers.heaterHistory.bed', fallback: 'Bed' },
  { key: 'chamber', labelKey: 'printers.heaterHistory.chamber', fallback: 'Chamber' },
] as const;

// Matches parseConfig() in StreamOverlayPage: the fields an overlay shows when
// the URL carries no ?show= at all.
const DEFAULT_FIELDS = ['progress', 'layers', 'eta', 'filename', 'status'];

const DEFAULT_FPS = 15;

export function StreamOverlayBuilder({ onTokenCreated }: { onTokenCreated?: () => void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user, hasPermission } = useAuth();
  const [creatingToken, setCreatingToken] = useState(false);
  const [revealToken, setRevealToken] = useState(false);
  const queryClient = useQueryClient();
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [secret, setSecret] = useState({ id: '', value: '' });
  const [secretError, setSecretError] = useState(false);
  const [expiryRevision, setExpiryRevision] = useState(0);
  const [secretRequestRevision, setSecretRequestRevision] = useState(0);
  const canManageTokens = !!user && hasPermission('camera:view');
  const { data: savedTokens = [], isPending: tokensPending, isError: tokensError, refetch } = useQuery({
    queryKey: ['overlay-tokens', user?.id],
    queryFn: api.listMyLongLivedCameraTokens,
    enabled: canManageTokens,
  });
  const overlayTokens = savedTokens.filter((saved) => saved.scope === 'overlay');
  const isExpired = (expires: string) => (parseUTCDate(expires)?.getTime() ?? 0) <= Date.now();
  const selectedToken = overlayTokens.find((saved) => String(saved.id) === selectedTokenId);
  const selectedTokenExpired = !!selectedToken && isExpired(selectedToken.expires_at);
  useEffect(() => {
    if (!selectedToken || selectedTokenExpired) return;
    const remaining = (parseUTCDate(selectedToken.expires_at)?.getTime() ?? 0) - Date.now();
    const timer = window.setTimeout(() => setExpiryRevision((revision) => revision + 1), Math.min(Math.max(remaining, 0), 86400000));
    return () => window.clearTimeout(timer);
  }, [selectedToken, selectedTokenExpired, expiryRevision]);
  const token = selectedToken?.can_reuse && !isExpired(selectedToken.expires_at) && secret.id === selectedTokenId
    ? secret.value : '';
  const tokenUnavailable = selectedTokenId !== '' && !token;

  useEffect(() => {
    let cancelled = false;
    setSecretError(false);
    setSecret({ id: '', value: '' });
    if (!canManageTokens || !selectedToken?.can_reuse || isExpired(selectedToken.expires_at)) return;
    const id = String(selectedToken.id);
    void api.retrieveOverlayToken(selectedToken.id).then((result) => {
      if (!cancelled) setSecret({ id, value: result.token });
    }).catch(() => {
      if (!cancelled) setSecretError(true);
    });
    return () => { cancelled = true; };
  }, [canManageTokens, selectedToken?.id, selectedToken?.can_reuse, selectedToken?.expires_at, selectedTokenExpired, secretRequestRevision]);

  const [printers, setPrinters] = useState<Printer[]>([]);
  const [printerId, setPrinterId] = useState<number | null>(null);
  const [fields, setFields] = useState<string[]>(DEFAULT_FIELDS);
  const [size, setSize] = useState<OverlaySize>('medium');
  const [fps, setFps] = useState(DEFAULT_FPS);
  // '1' is the original overlay; the renderer is picked by version, not by a
  // name like "updated" that stops being true once there's a newer one.
  const [artwork, setArtwork] = useState<'1' | '2'>('1');
  const [backgroundTransparency, setBackgroundTransparency] = useState(0);
  const [showCamera, setShowCamera] = useState(true);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [layout, setLayout] = useState<OverlayLayout | 'both'>('landscape');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await api.getPrinters();
        if (cancelled) return;
        setPrinters(list);
        if (list.length > 0) setPrinterId((current) => current ?? list[0].id);
      } catch {
        // A failed printer list only costs the picker its options — the builder
        // still works if the user types a printer number into the URL by hand,
        // so this is not worth a toast on a settings page they may just be
        // scrolling past.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const outputs = useMemo(() => {
    const id = printerId ?? 1;
    const params = new URLSearchParams();
    // Emit ?show= in the canonical field order rather than click order, so the
    // same selection always produces the same URL.
    const selected = FIELDS.filter((f) => fields.includes(f.key)).map((f) => f.key);
    params.set('show', selected.join(','));
    if (size !== 'medium') params.set('size', size);
    if (fps !== DEFAULT_FPS) params.set('fps', String(fps));
    if (artwork !== '1') params.set('artwork', artwork);
    if (artwork === '2' && backgroundTransparency > 0) {
      params.set('backgroundTransparency', String(backgroundTransparency));
    }
    if (!showCamera) params.set('camera', 'false');
    if (branding.logo) params.set('logo', '1');
    if (branding.from && branding.to) {
      params.set('progressFrom', branding.from);
      params.set('progressTo', branding.to);
    }
    if (token.trim()) params.set('token', token.trim());
    const layouts: OverlayLayout[] = layout === 'both' ? ['landscape', 'portrait'] : [layout];
    return layouts.map((orientation) => {
      if (orientation === 'portrait') params.set('layout', orientation);
      else params.delete('layout');
      return { layout: orientation, url: `${window.location.origin}/overlay/${id}?${params.toString()}` };
    });
  }, [printerId, fields, size, fps, showCamera, token, artwork, layout, branding, backgroundTransparency]);

  const displayedUrl = (url: string) => {
    const masked = new URL(url);
    if (masked.searchParams.has('token') && !revealToken) masked.searchParams.set('token', '••••••••');
    return masked.toString();
  };

  const toggleField = (key: string) => {
    setFields((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const copyUrl = async (url: string) => {
    try {
      // Same fallback as the token dialog: the clipboard API needs a secure
      // context, and plenty of Bambuddy installs are plain HTTP on a LAN.
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        try {
          ta.select();
          if (!document.execCommand('copy')) throw new Error();
        } finally {
          document.body.removeChild(ta);
        }
      }
      showToast(t('cameraTokens.toast.copied', 'Copied to clipboard'));
    } catch {
      showToast(t('cameraTokens.toast.copyFailed', 'Copy failed — select and copy manually'), 'error');
    }
  };

  return (
    <div className="@container/overlay min-w-0">
      <p className="text-sm text-bambu-gray mb-4">
        {t(
          'streamOverlay.builder.description',
          'Build the URL for a streaming overlay — a full-screen camera view with live print data drawn over it, for OBS, a wall display, or any browser source. Pick the fields you want and copy the URL.',
        )}
      </p>

      <div className="mb-4 space-y-2">
        {user && hasPermission('camera:view') && (
          <button type="button" onClick={() => setCreatingToken((current) => !current)} className="px-3 py-2 bg-bambu-dark-tertiary text-white rounded-md">
            {t(creatingToken ? 'common.cancel' : 'streamOverlay.builder.createToken')}
          </button>
        )}
        {creatingToken && user && hasPermission('camera:view') && <CreateTokenForm fixedScope="overlay" onCreated={(created) => {
          if (!created.token) return;
          setPreview(false);
          void queryClient.invalidateQueries({ queryKey: ['overlay-tokens'] });
          setSelectedTokenId(String(created.id));
          setRevealToken(false);
          setCreatingToken(false);
          onTokenCreated?.();
        }} />}
      </div>
      <div className="grid grid-cols-1 gap-4 @min-[28rem]/overlay:grid-cols-2">
        <div>
          <label
            htmlFor="overlay-builder-printer"
            className="block text-sm font-medium text-white mb-1"
          >
            {t('streamOverlay.builder.printer', 'Printer')}
          </label>
          <select
            id="overlay-builder-printer"
            value={printerId ?? ''}
            onChange={(e) => setPrinterId(Number(e.target.value))}
            className="w-full px-3 py-2 bg-bambu-dark rounded-md text-white border border-bambu-dark-tertiary focus:border-bambu-green focus:outline-none"
          >
            {printers.length === 0 && <option value="">{t('common.loading', 'Loading…')}</option>}
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="overlay-builder-size" className="block text-sm font-medium text-white mb-1">
            {t('streamOverlay.builder.size', 'Text size')}
          </label>
          <select
            id="overlay-builder-size"
            value={size}
            onChange={(e) => setSize(e.target.value as OverlaySize)}
            className="w-full px-3 py-2 bg-bambu-dark rounded-md text-white border border-bambu-dark-tertiary focus:border-bambu-green focus:outline-none"
          >
            <option value="small">{t('streamOverlay.builder.sizeSmall', 'Small')}</option>
            <option value="medium">{t('streamOverlay.builder.sizeMedium', 'Medium')}</option>
            <option value="large">{t('streamOverlay.builder.sizeLarge', 'Large')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="overlay-builder-layout" className="block text-sm font-medium text-white mb-1">
            {t('streamOverlay.builder.layout')}
          </label>
          <select id="overlay-builder-layout" value={layout}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'landscape' || value === 'portrait' || value === 'both') setLayout(value);
            }}
            className="w-full px-3 py-2 bg-bambu-dark rounded-md text-white border border-bambu-dark-tertiary focus:border-bambu-green focus:outline-none">
            <option value="landscape">{t('streamOverlay.builder.landscape')}</option>
            <option value="portrait">{t('streamOverlay.builder.portrait')}</option>
            <option value="both">{t('streamOverlay.builder.both')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="overlay-builder-artwork" className="block text-sm font-medium text-white mb-1">
            {t('streamOverlay.builder.artwork', 'Artwork')}
          </label>
          <select
            id="overlay-builder-artwork"
            value={artwork}
            onChange={(e) => setArtwork(e.target.value as '1' | '2')}
            className="w-full px-3 py-2 bg-bambu-dark rounded-md text-white border border-bambu-dark-tertiary focus:border-bambu-green focus:outline-none"
          >
            <option value="1">{t('streamOverlay.builder.artworkClassic', 'Classic')}</option>
            <option value="2">{t('streamOverlay.builder.artworkV2', 'Version 2')}</option>
          </select>
        </div>

        {artwork === '2' && (
          <div>
            <label htmlFor="overlay-builder-background-transparency" className="flex justify-between gap-2 text-sm font-medium text-white mb-1">
              <span>{t('streamOverlay.builder.backgroundTransparency')}</span>
              <span aria-hidden="true">{backgroundTransparency}%</span>
            </label>
            <input
              id="overlay-builder-background-transparency"
              type="range"
              min={0}
              max={100}
              step={1}
              value={backgroundTransparency}
              aria-valuetext={`${backgroundTransparency}%`}
              onChange={(event) => setBackgroundTransparency(Number(event.target.value))}
              className="w-full accent-bambu-green"
            />
            <p className="text-xs text-bambu-gray mt-1">{t('streamOverlay.builder.backgroundTransparencyHint')}</p>
          </div>
        )}

        <div>
          <label htmlFor="overlay-builder-fps" className="block text-sm font-medium text-white mb-1">
            {t('streamOverlay.builder.fps', 'Frame rate')}
          </label>
          <NumberInput
            id="overlay-builder-fps"
            min={1}
            max={30}
            value={fps}
            onChange={setFps}
            fallback={1}
            className="w-full px-3 py-2 bg-bambu-dark rounded-md text-white border border-bambu-dark-tertiary focus:border-bambu-green focus:outline-none"
          />
          <p className="text-xs text-bambu-gray mt-1">
            {t(
              'streamOverlay.builder.fpsHint',
              'A1 and P1 cameras top out around 5 fps whatever you ask for.',
            )}
          </p>
        </div>

        <div>
          <label htmlFor="overlay-builder-token" className="block text-sm font-medium text-white mb-1">
            {t('streamOverlay.builder.token', 'Streaming Overlay token (optional)')}
          </label>
          <select
            id="overlay-builder-token"
            value={selectedTokenId}
            disabled={!canManageTokens || tokensPending}
            onChange={(event) => {
              setPreview(false);
              setRevealToken(false);
              setSelectedTokenId(event.target.value);
            }}
            className="w-full min-w-0 px-3 py-2 bg-bambu-dark rounded-md text-white border border-bambu-dark-tertiary"
          >
            <option value="">{t('streamOverlay.builder.noToken')}</option>
            {overlayTokens.map((saved) => (
              <option key={saved.id} value={saved.id} disabled={!saved.can_reuse || isExpired(saved.expires_at)}>
                {saved.name}{isExpired(saved.expires_at) ? ` (${t('cameraTokens.list.expired')})` : !saved.can_reuse ? ` (${t('streamOverlay.builder.legacyToken')})` : ''}
              </option>
            ))}
          </select>
          {(tokensError || secretError) && <p role="alert" className="mt-2 text-sm text-red-400">{t('streamOverlay.builder.tokenLoadError')}</p>}
          {(tokensError || secretError) && <button type="button" onClick={() => {
            if (tokensError) void refetch();
            if (secretError) setSecretRequestRevision((revision) => revision + 1);
          }} className="text-sm text-bambu-gray">{t('common.retry')}</button>}
          {selectedTokenExpired && <p role="alert" className="mt-2 text-sm text-red-400">{t('streamOverlay.builder.tokenExpired')}</p>}
          {tokenUnavailable && !selectedTokenExpired && !secretError && selectedToken?.can_reuse && <p role="status" className="mt-2 text-sm text-bambu-gray">{t('common.loading')}</p>}
          <button type="button" disabled={!token} onClick={() => setRevealToken((current) => !current)} className="mt-2 text-sm text-bambu-gray disabled:opacity-50">
            {t(revealToken ? 'streamOverlay.builder.hideToken' : 'streamOverlay.builder.showToken')}
          </button>
          <p className="text-xs text-bambu-gray mt-1">
            {t(
              'streamOverlay.builder.savedHint',
              'Only needed when login is enabled: OBS has no session of its own. Create one above with the Streaming Overlay scope.',
            )}
          </p>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-white mb-2">
          {t('streamOverlay.builder.fields', 'Fields to show')}
        </legend>
        <div className="grid grid-cols-1 gap-2 @min-[24rem]/overlay:grid-cols-2 @min-[36rem]/overlay:grid-cols-3">
          {FIELDS.map((field) => (
            <label key={field.key} className="flex items-center gap-2 text-sm text-bambu-gray">
              <input
                type="checkbox"
                checked={fields.includes(field.key)}
                onChange={() => toggleField(field.key)}
                className="accent-bambu-green"
              />
              {t(field.labelKey, field.fallback)}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-bambu-gray">
            <input
              type="checkbox"
              checked={showCamera}
              onChange={(e) => setShowCamera(e.target.checked)}
              className="accent-bambu-green"
            />
            {t('streamOverlay.builder.fieldCamera', 'Camera feed')}
          </label>
        </div>
        <p className="text-xs text-bambu-gray mt-2">
          {t(
            'streamOverlay.builder.chamberHint',
            'Chamber temperature only appears on models with a real chamber sensor — P1 and A1 printers report a meaningless value, so it is left out there.',
          )}
        </p>
      </fieldset>

      <OverlayBrandingControls value={branding} onChange={setBranding} />

      <div className="mt-4">
        {outputs.map(({ layout: orientation, url }) => (
          <fieldset key={orientation} className="min-w-0 mb-3">
            <legend className="text-sm font-medium text-white mb-1">
              {t('streamOverlay.builder.orientationUrl', { orientation: t(`streamOverlay.builder.${orientation}`) })}
            </legend>
            <p className="text-xs text-bambu-gray mb-2">
              {t('streamOverlay.builder.sourceDimensions', OVERLAY_DIMENSIONS[orientation])}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="w-full px-3 py-2 bg-bambu-dark rounded-md text-bambu-green text-xs break-all font-mono select-all">
                {displayedUrl(url)}
              </code>
              <button type="button" onClick={() => void copyUrl(url)}
                className="flex items-center gap-2 px-3 py-2 bg-bambu-green text-white rounded-md hover:bg-bambu-green/90">
                <Copy className="w-4 h-4" />
                {t('cameraTokens.created.copy', 'Copy')}
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-bambu-dark-tertiary text-white rounded-md hover:bg-bambu-dark-tertiary/80">
                <ExternalLink className="w-4 h-4" />
                {t('streamOverlay.builder.open', 'Open')}
              </a>
            </div>
          </fieldset>
        ))}
        {token.trim() && (
          <p className="text-xs text-bambu-gray mt-2">
            {t(
              'streamOverlay.builder.tokenWarning',
              'This URL contains a token — anyone who can read it can watch the stream and see the file name. Revoke the token to cut it off.',
            )}
          </p>
        )}
      </div>

      {/* The preview opens a real camera stream, so it stays off until asked
          for. Leaving one running behind a settings tab would hold a subscriber
          on the printer's single camera connection for as long as the tab is
          open. */}
      <div className="mt-4">
        <button
          type="button"
          disabled={tokenUnavailable}
          onClick={() => setPreview((p) => !p)}
          className="flex items-center gap-2 px-3 py-2 bg-bambu-dark-tertiary text-white rounded-md hover:bg-bambu-dark-tertiary/80 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {preview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {preview
            ? t('streamOverlay.builder.hidePreview', 'Hide preview')
            : t('streamOverlay.builder.showPreview', 'Show preview')}
        </button>
        {preview && (
          <div className="mt-3 flex flex-wrap items-start gap-4">
            {outputs.map(({ layout: orientation, url }) => (
              <div key={orientation} className="min-w-0 flex-1 basis-64"
                style={orientation === 'portrait' ? { maxWidth: 360 } : undefined}>
                <p className="text-sm text-white mb-2">{t(`streamOverlay.builder.${orientation}`)}</p>
                <div className="overflow-hidden rounded-md border border-bambu-dark-tertiary">
                  <OverlayFrame layout={orientation} preview>
                    <OverlayPreview url={url} logoRevision={branding.logoRevision}
                      title={t('streamOverlay.builder.orientationPreview', { orientation: t(`streamOverlay.builder.${orientation}`) })} />
                  </OverlayFrame>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OverlayPreview({ url, logoRevision, title }: { url: string; logoRevision: number; title: string }) {
  const [source, setSource] = useState({ url, logoRevision });

  useEffect(() => {
    // Colour and transparency controls emit continuously while dragging.
    // Wait for them to settle before opening another camera stream.
    const timeout = window.setTimeout(() => setSource({ url, logoRevision }), 300);
    return () => window.clearTimeout(timeout);
  }, [url, logoRevision]);

  return <iframe
    key={`${source.url}:${source.logoRevision}`}
    src={source.url}
    title={title}
    className="w-full h-full border-0"
  />;
}
