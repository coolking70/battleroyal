# Phase 4 Provider Spec — Agnes Image 2.1 Flash

## Boundary

The provider adapter is Node-only. Browser code receives only published local assets and never receives `IMAGE_API_KEY`.

- Endpoint: `https://apihub.agnes-ai.com/v1/images/generations`
- Model: `agnes-image-2.1-flash`
- Authentication: `Authorization: Bearer <IMAGE_API_KEY>`
- Transport: `POST`, JSON, request timeout, structured error classification

## Request contract

The adapter sends only the provider-compatible body:

```json
{
  "model": "agnes-image-2.1-flash",
  "prompt": "...",
  "size": "1K",
  "ratio": "3:4",
  "return_base64": true
}
```

Agnes does not receive `width`, `height`, `n`, `response_format`, or a top-level `negative_prompt`. The internal negative prompt is retained in the prompt hash and appended as `Avoid: ...`. Requested dimensions remain task metadata; actual dimensions are read from returned image bytes and validated independently.

Supported ratio mappings are `3:4`, `16:9`, and `1:1`; other task ratios remain explicit as `width:height` and are rejected or reviewed by the normal validator if the provider output does not match.

## Response and failure contract

The adapter accepts base64 fields `b64_json`, `base64`, and `image`, plus URL responses. It records MIME type, byte length, provider request id, and revised prompt when present. HTTP 401/403 are non-retryable authentication failures; 429 and transient 5xx/network/download failures are retryable within the configured limit. Error messages are truncated and never include the bearer key.

`art:api-check` is configuration-only and performs no network call. `art:smoke` is the explicit real-provider command for one Scout task. A provider attempt must be preserved in its own report and must not overwrite the dry-run report.
