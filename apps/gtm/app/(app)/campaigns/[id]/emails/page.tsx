'use client';

/**
 * Email Sequence Editor (Jan 2026)
 * 
 * Visual editor for email sequences with timeline view,
 * drag-to-reorder, preview, and personalization tokens.
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Clock,
  GripVertical,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Eye,
  Send,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  User,
  Building,
  Calendar,
  Link2,
  Sparkles,
  ArrowLeft,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Email {
  id: string;
  subject: string;
  preheader: string;
  body: string;
  dayDelay: number;
  sendTime: string;
  variant?: 'A' | 'B';
  claims: string[];
}

interface EmailSequence {
  id: string;
  name: string;
  type: 'welcome' | 'nurture' | 'promo' | 're-engagement';
  emails: Email[];
}

// Personalization tokens
const TOKENS = [
  { token: '{{first_name}}', label: 'First Name', icon: User },
  { token: '{{company}}', label: 'Company', icon: Building },
  { token: '{{date}}', label: 'Current Date', icon: Calendar },
  { token: '{{link}}', label: 'CTA Link', icon: Link2 },
];

export default function EmailSequenceEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = use(params);
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [campaign, setCampaign] = useState<{ name: string } | null>(null);
  const [sequence, setSequence] = useState<EmailSequence | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<Email | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showPreview, setShowPreview] = useState(false);
  
  // Fetch campaign and email sequence
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch campaign
        const campaignRes = await fetch(`/api/campaigns/${campaignId}`);
        if (campaignRes.ok) {
          const campaignData = await campaignRes.json();
          setCampaign(campaignData);
        }
        
        // Fetch email sequence asset
        const assetsRes = await fetch(`/api/campaigns/${campaignId}/assets?type=email_sequence`);
        if (assetsRes.ok) {
          const assetsData = await assetsRes.json();
          if (assetsData.assets && assetsData.assets.length > 0) {
            const emailAsset = assetsData.assets[0];
            setSequence({
              id: emailAsset.id,
              name: emailAsset.content?.name || 'Email Sequence',
              type: emailAsset.content?.type || 'nurture',
              emails: emailAsset.content?.emails || [],
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [campaignId]);
  
  // Generate email sequence
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/assets/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType: 'email_sequence',
          formats: ['nurture'],
          options: { emailCount: 5 },
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setSequence({
            id: data.asset?.id || `seq-${Date.now()}`,
            name: data.result.name || 'Email Sequence',
            type: data.result.type || 'nurture',
            emails: data.result.emails || [],
          });
        }
      }
    } catch (error) {
      console.error('Failed to generate sequence:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Save sequence
  const handleSave = async () => {
    if (!sequence) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/assets/${sequence.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            name: sequence.name,
            type: sequence.type,
            emails: sequence.emails,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save sequence:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Reorder emails
  const handleReorder = (newOrder: Email[]) => {
    if (!sequence) return;
    setSequence({
      ...sequence,
      emails: newOrder.map((email, idx) => ({
        ...email,
        dayDelay: idx === 0 ? 0 : email.dayDelay,
      })),
    });
  };
  
  // Edit email
  const handleEditEmail = (email: Email) => {
    setEditingEmail({ ...email });
    setIsEditDialogOpen(true);
  };
  
  // Save email edit
  const handleSaveEmailEdit = () => {
    if (!editingEmail || !sequence) return;
    
    setSequence({
      ...sequence,
      emails: sequence.emails.map(e =>
        e.id === editingEmail.id ? editingEmail : e
      ),
    });
    
    setIsEditDialogOpen(false);
    setEditingEmail(null);
  };
  
  // Delete email
  const handleDeleteEmail = (emailId: string) => {
    if (!sequence) return;
    setSequence({
      ...sequence,
      emails: sequence.emails.filter(e => e.id !== emailId),
    });
  };
  
  // Duplicate email
  const handleDuplicateEmail = (email: Email) => {
    if (!sequence) return;
    const newEmail: Email = {
      ...email,
      id: `email-${Date.now()}`,
      subject: `${email.subject} (Copy)`,
      variant: email.variant === 'A' ? 'B' : 'A',
    };
    setSequence({
      ...sequence,
      emails: [...sequence.emails, newEmail],
    });
  };
  
  // Add new email
  const handleAddEmail = () => {
    if (!sequence) return;
    const lastEmail = sequence.emails[sequence.emails.length - 1];
    const newEmail: Email = {
      id: `email-${Date.now()}`,
      subject: 'New Email',
      preheader: '',
      body: 'Write your email content here...',
      dayDelay: lastEmail ? lastEmail.dayDelay + 3 : 0,
      sendTime: '09:00',
      claims: [],
    };
    setSequence({
      ...sequence,
      emails: [...sequence.emails, newEmail],
    });
  };
  
  // Insert token
  const insertToken = (token: string) => {
    if (!editingEmail) return;
    setEditingEmail({
      ...editingEmail,
      body: editingEmail.body + ` ${token}`,
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Email Sequence
              </h1>
              <p className="text-sm text-muted-foreground">
                {campaign?.name || 'Campaign'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {sequence && (
              <>
                <Badge variant="outline">
                  {sequence.emails.length} emails
                </Badge>
                <Badge variant="outline">
                  {sequence.type}
                </Badge>
              </>
            )}
            <Button variant="outline" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {sequence ? 'Regenerate' : 'Generate'}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !sequence}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Timeline */}
        <div className="w-80 border-r bg-muted/30 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium">Timeline</h2>
            <Button variant="ghost" size="sm" onClick={handleAddEmail} disabled={!sequence}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          {sequence && sequence.emails.length > 0 ? (
            <Reorder.Group
              axis="y"
              values={sequence.emails}
              onReorder={handleReorder}
              className="space-y-2"
            >
              {sequence.emails.map((email, idx) => (
                <Reorder.Item
                  key={email.id}
                  value={email}
                  className={`p-3 bg-background rounded-lg border cursor-move group ${
                    selectedEmail?.id === email.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedEmail(email)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        {idx + 1}
                      </div>
                      {idx < sequence.emails.length - 1 && (
                        <div className="w-0.5 h-8 bg-border mt-1" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{email.subject}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Day {email.dayDelay}
                        {email.variant && (
                          <Badge variant="outline" className="text-[10px] px-1">
                            {email.variant}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No emails in sequence
              </p>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Generate Sequence
              </Button>
            </div>
          )}
        </div>
        
        {/* Email Editor/Preview */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedEmail ? (
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium">
                  Email {sequence?.emails.findIndex(e => e.id === selectedEmail.id)! + 1}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicateEmail(selectedEmail)}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditEmail(selectedEmail)}
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteEmail(selectedEmail.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <Tabs defaultValue="content">
                <TabsList>
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                
                <TabsContent value="content" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Subject Line</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-medium">{selectedEmail.subject}</p>
                      {selectedEmail.preheader && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedEmail.preheader}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Email Body</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: selectedEmail.body.replace(/\n/g, '<br>') }} />
                      </div>
                    </CardContent>
                  </Card>
                  
                  {selectedEmail.claims.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Claims Detected</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {selectedEmail.claims.map((claim, idx) => (
                            <Badge key={idx} variant="outline">
                              {claim}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="settings" className="space-y-4 mt-4">
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Send Delay</label>
                          <p className="text-2xl font-bold mt-1">
                            Day {selectedEmail.dayDelay}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Send Time</label>
                          <p className="text-2xl font-bold mt-1">
                            {selectedEmail.sendTime}
                          </p>
                        </div>
                      </div>
                      
                      {selectedEmail.variant && (
                        <div>
                          <label className="text-sm font-medium">A/B Variant</label>
                          <Badge className="mt-1 ml-2">{selectedEmail.variant}</Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="preview" className="mt-4">
                  <div className="flex justify-center mb-4">
                    <div className="inline-flex rounded-lg border p-1">
                      <Button
                        variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setPreviewMode('desktop')}
                      >
                        Desktop
                      </Button>
                      <Button
                        variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setPreviewMode('mobile')}
                      >
                        Mobile
                      </Button>
                    </div>
                  </div>
                  
                  <div className={`mx-auto bg-card rounded-lg shadow-lg overflow-hidden ${
                    previewMode === 'mobile' ? 'max-w-sm' : 'max-w-2xl'
                  }`}>
                    <div className="bg-muted px-4 py-3 border-b">
                      <p className="text-sm font-medium">{selectedEmail.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedEmail.preheader}
                      </p>
                    </div>
                    <div className="p-6">
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: selectedEmail.body
                            .replace(/\n/g, '<br>')
                            .replace(/\{\{first_name\}\}/g, '<span class="text-primary">[First Name]</span>')
                            .replace(/\{\{company\}\}/g, '<span class="text-primary">[Company]</span>')
                        }} 
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <Mail className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select an email</h3>
                <p className="text-muted-foreground">
                  Click on an email in the timeline to view and edit it
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Edit Email Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Email</DialogTitle>
          </DialogHeader>
          
          {editingEmail && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Subject Line</label>
                <Input
                  value={editingEmail.subject}
                  onChange={(e) => setEditingEmail({
                    ...editingEmail,
                    subject: e.target.value,
                  })}
                  placeholder="Email subject..."
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Preheader</label>
                <Input
                  value={editingEmail.preheader}
                  onChange={(e) => setEditingEmail({
                    ...editingEmail,
                    preheader: e.target.value,
                  })}
                  placeholder="Preview text shown in inbox..."
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">Email Body</label>
                  <div className="flex gap-1">
                    {TOKENS.map((t) => (
                      <Button
                        key={t.token}
                        variant="ghost"
                        size="sm"
                        onClick={() => insertToken(t.token)}
                        className="h-7 text-xs"
                      >
                        <t.icon className="w-3 h-3 mr-1" />
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Textarea
                  value={editingEmail.body}
                  onChange={(e) => setEditingEmail({
                    ...editingEmail,
                    body: e.target.value,
                  })}
                  className="min-h-[200px]"
                  placeholder="Write your email content..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Day Delay</label>
                  <Input
                    type="number"
                    value={editingEmail.dayDelay}
                    onChange={(e) => setEditingEmail({
                      ...editingEmail,
                      dayDelay: parseInt(e.target.value) || 0,
                    })}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Send Time</label>
                  <Input
                    type="time"
                    value={editingEmail.sendTime}
                    onChange={(e) => setEditingEmail({
                      ...editingEmail,
                      sendTime: e.target.value,
                    })}
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">A/B Variant</label>
                <Select
                  value={editingEmail.variant || 'none'}
                  onValueChange={(value) => setEditingEmail({
                    ...editingEmail,
                    variant: value === 'none' ? undefined : value as 'A' | 'B',
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select variant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No variant</SelectItem>
                    <SelectItem value="A">Variant A</SelectItem>
                    <SelectItem value="B">Variant B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEmailEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
