# Send to Sako - Implementation Summary

**Status:** ✅ COMPLETE  
**Date:** 2026-01-20  
**Author:** Claude Code  

---

## Overview

This implementation delivers a complete, production-ready "Send to Sako" workflow that connects the Composer AI generation with the Sako human design team. The feature is now **fully functional** with idempotency, permission checking, multi-tenant isolation, and a feedback loop for continuous learning.

---

## Files Created/Modified

### Database Migrations
| File | Description |
|------|-------------|
| `supabase/migrations/067_send_to_sako_complete.sql` | Complete schema including `escalations`, `composer_snapshots`, `composer_feedback_events` tables and helper functions |

### API Routes
| File | Description |
|------|-------------|
| `app/api/sako/escalate/route.ts` | **Rewritten** - Full idempotency, permission checking, snapshot creation |
| `app/api/sako/status/route.ts` | **Rewritten** - Multi-tenant isolation, proper auth |
| `app/api/sako/snapshots/[id]/route.ts` | **NEW** - Secure snapshot retrieval with CSP headers |
| `app/api/sako/webhook/route.ts` | **Updated** - Signature verification (no changes needed) |
| `app/api/sako/tasks/route.ts` | **Updated** - Workspace isolation |
| `app/api/sako/tasks/[id]/route.ts` | **Updated** - Workspace isolation |

### Backend Services
| File | Description |
|------|-------------|
| `lib/sako/task-manager.ts` | **Rewritten** - Proper error handling, feedback events, status mapping |
| `lib/sako/webhook-handler.ts` | **Rewritten** - Status mapping, correct column names, observability |
| `lib/sako/client.ts` | **Updated** - Re-exports (no breaking changes) |

### Frontend Components
| File | Description |
|------|-------------|
| `components/sako/send-to-sako-dialog.tsx` | **Rewritten** - Error states, idempotency support, live status polling |

### Tests
| File | Description |
|------|-------------|
| `__tests__/sako/send-to-sako.test.ts` | **NEW** - Comprehensive test suite |

### Documentation
| File | Description |
|------|-------------|
| `docs/send-to-sako-diagnosis.md` | **NEW** - Pre-implementation diagnosis |
| `docs/SEND_TO_SAKO_IMPLEMENTATION.md` | **NEW** - This file |

---

## Key Features Implemented

### 1. Idempotency ✅
- **Client-generated keys** in format: `{workspaceId}:{campaignId}:v{version}:{timestamp}`
- **Duplicate detection** before any side effects
- **Safe retries** - clicking "Send" twice returns the same task ID
- **Database unique constraint** on `(workspace_id, campaign_id, idempotency_key)`

### 2. Permission Checking ✅
- **Plan validation** - Only Max ($199) and Enterprise ($2500) plans can escalate
- **Subscription status** - Requires active subscription
- **Clear error messages** - Users see upgrade prompt if not eligible

### 3. Multi-Tenant Isolation ✅
- **Workspace-scoped queries** - All data filtered by `workspace_id`
- **Auth middleware** - Extracts workspace from request headers
- **404 for unauthorized** - Returns "not found" instead of "forbidden" to prevent data leakage

### 4. Composer Snapshots ✅
- **Frozen HTML output** stored at send-time
- **JSON structure** preserved for programmatic access
- **Version tracking** with auto-incrementing numbers
- **Secure iframe rendering** with CSP headers

### 5. Feedback Loop ✅
- **Event recording** for every lifecycle change
- **Cycle time calculation** - Time from creation to completion
- **Revision counting** - Track how many rounds of feedback
- **Quality scores** - Capture acceptance/rejection outcomes

### 6. Observability ✅
- **Structured logging** with JSON format
- **Metrics** - Duration tracking for all operations
- **Event types:**
  - `sako.escalation.attempt`
  - `sako.escalation.success`
  - `sako.escalation.failure`
  - `sako.escalation.duplicate`
  - `sako.task.create_start`
  - `sako.task.create_success`
  - `sako.task.create_error`
  - `sako.webhook.received`
  - `sako.webhook.status_updated`

---

## API Contract

### POST /api/sako/escalate

**Request:**
```json
{
  "campaignId": "uuid",
  "reason": "string (required)",
  "priority": "normal | rush | urgent",
  "taskType": "design_refinement | full_redesign | copywriting | brand_refresh",
  "additionalNotes": "string (optional)",
  "idempotencyKey": "string (optional - auto-generated if not provided)",
  "versionLabel": "string (optional - e.g., 'v1.2')"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "escalationId": "uuid",
  "taskId": "uuid",
  "snapshotId": "uuid",
  "estimatedDelivery": "2026-01-25T12:00:00Z",
  "status": "pending",
  "isDuplicate": false
}
```

