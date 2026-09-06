import posthog from 'posthog-js';

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

if (typeof window !== 'undefined' && posthogKey) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    defaults: '2026-05-30',
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    mask_all_element_attributes: true,
    mask_all_text: true,
    sanitize_properties: (properties) => {
      // Privacy boundary: strip any accidental content or PII keys
      const forbiddenKeys = [
        'image',
        'imagebase64',
        'base64',
        'screenshot',
        'dataurl',
        'preview',
        'text',
        'transcript',
        'ocr',
        'situation_summary',
        'summary',
        'reply',
        'replies',
        'message',
        'messages',
        'prompt',
        'binary_question_text',
        'binary_replies',
        'email',
        'phone',
        'name',
      ];
      for (const key of Object.keys(properties)) {
        if (forbiddenKeys.includes(key.toLowerCase())) {
          delete properties[key];
        }
      }
      return properties;
    },
  });
}
