import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import {
  displayCoupleLine,
  displayDateLine,
  displayGuestLine,
  displayVenueLine,
  hasParsedLayout,
  type Guest,
  type InvitationContent,
  type LayoutSlot,
  type Template,
  type TemplateLayout,
} from '../types';
import { applyPhotoBox, isPlausiblePhotoSlot, withPhotoRegion } from '../layout';
import { detectPhotoBox } from '../utils/detectPhoto';

interface Props {
  template: Template;
  content: InvitationContent;
  guest: Guest;
}

function CornerFlourish({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" aria-hidden="true">
      <path
        d="M8 72C8 40 18 22 40 12c6-3 10-8 12-12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M16 72c4-22 16-34 36-40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="52" cy="28" r="2.2" fill="currentColor" />
    </svg>
  );
}

function slotText(slot: LayoutSlot, content: InvitationContent, guest: Guest, vertical = false): string {
  switch (slot) {
    case 'couple': {
      if (vertical) {
        const [left, right] = displayCoupleLine(content).split(' & ');
        return [left, right].filter(Boolean).join('\n');
      }
      return displayCoupleLine(content);
    }
    case 'date':
      return displayDateLine(content);
    case 'time':
      return content.time;
    case 'venue':
      return displayVenueLine(content);
    case 'guest':
      return displayGuestLine(content, guest);
    case 'host':
      return content.hostNames;
    case 'closing':
      return content.closing;
    default:
      return '';
  }
}

