/**
 * Approval Decision API Route
 * 
 * GET  - Get approval request details
 * POST - Submit approval decision
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getApprovalRequest, processApprovalDecision } from '@/lib/agents/hitl';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const approval = await getApprovalRequest(id);
    
    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }
    
    return NextResponse.json({ approval });
  } catch (error) {
    console.error('Error fetching approval:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approval' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    
    // Get user
    const authHeader = request.headers.get('authorization');
    const { data: { user } } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { decision, note } = body;
    
    if (!decision || !['approve', 'reject'].includes(decision)) {
      return NextResponse.json(
        { error: 'Valid decision (approve/reject) required' },
        { status: 400 }
      );
    }
    
    const result = await processApprovalDecision(
      id,
      user.id,
      user.email || 'unknown',
      decision,
      note
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing approval:', error);
    const message = error instanceof Error ? error.message : 'Failed to process approval';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
