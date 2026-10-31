import React from 'react';

export type IconName =
  | 'sun'
  | 'sparkles'
  | 'user'
  | 'calendar'
  | 'chevron-right'
  | 'search'
  | 'filter'
  | 'more-vertical'
  | 'more-horizontal'
  | 'message-circle'
  | 'upload'
  | 'download'
  | 'lock'
  | 'alert'
  | 'paperclip'
  | 'play'
  | 'pause'
  | 'tag'
  | 'external-link'
  | 'check'
  | 'info'
  | 'video'
  | 'image'
  | 'layout'
  | 'loader'
  | 'figma'
  | 'arrow-up-down'
  | 'x'
  | 'minus'
  | 'file'
  | 'trash'
  | 'save'
  | 'trending-up'
  | 'refresh-cw';

interface IconProps {
  name: IconName;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, className = 'h-4 w-4' }) => {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#icon-${name}`} />
    </svg>
  );
};

export const IconSymbols: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="hidden">
    <symbol id="icon-sun" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>
    </symbol>
    <symbol id="icon-sparkles" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M5 3l1.5 3L10 7.5 6.5 9 5 12 3.5 9 0 7.5 3.5 6 5 3z" transform="translate(3 3) scale(0.8)"></path>
      <path d="M16 4l.8 1.6L18 7l-1.2 1.4L16 10l-.8-1.6L14 7l1.2-1.4L16 4z"></path>
      <path d="M18 14l.6 1.2L20 16l-1.4.8L18 18l-.6-1.2L16 16l1.4-.8L18 14z"></path>
    </symbol>
    <symbol id="icon-user" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"></path>
      <path d="M4 20a8 8 0 0 1 16 0"></path>
    </symbol>
    <symbol id="icon-calendar" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2"></rect>
      <path d="M8 2v4M16 2v4M3 10h18"></path>
    </symbol>
    <symbol id="icon-chevron-right" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M9 6l6 6-6 6"></path>
    </symbol>
    <symbol id="icon-search" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <circle cx="11" cy="11" r="6"></circle>
      <path d="m16 16 4 4"></path>
    </symbol>
    <symbol id="icon-filter" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M4 4h16l-6 7v5l-4 2v-7z"></path>
    </symbol>
    <symbol id="icon-more-vertical" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <circle cx="12" cy="5" r="1.5"></circle>
      <circle cx="12" cy="12" r="1.5"></circle>
      <circle cx="12" cy="19" r="1.5"></circle>
    </symbol>
    <symbol id="icon-more-horizontal" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <circle cx="5" cy="12" r="1.5"></circle>
      <circle cx="12" cy="12" r="1.5"></circle>
      <circle cx="19" cy="12" r="1.5"></circle>
    </symbol>
    <symbol id="icon-message-circle" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </symbol>
    <symbol id="icon-upload" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path>
      <path d="M12 3v12"></path>
      <path d="m7 8 5-5 5 5"></path>
    </symbol>
    <symbol id="icon-download" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path>
      <path d="M12 3v12"></path>
      <path d="m7 10 5 5 5-5"></path>
    </symbol>
    <symbol id="icon-file" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </symbol>
    <symbol id="icon-trash" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </symbol>
    <symbol id="icon-lock" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <rect x="5" y="11" width="14" height="10" rx="2"></rect>
      <path d="M8 11V8a4 4 0 0 1 8 0v3"></path>
    </symbol>
    <symbol id="icon-alert" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </symbol>
    <symbol id="icon-paperclip" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M21.44 11.05 12 20.5a6 6 0 0 1-8.49-8.48l9.19-9.2a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83L15 7.41"></path>
    </symbol>
    <symbol id="icon-play" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </symbol>
    <symbol id="icon-pause" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <rect x="6" y="4" width="4" height="16" rx="1"></rect>
      <rect x="14" y="4" width="4" height="16" rx="1"></rect>
    </symbol>
    <symbol id="icon-tag" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a2 2 0 0 0-2 2v5.59A2 2 0 0 0 2.59 11L12.17 20.6a2 2 0 0 0 2.83 0l5.59-5.59a2 2 0 0 0 0-2.83Z"></path>
      <circle cx="7.5" cy="7.5" r="1.5"></circle>
    </symbol>
    <symbol id="icon-external-link" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </symbol>
    <symbol id="icon-check" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <polyline points="20 6 9 17 4 12"></polyline>
    </symbol>
    <symbol id="icon-info" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </symbol>
    <symbol id="icon-video" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <rect x="3" y="5" width="15" height="14" rx="2"></rect>
      <polygon points="16 12 10 16 10 8 16 12"></polygon>
    </symbol>
    <symbol id="icon-image" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <path d="M21 15l-3.5-3.5a2 2 0 0 0-2.83 0L9 18"></path>
    </symbol>
    <symbol id="icon-layout" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
      <path d="M3 9h18M9 21V9"></path>
    </symbol>
    <symbol id="icon-loader" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <line x1="12" y1="2" x2="12" y2="6"></line>
      <line x1="12" y1="18" x2="12" y2="22"></line>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
      <line x1="2" y1="12" x2="6" y2="12"></line>
      <line x1="18" y1="12" x2="22" y2="12"></line>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
    </symbol>
    <symbol id="icon-figma" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M10 3.5A3.5 3.5 0 1 1 13.5 7 3.5 3.5 0 0 1 10 3.5Z"></path>
      <path d="M6.5 7A3.5 3.5 0 1 1 10 10.5 3.5 3.5 0 0 1 6.5 7Z"></path>
      <path d="M13.5 7A3.5 3.5 0 1 1 17 10.5 3.5 3.5 0 0 1 13.5 7Z"></path>
      <path d="M10 10.5A3.5 3.5 0 1 1 6.5 14 3.5 3.5 0 0 1 10 10.5Z"></path>
      <path d="M10 17.5A3.5 3.5 0 1 0 13.5 14H10Z"></path>
    </symbol>
    <symbol id="icon-arrow-up-down" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="m21 16-4 4-4-4"></path>
      <path d="M17 20V4"></path>
      <path d="m3 8 4-4 4 4"></path>
      <path d="M7 4v16"></path>
    </symbol>
    <symbol id="icon-x" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M18 6L6 18"></path>
      <path d="M6 6l12 12"></path>
    </symbol>
    <symbol id="icon-minus" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M5 12h14"></path>
    </symbol>
    <symbol id="icon-save" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </symbol>
    <symbol id="icon-trending-up" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </symbol>
    <symbol id="icon-refresh-cw" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </symbol>
  </svg>
);
