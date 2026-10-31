-- Chat History for AI Agent
-- Stores chat sessions and messages for conversation persistence

-- Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT NOT NULL DEFAULT 'openai/gpt-5.2-chat',
  
  -- Link to campaign if created from this chat
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Status
  is_archived BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  
  -- Tool call tracking (for showing steps like "Parsing brief...")
  tool_calls JSONB DEFAULT '[]',
  tool_results JSONB DEFAULT '[]',
  
  -- Metadata
  model TEXT,
  tokens_used INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_chat_sessions_workspace ON chat_sessions(workspace_id);
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

-- Enable RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their chat sessions" ON chat_sessions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create chat sessions" ON chat_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their chat sessions" ON chat_sessions
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their chat sessions" ON chat_sessions
  FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Users can view messages in their sessions" ON chat_messages
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their sessions" ON chat_messages
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
  );

-- Function to auto-update session updated_at when new message added
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions SET updated_at = now() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_message_update_session
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_session_timestamp();

-- Function to auto-title session from first message
CREATE OR REPLACE FUNCTION auto_title_chat_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'user' THEN
    UPDATE chat_sessions 
    SET title = LEFT(NEW.content, 50) || CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END
    WHERE id = NEW.session_id 
    AND title = 'New Chat';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_message_auto_title
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_title_chat_session();
