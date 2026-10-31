/**
 * Sako Composer Analytics Tracking (Jan 2026)
 * 
 * Lightweight tracking script for claim-level analytics.
 * Add to your pages to track impressions, clicks, and conversions.
 * 
 * Usage:
 * <script src="https://app.sako.ai/tracking.js" data-workspace="YOUR_WORKSPACE_ID"></script>
 */

(function() {
  'use strict';

  // Configuration
  var ENDPOINT = '/api/analytics/track';
  var BATCH_INTERVAL = 5000; // 5 seconds
  var MAX_BATCH_SIZE = 50;

  // State
  var workspaceId = null;
  var eventQueue = [];
  var observer = null;
  var sessionId = generateSessionId();

  // Initialize
  function init() {
    // Get workspace ID from script tag
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf('tracking.js') !== -1) {
        workspaceId = scripts[i].getAttribute('data-workspace');
        break;
      }
    }

    if (!workspaceId) {
      console.warn('[Sako] No workspace ID found. Add data-workspace attribute to script tag.');
      return;
    }

    // Set up event listeners
    setupClickTracking();
    setupVisibilityTracking();
    setupConversionTracking();

    // Start batch sender
    setInterval(sendBatch, BATCH_INTERVAL);

    // Send remaining events on page unload
    window.addEventListener('beforeunload', function() {
      sendBatch(true);
    });

    console.log('[Sako] Tracking initialized for workspace:', workspaceId);
  }

  // Generate session ID
  function generateSessionId() {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  // Queue an event
  function queueEvent(eventType, data) {
    eventQueue.push({
      eventType: eventType,
      workspaceId: workspaceId,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
      ...data
    });

    // Send immediately if queue is full
    if (eventQueue.length >= MAX_BATCH_SIZE) {
      sendBatch();
    }
  }

  // Send batch of events
  function sendBatch(sync) {
    if (eventQueue.length === 0) return;

    var events = eventQueue.splice(0, MAX_BATCH_SIZE);
    var payload = JSON.stringify({ events: events });

    if (sync && navigator.sendBeacon) {
      // Use sendBeacon for unload events
      navigator.sendBeacon(ENDPOINT, payload);
    } else {
      // Use fetch for normal events
      fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
        keepalive: true
      }).catch(function(err) {
        console.warn('[Sako] Failed to send events:', err);
        // Re-queue failed events
        eventQueue = events.concat(eventQueue);
      });
    }
  }

  // Track clicks on elements with data-sako attributes
  function setupClickTracking() {
    document.addEventListener('click', function(e) {
      var target = e.target;
      
      // Walk up the DOM to find tracked elements
      while (target && target !== document) {
        var claimId = target.getAttribute('data-sako-claim');
        var assetId = target.getAttribute('data-sako-asset');
        var campaignId = target.getAttribute('data-sako-campaign');
        var action = target.getAttribute('data-sako-action');

        if (claimId || assetId || campaignId) {
          queueEvent('click', {
            claimId: claimId,
            assetId: assetId,
            campaignId: campaignId,
            action: action || 'click',
            elementTag: target.tagName,
            elementText: target.textContent ? target.textContent.substring(0, 100) : null
          });
          break;
        }

        target = target.parentElement;
      }
    }, true);
  }

  // Track visibility of claim elements
  function setupVisibilityTracking() {
    if (!('IntersectionObserver' in window)) {
      console.warn('[Sako] IntersectionObserver not supported. Visibility tracking disabled.');
      return;
    }

    var viewedElements = new Set();

    observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          var el = entry.target;
          var elementId = el.getAttribute('data-sako-claim') || 
                          el.getAttribute('data-sako-asset') ||
                          el.getAttribute('data-sako-id');

          // Only track first view
          if (elementId && !viewedElements.has(elementId)) {
            viewedElements.add(elementId);

            queueEvent('impression', {
              claimId: el.getAttribute('data-sako-claim'),
              assetId: el.getAttribute('data-sako-asset'),
              campaignId: el.getAttribute('data-sako-campaign'),
              elementId: elementId,
              viewportPosition: {
                top: entry.boundingClientRect.top,
                left: entry.boundingClientRect.left
              }
        });
      }
    }
      });
    }, {
      threshold: 0.5
    });

    // Observe all tracked elements
    function observeElements() {
      var elements = document.querySelectorAll('[data-sako-claim], [data-sako-asset], [data-sako-track]');
      elements.forEach(function(el) {
        observer.observe(el);
      });
    }

    // Initial observation
    if (document.readyState === 'complete') {
      observeElements();
    } else {
      window.addEventListener('load', observeElements);
    }

    // Re-observe on DOM changes
    var mutationObserver = new MutationObserver(function() {
      observeElements();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Track conversions
  function setupConversionTracking() {
    // Track form submissions
    document.addEventListener('submit', function(e) {
      var form = e.target;
      var campaignId = form.getAttribute('data-sako-campaign');
      var conversionType = form.getAttribute('data-sako-conversion');

      if (campaignId || conversionType) {
        queueEvent('conversion', {
          campaignId: campaignId,
          conversionType: conversionType || 'form_submit',
          formId: form.id || null,
          formAction: form.action || null
        });
      }
    }, true);

    // Expose global conversion tracking function
    window.sakoTrackConversion = function(data) {
      queueEvent('conversion', {
        campaignId: data.campaignId,
        claimId: data.claimId,
        assetId: data.assetId,
        conversionType: data.type || 'custom',
        value: data.value,
        metadata: data.metadata
      });
    };
  }

  // Expose API
  window.SakoAnalytics = {
    track: function(eventType, data) {
      queueEvent(eventType, data);
    },
    trackConversion: function(data) {
      window.sakoTrackConversion(data);
    },
    trackClaimView: function(claimId, campaignId) {
      queueEvent('claim_view', {
        claimId: claimId,
        campaignId: campaignId
      });
    },
    flush: function() {
      sendBatch();
    },
    getSessionId: function() {
      return sessionId;
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
