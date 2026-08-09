import { useEffect, useState } from 'react';
import type { GameEvent, WorldEventId, WorldEventState } from '../../core/types';
import { getZoneDef } from '../../data/zones';
import { getWorldEventVisual } from '../visualAssets';
import {
  eventScopeLabel,
  latestInstantWorldEvent,
  worldEventMeta,
  worldEventRemainingMeta,
} from '../worldEventPresentation';
import { VisualImage } from './VisualImage';

interface WorldEventBannerProps {
  event: WorldEventState;
}

export function WorldEventBanner({ event }: WorldEventBannerProps): JSX.Element {
  const meta = worldEventMeta(event.eventId);
  const remaining = worldEventRemainingMeta(event.remaining);
  const scope = eventScopeLabel(
    event.scope,
    event.zoneId ? getZoneDef(event.zoneId).name : undefined,
  );
  return (
    <article
      className={`event-banner event-banner-${meta.severity} event-banner-urgency-${remaining.urgency}`}
      data-event-id={event.eventId}
      data-event-severity={meta.severity}
      data-event-remaining={event.remaining}
      data-event-scope={scope}
    >
      <VisualImage
        visual={getWorldEventVisual(event.eventId)}
        alt={`${event.label}事件图标`}
        className="event-banner-icon"
      />
      <div className="event-banner-body">
        <div className="event-banner-title">
          <span className="event-severity-cue" aria-hidden="true">{meta.icon}</span>
          <span>{event.label}</span>
          <span className="event-severity-label">{meta.severityLabel}</span>
        </div>
        <div className="event-banner-meta">
          <span>{scope}</span>
          <span className={`event-remaining event-remaining-${remaining.urgency}`}>
            <span aria-hidden="true">{remaining.icon}</span> {remaining.label} · 剩余 {event.remaining} 回合
          </span>
        </div>
        <div className="event-banner-desc">{event.description}</div>
      </div>
    </article>
  );
}

interface InstantWorldEventAnnouncementProps {
  event: GameEvent | null;
}

/** 短时、非阻塞即时公告；历史日志仍由 EventLog 独立保留。 */
export function InstantWorldEventAnnouncement({
  event,
}: InstantWorldEventAnnouncementProps): JSX.Element | null {
  const [visibleEventId, setVisibleEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!event) {
      setVisibleEventId(null);
      return undefined;
    }
    setVisibleEventId(event.id);
    const timer = window.setTimeout(() => setVisibleEventId(null), 4500);
    return () => window.clearTimeout(timer);
  }, [event?.id]);

  if (!event || visibleEventId !== event.id) return null;
  const eventId = typeof event.metadata.worldEventId === 'string'
    ? event.metadata.worldEventId
    : 'emergency_broadcast';
  const normalizedEventId: WorldEventId = Object.prototype.hasOwnProperty.call(
    {
      blackout: true,
      rain: true,
      emergency_broadcast: true,
      medical_alert: true,
      research_anomaly: true,
      citywide_unrest: true,
    },
    eventId,
  ) ? eventId as WorldEventId : 'emergency_broadcast';
  const meta = worldEventMeta(normalizedEventId);
  const zoneId = typeof event.metadata.broadcastZoneId === 'string'
    ? event.metadata.broadcastZoneId
    : null;
  const scope = eventScopeLabel('global', zoneId ? getZoneDef(zoneId).name : undefined);

  return (
    <aside
      className={`world-event-announcement announcement-${meta.severity}`}
      data-world-event-announcement="true"
      data-event-id={normalizedEventId}
      role="status"
      aria-live="assertive"
    >
      <VisualImage
        visual={getWorldEventVisual(normalizedEventId)}
        alt={`${event.message}事件图标`}
        className="world-event-announcement-icon"
      />
      <div className="world-event-announcement-body">
        <div className="world-event-announcement-title">
          <span className="event-severity-cue" aria-hidden="true">{meta.icon}</span>
          <strong>即时公告 · {meta.severityLabel}</strong>
        </div>
        <div>{event.message}</div>
        <div className="world-event-announcement-meta">{scope} · 只读公开噪音播报</div>
      </div>
    </aside>
  );
}

export { latestInstantWorldEvent };