**Duplicate Response (200):**
```json
{
  "success": true,
  "isDuplicate": true,
  "escalationId": "uuid",
  "taskId": "uuid",
  "message": "Escalation already exists for this request"
}
```

**Permission Denied (403):**
```json
{
  "success": false,
  "message": "Sako escalation requires Max plan or higher"
}
```

### GET /api/sako/status?taskId=xxx

**Success Response (200):**
```json
{
  "task": {
    "id": "uuid",
    "status": "pending | assigned | in_progress | review | completed | cancelled",
    "priority": "string",
    "title": "string",
    "assignedTo": "string (optional)",
    "estimatedDelivery": "ISO date",
    "deliverables": [...],
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

### GET /api/sako/snapshots/[id]

**Query Parameters:**
- `includeContent=true` - Include full HTML/JSON content

**Success Response (200):**
```json
{
  "id": "uuid",
  "campaignId": "uuid",
  "versionNumber": 1,
  "versionLabel": "v1",
  "assetType": "landing | deck | social | email | other",
  "htmlContent": "... (if includeContent=true)",
  "jsonContent": {...},
  "createdAt": "ISO date"
}
```

### GET /api/sako/snapshots/[id]/render

**Response:** HTML content with security headers for iframe embedding

**Security Headers:**
```
Content-Security-Policy: default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; ...
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
```

---

## Webhook Contract

### POST /api/sako/webhook

**Headers:**
```
X-Sako-Signature: sha256=<hmac>
X-Sako-Timestamp: <unix_timestamp>
Content-Type: application/json
```

**Payload:**
```json
{
  "event": "task.status_changed | task.assigned | task.deliverable_added | task.comment_added",
  "taskId": "external-task-id",
  "externalId": "local-task-uuid",
  "timestamp": "ISO date",
  "data": {
    "status": "QUEUED | PENDING | ASSIGNED | IN_PROGRESS | IN_REVIEW | COMPLETED | CANCELLED",
    "previousStatus": "...",
    "assignedTo": { "id": "...", "name": "...", "email": "..." },
    "deliverable": { "id": "...", "name": "...", "type": "...", "url": "..." }
  }
}
```

**Status Mapping:**
| External Status | Internal Status |
|-----------------|-----------------|
| QUEUED, PENDING | pending |
| ASSIGNED | assigned |
| IN_PROGRESS | in_progress |
| IN_REVIEW, REVIEW, CHANGES_REQUESTED | review |
| APPROVED, COMPLETED | completed |
| CANCELLED, CANCELED | cancelled |

---

## Database Schema

### escalations
```sql
id UUID PRIMARY KEY
workspace_id UUID -> workspaces
campaign_id UUID -> campaigns
sako_task_id UUID -> sako_tasks
idempotency_key TEXT NOT NULL
reason TEXT NOT NULL
priority TEXT CHECK (low, normal, high, urgent)
status TEXT CHECK (pending, processing, completed, failed)
error_message TEXT
retry_count INTEGER
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
completed_at TIMESTAMPTZ
UNIQUE(workspace_id, campaign_id, idempotency_key)
```

### composer_snapshots
```sql
id UUID PRIMARY KEY
workspace_id UUID -> workspaces
campaign_id UUID -> campaigns
version_number INTEGER
version_label TEXT
html_content TEXT
json_content JSONB
preview_url TEXT
asset_type TEXT CHECK (landing, deck, social, email, other)
metadata JSONB
storage_provider TEXT
created_at TIMESTAMPTZ
created_by UUID -> auth.users
UNIQUE(workspace_id, campaign_id, version_number)
```

### composer_feedback_events
```sql
id UUID PRIMARY KEY
workspace_id UUID -> workspaces
campaign_id UUID -> campaigns
sako_task_id UUID -> sako_tasks
escalation_id UUID -> escalations
snapshot_id UUID -> composer_snapshots
event_type TEXT CHECK (task_created, task_assigned, ...)
outcome TEXT CHECK (accepted, rejected, revised, cancelled)
quality_score INTEGER (1-5)
revision_count INTEGER
cycle_time_seconds INTEGER
time_to_first_delivery INTEGER
time_to_acceptance INTEGER
notes TEXT
metadata JSONB
created_at TIMESTAMPTZ
```

---

## Testing

### Run Tests
```bash
# All Sako tests
npm test __tests__/sako/send-to-sako.test.ts

