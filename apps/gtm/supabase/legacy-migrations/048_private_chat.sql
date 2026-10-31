-- Private Chat System Migration
-- Phase 1.1: Confidential workspace conversations within Canvas projects

-- Private chats table
CREATE TABLE IF NOT EXISTS private_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT,
  description TEXT,
  participants UUID[] DEFAULT '{}',
  is_archived BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Private chat messages table
CREATE TABLE IF NOT EXISTS private_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES private_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'system', 'ai_response'
  metadata JSONB DEFAULT '{}',
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_private_chats_workspace ON private_chats(workspace_id);
CREATE INDEX IF NOT EXISTS idx_private_chats_project ON private_chats(project_id);
CREATE INDEX IF NOT EXISTS idx_private_chats_participants ON private_chats USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_private_chat_messages_chat ON private_chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_private_chat_messages_created ON private_chat_messages(created_at DESC);

-- RLS Policies
ALTER TABLE private_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view chats they're participants in
CREATE POLICY "Users can view their private chats"
  ON private_chats FOR SELECT
  USING (
    auth.uid() = ANY(participants) OR
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = private_chats.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

-- Policy: Users can create chats in their workspaces
CREATE POLICY "Users can create private chats"
  ON private_chats FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = private_chats.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- Policy: Chat participants can update
CREATE POLICY "Participants can update chats"
  ON private_chats FOR UPDATE
  USING (
    auth.uid() = ANY(participants) OR
    auth.uid() = created_by
  );

-- Policy: Only creator can delete
CREATE POLICY "Creator can delete chats"
  ON private_chats FOR DELETE
  USING (auth.uid() = created_by);

-- Policy: Participants can view messages
CREATE POLICY "Participants can view messages"
  ON private_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM private_chats pc
      WHERE pc.id = private_chat_messages.chat_id
      AND (auth.uid() = ANY(pc.participants) OR auth.uid() = pc.created_by)
    )
  );

-- Policy: Participants can send messages
CREATE POLICY "Participants can send messages"
  ON private_chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM private_chats pc
      WHERE pc.id = private_chat_messages.chat_id
      AND (auth.uid() = ANY(pc.participants) OR auth.uid() = pc.created_by)
    )
  );

-- Policy: Users can edit their own messages
CREATE POLICY "Users can edit own messages"
  ON private_chat_messages FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages"
  ON private_chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update chat timestamp on new message
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE private_chats
  SET updated_at = now()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update chat timestamp
DROP TRIGGER IF EXISTS trigger_update_chat_timestamp ON private_chat_messages;
CREATE TRIGGER trigger_update_chat_timestamp
  AFTER INSERT ON private_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_timestamp();
