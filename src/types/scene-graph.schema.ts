/**
 * Viprosell — SceneGraph JSON Schema
 * Phase 1: Used for:
 *   1. Gemini API responseSchema (structured output)
 *   2. Runtime validation via scene-graph.validator.ts
 *
 * STRICT RULES encoded in this schema:
 * - animation names are CLOSED enum — prevents hallucination
 * - text lengths are capped per style
 * - scene count is bounded [3, 8]
 * - duration_frames per scene is bounded [30, 150]
 * - total duration bounded [10s–30s at 30fps = 300–900 frames]
 */

export const SCENE_GRAPH_SCHEMA = {
  type: 'object',
  required: ['schema_version', 'meta', 'scenes'],
  additionalProperties: false,
  properties: {
    schema_version: {
      type: 'string',
      enum: ['1.0'],
      description: 'Must always be "1.0" in Phase 1.',
    },

    meta: {
      type: 'object',
      required: ['title', 'package_type', 'aspect_ratio', 'total_frames', 'fps', 'brand_name', 'voiceover_mode', 'generated_at'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 80 },
        package_type: {
          type: 'string',
          enum: ['quick_ads', 'review_video', 'conversion_video'],
        },
        aspect_ratio: {
          type: 'string',
          enum: ['9:16', '1:1', '16:9'],
        },
        total_frames: { type: 'integer', minimum: 300, maximum: 900 },
        fps: { type: 'integer', enum: [30] },
        brand_name: { type: 'string', minLength: 1, maxLength: 50 },
        brand_color: {
          type: 'string',
          pattern: '^#[0-9A-Fa-f]{6}$',
          description: 'Hex color. Example: #FF4C61',
        },
        voiceover_mode: {
          type: 'string',
          enum: ['tts', 'none', 'placeholder'],
        },
        bg_music_id: { type: ['string', 'null'] },
        generated_at: { type: 'string' },
        generated_by_model: { type: 'string' },
      },
    },

    scenes: {
      type: 'array',
      minItems: 3,
      maxItems: 8,
      items: {
        type: 'object',
        required: ['id', 'start_frame', 'duration_frames', 'layout', 'animation', 'overlays'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', minLength: 1 },
          start_frame: { type: 'integer', minimum: 0 },
          duration_frames: {
            type: 'integer',
            minimum: 30,
            maximum: 150,
            description: 'At 30fps: min 1s, max 5s per scene.',
          },
          layout: {
            type: 'string',
            enum: [
              'image_full',
              'image_top_text_bottom',
              'text_only',
              'cta_card',
              'split_image_text',
            ],
          },
          animation: {
            type: 'string',
            enum: [
              'pan_left',
              'pan_right',
              'zoom_in',
              'zoom_out',
              'static',
              'fade_in',
              'wipe_left',
            ],
            description: 'CLOSED enum. Do not invent animation names.',
          },
          asset: {
            type: 'object',
            required: ['src', 'fit'],
            additionalProperties: false,
            properties: {
              src: { type: 'string', minLength: 1 },
              fit: { type: 'string', enum: ['cover', 'contain', 'fill'] },
              focal_x: { type: 'number', minimum: 0, maximum: 1 },
              focal_y: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
          overlays: {
            type: 'array',
            maxItems: 3,
            items: {
              type: 'object',
              required: ['text', 'style', 'position_y'],
              additionalProperties: false,
              properties: {
                text: { type: 'string', minLength: 1, maxLength: 80 },
                style: {
                  type: 'string',
                  enum: ['headline', 'body', 'badge', 'cta', 'caption'],
                },
                position_y: { type: 'number', minimum: 0, maximum: 1 },
                align: { type: 'string', enum: ['left', 'center', 'right'] },
                entrance: { type: 'string', enum: ['slide_up', 'fade_in', 'none'] },
                delay_frames: { type: 'integer', minimum: 0, maximum: 30 },
              },
            },
          },
          voiceover_text: { type: 'string', maxLength: 200 },
          bg_color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
        },
      },
    },
  },
} as const;

/**
 * Per-style character limits — mirrors TEXT_LIMITS in scene-graph.ts
 */
export const TEXT_MAX_LENGTHS: Record<string, number> = {
  headline: 40,
  body: 80,
  badge: 20,
  cta: 25,
  caption: 30,
};

/**
 * Gemini-compatible responseSchema (SEPARATE from the strict JSON Schema above)
 *
 * Gemini API restrictions:
 * - No additionalProperties
 * - No integer enum (enum values must be strings)
 * - No pattern, minLength, maxLength
 * - enum must be array of strings only
 *
 * This schema is intentionally LOOSER. The strict scene-graph.validator.ts
 * enforces all hard rules AFTER Gemini returns JSON.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    schema_version: { type: 'string' },
    meta: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        package_type: { type: 'string', enum: ['quick_ads', 'review_video', 'conversion_video'] },
        aspect_ratio: { type: 'string', enum: ['9:16', '1:1', '16:9'] },
        total_frames: { type: 'integer' },
        fps: { type: 'integer' },
        brand_name: { type: 'string' },
        brand_color: { type: 'string' },
        voiceover_mode: { type: 'string', enum: ['tts', 'none', 'placeholder'] },
        bg_music_id: { type: 'string' },
        generated_at: { type: 'string' },
        generated_by_model: { type: 'string' },
      },
      required: ['title', 'package_type', 'aspect_ratio', 'total_frames', 'fps', 'brand_name', 'voiceover_mode'],
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          start_frame: { type: 'integer' },
          duration_frames: { type: 'integer' },
          layout: {
            type: 'string',
            enum: ['image_full', 'image_top_text_bottom', 'text_only', 'cta_card', 'split_image_text'],
          },
          animation: {
            type: 'string',
            enum: ['pan_left', 'pan_right', 'zoom_in', 'zoom_out', 'static', 'fade_in', 'wipe_left'],
          },
          asset: {
            type: 'object',
            properties: {
              src: { type: 'string' },
              fit: { type: 'string', enum: ['cover', 'contain', 'fill'] },
              focal_x: { type: 'number' },
              focal_y: { type: 'number' },
            },
            required: ['src', 'fit'],
          },
          overlays: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                style: { type: 'string', enum: ['headline', 'body', 'badge', 'cta', 'caption'] },
                position_y: { type: 'number' },
                align: { type: 'string', enum: ['left', 'center', 'right'] },
                entrance: { type: 'string', enum: ['slide_up', 'fade_in', 'none'] },
                delay_frames: { type: 'integer' },
              },
              required: ['text', 'style', 'position_y'],
            },
          },
          voiceover_text: { type: 'string' },
          bg_color: { type: 'string' },
        },
        required: ['id', 'start_frame', 'duration_frames', 'layout', 'animation', 'overlays'],
      },
    },
  },
  required: ['schema_version', 'meta', 'scenes'],
} as const;