# With coverage
npm test -- --coverage __tests__/sako/send-to-sako.test.ts
```

### Test Coverage
- ✅ Idempotency (no duplicates)
- ✅ Permission checking (plan validation)
- ✅ Multi-tenant isolation
- ✅ Task lifecycle (create → status changes → complete)
- ✅ Webhook handling (signature verification, status mapping)
- ✅ Snapshot creation and retrieval
- ✅ Feedback loop (events, cycle time, revisions)

---

## Local Development Setup

### 1. Run Migrations
```bash
# Using Supabase CLI
supabase db reset

# Or apply specific migration
supabase migration up
```

### 2. Environment Variables
```bash
# Required
SAKO_V1_API_URL=https://api.trysako.com  # Optional - sync is best-effort
SAKO_V1_API_KEY=your_api_key              # Optional
SAKO_WEBHOOK_SECRET=your_webhook_secret   # Optional in dev

# For testing
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Seed Test Data
```sql
-- Create test workspace with Max plan
INSERT INTO workspaces (id, name, plan, subscription_status)
VALUES ('test-workspace', 'Test Workspace', 'max', 'active');

-- Create test campaign
INSERT INTO campaigns (id, workspace_id, name, status)
VALUES ('test-campaign', 'test-workspace', 'Test Campaign', 'draft');
```

---

## Smoke Test Checklist

### 1. Basic Escalation Flow
- [ ] Open campaign detail page
- [ ] Click "Send to Sako" button
- [ ] Fill in reason
- [ ] Submit form
- [ ] Verify success state
- [ ] Copy task ID to clipboard

### 2. Idempotency
- [ ] Click "Send to Sako" again with same campaign
- [ ] Verify "Already Sent" message appears
- [ ] Verify same task ID returned

### 3. Permission Denial
- [ ] Switch to Starter/Pro plan workspace
- [ ] Try to send to Sako
- [ ] Verify upgrade prompt appears

### 4. Status Polling
- [ ] Send campaign to Sako
- [ ] Keep dialog open
- [ ] Verify status updates every 10 seconds
- [ ] Close dialog and reopen - verify status persisted

### 5. Snapshot Security
- [ ] Get snapshot ID from escalation response
- [ ] Visit `/api/sako/snapshots/[id]/render`
- [ ] Verify CSP headers present
- [ ] Try to access from different workspace - verify 404

### 6. Webhook Handling
- [ ] Send test webhook to `/api/sako/webhook`
- [ ] Verify signature validation
- [ ] Verify status mapping (uppercase → lowercase)
- [ ] Verify feedback event recorded

### 7. Database Verification
- [ ] Check `escalations` table has new row
- [ ] Check `sako_tasks` table has new row
- [ ] Check `composer_snapshots` table has new row
- [ ] Check `composer_feedback_events` has task_created event

### 8. Multi-tenant Isolation
- [ ] Create task in workspace A
- [ ] Try to fetch status from workspace B
- [ ] Verify 404 response (not 403)

### 9. Observability
- [ ] Check logs for structured JSON events
- [ ] Verify `sako.escalation.success` event logged
- [ ] Verify duration_ms metrics present

### 10. Error Handling
- [ ] Disconnect network and try to send
- [ ] Verify error state with retry button
- [ ] Verify error message is user-friendly

---

## Production Deployment Checklist

### Pre-Deployment
- [ ] Run migration `067_send_to_sako_complete.sql`
- [ ] Verify all indexes created
- [ ] Test RLS policies are working
- [ ] Run full test suite

### Environment Variables
- [ ] `SAKO_WEBHOOK_SECRET` is set (production only)
- [ ] `SAKO_V1_API_URL` is configured (optional)
- [ ] `SAKO_V1_API_KEY` is configured (optional)

### Monitoring
- [ ] Set up alerts for `sako.escalation.failure` events
- [ ] Monitor feedback event volume
- [ ] Track cycle time metrics

### Rollback Plan
- [ ] Migration is additive only (safe to rollback)
- [ ] New columns are nullable (backwards compatible)
- [ ] API routes handle missing data gracefully

---

## Known Limitations

1. **External API Sync** - Sync to Sako V1 is best-effort; local task is source of truth
2. **Snapshot Storage** - Currently stores in database; for large volumes consider S3/R2
3. **Webhook Retries** - No automatic retry mechanism for failed webhooks (manual retry via UI)
4. **Notification System** - Slack notifications stubbed; needs full integration

---

## Future Enhancements

1. **Automatic Retry** - Implement exponential backoff for failed escalations
2. **Batch Operations** - Support sending multiple campaigns at once
3. **Template System** - Pre-defined escalation reasons/templates
4. **Analytics Dashboard** - Visualize cycle times, revision rates, quality scores
5. **AI Recommendations** - Suggest improvements based on feedback patterns

---

## Support

For issues or questions:
1. Check logs for `sako.*` events
2. Verify workspace has correct plan
3. Confirm database migrations applied
4. Review test failures for specific issues