export function LayoutCard({
  template,
  content,
  guest,
  cardRef,
  width,
}: Props & { cardRef?: RefObject<HTMLElement | null>; width?: number }) {
  const rawLayout = template.layout as TemplateLayout;
  const ref = useRef<HTMLDivElement>(null);
  const [measuredW, setMeasuredW] = useState(width ?? 360);
  const [detectedLayout, setDetectedLayout] = useState<TemplateLayout | null>(null);

  useEffect(() => {
    if (width) {
      setMeasuredW(width);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const update = () => setMeasuredW(Math.max(200, el.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  useEffect(() => {
    if (!content.photoUrl || !template.backgroundUrl) {
      setDetectedLayout(null);
      return;
    }
    if (rawLayout.regions.some((r) => r.slot === 'photo' && isPlausiblePhotoSlot(r, rawLayout))) {
      setDetectedLayout(null);
      return;
    }
    const detectSrc = template.sampleUrl || template.backgroundUrl;
    let cancelled = false;
    void detectPhotoBox(detectSrc)
      .then((box) => {
        if (cancelled || !box) return;
        const mapped = {
          x: (box.x / box.imgW) * rawLayout.width,
          y: (box.y / box.imgH) * rawLayout.height,
          w: (box.w / box.imgW) * rawLayout.width,
          h: (box.h / box.imgH) * rawLayout.height,
        };
        setDetectedLayout(applyPhotoBox(rawLayout, mapped));
      })
      .catch(() => {
        if (!cancelled) setDetectedLayout(null);
      });
    return () => {
      cancelled = true;
    };
  }, [content.photoUrl, template.backgroundUrl, template.sampleUrl, rawLayout.width, rawLayout.height]);

  const layout = content.photoUrl ? (detectedLayout ?? withPhotoRegion(rawLayout)) : rawLayout;

  const w = width ?? measuredW;
  const h = (w * layout.height) / layout.width;
  const scale = w / layout.width;

  return (
    <div ref={ref} className="layout-card" style={{ width: w, height: h }}>
      <div
        ref={cardRef as RefObject<HTMLDivElement | null>}
        className="layout-card__stage"
        style={{ width: layout.width, height: layout.height, transform: `scale(${scale})` }}
      >
        <img className="inv__bg" src={template.backgroundUrl} alt="" />
        {layout.regions
          .filter((region) => region.slot === 'photo')
          .map((region) => (
            <div
              key={region.slot}
              className="layout-card__region layout-card__photo"
              style={{
                left: region.x,
                top: region.y,
                width: region.w,
                height: region.h,
              }}
            >
              {content.photoUrl ? <img src={content.photoUrl} alt="" /> : null}
            </div>
          ))}
        {layout.regions
          .filter((region) => region.slot !== 'photo')
          .map((region) => {
            const vertical = Boolean(region.vertical) || region.h > region.w * 1.25;
            const fontSize = vertical ? Math.min(region.fontSize, region.w * 0.86) : region.fontSize;
            return (
              <p
                key={region.slot}
                className={`layout-card__region${vertical ? ' is-vertical' : ''}`}
                style={{
                  left: region.x,
                  top: region.y,
                  width: region.w,
                  height: region.h,
                  fontSize,
                  fontWeight: region.fontWeight,
                  textAlign: region.align,
                  color: region.color ?? '#3a2418',
                }}
              >
                {slotText(region.slot, content, guest, vertical)}
              </p>
            );
          })}
      </div>
    </div>
  );
}

export function InvitationCard({ template, content, guest, cardRef }: Props & { cardRef?: RefObject<HTMLElement | null> }) {
  const [left, right] = [displayCoupleLine(content).split(' & ')[0], displayCoupleLine(content).split(' & ')[1]];
  const guestLine = displayGuestLine(content, guest);

  if (template.style === 'custom-image' && template.layout?.regions.length) {
    return <LayoutCard template={template} content={content} guest={guest} cardRef={cardRef} />;
  }

  if (template.style === 'custom-image' && template.backgroundUrl) {
    return (
      <article
        ref={cardRef}
        className={`inv inv--custom-image${content.photoUrl ? ' inv--has-photo' : ''}`}
      >
        <img className="inv__bg" src={template.backgroundUrl} alt="" />
        {content.photoUrl ? (
          <div className="inv__photo inv__photo--custom">
            <img src={content.photoUrl} alt="" />
          </div>
        ) : null}
        <p className="inv__custom-guest">{guestLine}</p>
      </article>
    );
  }

  const style: CSSProperties | undefined = template.backgroundUrl
    ? { ['--inv-bg' as string]: `url("${template.backgroundUrl}")` }
    : undefined;

  return (
    <article
      ref={cardRef}
      className={`inv inv--${template.style}${content.photoUrl ? ' inv--has-photo' : ''}`}
      style={style}
    >
      <div className="inv__frame">
        <CornerFlourish className="inv__corner inv__corner--tl" />
        <CornerFlourish className="inv__corner inv__corner--tr" />
        <CornerFlourish className="inv__corner inv__corner--bl" />
        <CornerFlourish className="inv__corner inv__corner--br" />

        <p className="inv__en">The Wedding Of</p>
        <p className="inv__kicker">{content.eventTitle}</p>

        <h1 className="inv__couple">
          <span>{left || '新郎'}</span>
          <i className="inv__amp">&</i>
          <span>{right || '新娘'}</span>
        </h1>

        {content.photoUrl ? (
          <div className="inv__photo">
            <img src={content.photoUrl} alt="" />
          </div>
        ) : null}

        <div className="inv__rule" />

        <p className="inv__guest">{guestLine}</p>
        <p className="inv__body">{content.bodyText}</p>

        <dl className="inv__meta">
          <div>
            <dt>日期</dt>
            <dd>
              {content.solarDate}
              {content.lunarDate ? <small>{content.lunarDate}</small> : null}
            </dd>
          </div>
          <div>
            <dt>时间</dt>
            <dd>{content.time}</dd>
          </div>
          <div>
            <dt>地点</dt>
            <dd>
              {content.venue}
              {content.address ? <small>{content.address}</small> : null}
            </dd>
          </div>
        </dl>

        <p className="inv__closing">{content.closing}</p>
        <p className="inv__host">{content.hostNames}</p>
      </div>
    </article>
  );
}

/** 按目标宽度等比缩放，用于手机预览 */
export function ScaledCard({
  width,
  template,
  content,
  guest,
  cardRef,
}: Props & { width: number; cardRef?: RefObject<HTMLElement | null> }) {
  if (hasParsedLayout(template)) {
    return (
      <LayoutCard
        width={width}
        template={template}
        content={content}
        guest={guest}
        cardRef={cardRef}
      />
    );
  }

  const scale = width / 420;
  return (
    <div className="scaled-card" style={{ width, height: 630 * scale }}>
      <div className="scaled-card__inner" style={{ transform: `scale(${scale})` }}>
        <InvitationCard template={template} content={content} guest={guest} cardRef={cardRef} />
      </div>
    </div>
  );
}

/** 宽度跟随手机屏幕，避免写死 window */
export function PreviewFrame({
  cardRef,
  maxHeight,
  ...props
}: Props & { cardRef?: RefObject<HTMLElement | null>; maxHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(280);
  const parsed = hasParsedLayout(props.template);
  const layout = props.template.layout;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const byWidth = Math.max(200, el.clientWidth);
      const ratio = parsed && layout ? layout.height / layout.width : 630 / 420;
      const byHeight = maxHeight ? maxHeight / ratio : byWidth;
      setWidth(Math.min(byWidth, byHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [maxHeight, parsed, layout]);

  return (
    <div ref={ref} className="preview-wrap">
      <ScaledCard width={width} cardRef={cardRef} {...props} />
    </div>
  );
}
