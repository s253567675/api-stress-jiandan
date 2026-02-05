/*
 * Config Templates Component
 * Save and load test configuration templates
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Bookmark, ChevronDown, Save, Trash2, Edit2, Check, Loader2 } from 'lucide-react';
import type { TestConfig } from '@/hooks/useStressTest';

interface ConfigTemplatesProps {
  currentConfig: TestConfig;
  onLoadTemplate: (config: TestConfig) => void;
  disabled?: boolean;
}

export function ConfigTemplates({ currentConfig, onLoadTemplate, disabled }: ConfigTemplatesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  // Fetch templates
  const { data: templates, refetch } = trpc.configTemplates.list.useQuery();

  // Mutations
  const createMutation = trpc.configTemplates.create.useMutation({
    onSuccess: () => {
      toast.success('模板已保存');
      setIsSaveDialogOpen(false);
      setTemplateName('');
      setTemplateDescription('');
      refetch();
    },
    onError: (error) => {
      toast.error('保存失败: ' + error.message);
    },
  });

  const updateMutation = trpc.configTemplates.update.useMutation({
    onSuccess: () => {
      toast.success('模板已更新');
      setEditingId(null);
      refetch();
    },
    onError: (error) => {
      toast.error('更新失败: ' + error.message);
    },
  });

  const deleteMutation = trpc.configTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success('模板已删除');
      refetch();
    },
    onError: (error) => {
      toast.error('删除失败: ' + error.message);
    },
  });

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast.error('请输入模板名称');
      return;
    }
    createMutation.mutate({
      name: templateName.trim(),
      description: templateDescription.trim() || undefined,
      config: currentConfig,
    });
  };

  const handleLoadTemplate = (config: unknown) => {
    try {
      onLoadTemplate(config as TestConfig);
      toast.success('配置已加载');
      setIsOpen(false);
    } catch (error) {
      toast.error('加载配置失败');
    }
  };

  const handleUpdateName = (id: number) => {
    if (!editingName.trim()) {
      toast.error('名称不能为空');
      return;
    }
    updateMutation.mutate({ id, name: editingName.trim() });
  };

  const handleDelete = (id: number) => {
    if (confirm('确定要删除这个模板吗？')) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 gap-1 text-xs"
            disabled={disabled}
          >
            <Bookmark className="w-3 h-3" />
            模板
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuItem 
            onClick={() => {
              setIsOpen(false);
              setIsSaveDialogOpen(true);
            }}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            保存当前配置为模板
          </DropdownMenuItem>
          
          {templates && templates.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                已保存的模板
              </div>
              {templates.map((template) => (
                <div 
                  key={template.id} 
                  className="flex items-center justify-between px-2 py-1.5 hover:bg-accent rounded-sm group"
                >
                  {editingId === template.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-6 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateName(template.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleUpdateName(template.id)}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="flex-1 text-left text-sm truncate"
                        onClick={() => handleLoadTemplate(template.config)}
                      >
                        {template.name}
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(template.id);
                            setEditingName(template.name);
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(template.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
          
          {(!templates || templates.length === 0) && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                暂无保存的模板
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Template Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>保存配置模板</DialogTitle>
            <DialogDescription>
              将当前测试配置保存为模板，方便以后快速加载使用
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">模板名称</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="例如：生产环境API压测"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">描述（可选）</Label>
              <Textarea
                id="template-description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="模板用途说明..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleSaveTemplate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存模板'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
